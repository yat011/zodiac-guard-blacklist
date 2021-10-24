import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";


describe("BlacklistGuard", async () => {
    const [user1, user2, user3] = waffle.provider.getWallets();
    const abiCoder = new ethers.utils.AbiCoder();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
        const avatar = await avatarFactory.deploy();
        const guardFactory = await hre.ethers.getContractFactory("BlacklistGuard");
        const guard = await guardFactory.deploy(user1.address);
        const modifierFactory = await hre.ethers.getContractFactory("TestModifier");
        const modifier = await modifierFactory.deploy();

        await avatar.enableModule(user1.address);
        await avatar.setGuard(AddressZero);
        const initializeParams = abiCoder.encode(["address"], [user1.address]);

        const tx = {
            to: avatar.address,
            value: 0,
            data: "0x",
            operation: 0,
            avatarTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: AddressZero,
            refundReceiver: AddressZero,
            signatures: "0x",
        };
        return {
            avatar,
            guard,
            tx,
            initializeParams,
            modifier,
            guardFactory
        };
    });

    describe("setUp()", async () => {
        it("throws if guard has already been initialized", async () => {
            const { guard, initializeParams } = await setupTests();
            await expect(guard.setUp(initializeParams)).to.be.revertedWith(
                "Initializable: contract is already initialized"
            );
        });

        it("can give up ownership", async () => {
            const { guard, initializeParams } = await setupTests();
            await guard.renounceOwnership({ from: user1.address });
            await expect(await guard.owner()).to.be.equals(ethers.constants.AddressZero);
        });


        it("give up ownership and reset", async () => {
            const { guard, initializeParams } = await setupTests();
            await guard.renounceOwnership({ from: user1.address });
            expect(await guard.owner()).to.be.equals(ethers.constants.AddressZero);
            await expect(guard.setUp(initializeParams)).to.be.revertedWith(
                "Initializable: contract is already initialized"
            );
        });


        it("throws if owner is zero address", async () => {
            const { avatar } = await setupTests();
            const Guard = await hre.ethers.getContractFactory("BlacklistGuard");
            await expect(Guard.deploy(AddressZero)).to.be.revertedWith(
                "Ownable: new owner is the zero address"
            );
        });

        it("should emit event because of successful set up", async () => {
            const { avatar } = await setupTests();
            const Guard = await hre.ethers.getContractFactory("BlacklistGuard");
            const guard = await Guard.deploy(user1.address);
            await guard.deployed();

            await expect(guard.deployTransaction)
                .to.emit(guard, "BlacklistGuardSetup")
                .withArgs(user1.address, user1.address);
        });
    });





    describe("fallback", async () => {
        it("must NOT revert on fallback without value", async () => {
            const { guard } = await setupTests();
            await user1.sendTransaction({
                to: guard.address,
                data: "0xbaddad",
            });
        });
        it("should revert on fallback with value", async () => {
            const { guard } = await setupTests();
            await expect(
                user1.sendTransaction({
                    to: guard.address,
                    data: "0xbaddad",
                    value: 1,
                })
            ).to.be.reverted;
        });
    });

    describe("setTarget()", async () => {
        it("should revert if caller is not owner", async () => {
            const { guard } = await setupTests();
            await expect(
                guard.connect(user2).setTarget(guard.address, true, true, "0x00000000", false)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            await expect(await guard.setTarget(avatar.address, true, false, "0x00000000", false)).to.emit(guard, "SetTarget");

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

        });

        it("can be set by avatar after transfering ownership", async () => {
            const { avatar, guard } = await setupTests();
            const data = guard.interface.encodeFunctionData("setTarget", [avatar.address, true, false, "0x00000000", false]);

            await guard.transferOwnership(avatar.address);
            const result = await avatar.connect(user2).execTransaction(guard.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, "0x");
            await expect(result).to.emit(guard, "SetTarget").withArgs(avatar.address, true, false, "0x00000000", false);
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

        });


        it("should unblock a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            await expect(guard.setTarget(avatar.address, true, false, "0x00000000", false)).to.emit(guard, "SetTarget");

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

            await expect(guard.setTarget(avatar.address, false, false, "0x00000000", false)).to.emit(guard, "SetTarget");

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

        });


        it("should block a target function", async () => {
            const { avatar, guard } = await setupTests();
            const data = guard.interface.encodeFunctionData("setTarget", [avatar.address, true, false, "0x00000000", false]);
            const funcSign = data.slice(0, 10);
            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(false);

            await expect(guard.setTarget(avatar.address, false, false, funcSign, true)).to.emit(guard, "SetTarget");

            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(true);

        });


        it("should allow the setTarget call from avatar through modifier module", async () => {
            const { avatar, modifier, guardFactory } = await setupTests();


            const guard = await guardFactory.deploy(user1.address);

            await modifier.enableModule(avatar.address);
            await modifier.setTarget(avatar.address);
            await avatar.enableModule(modifier.address);

            await avatar.setGuard(guard.address);


            const funcSig = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, "0x00000000", false]).slice(0, 10);
            await guard.setTarget(guard.address, false, false, funcSig, true);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(true);



            await guard.transferOwnership(avatar.address);
            const data = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, funcSig, false]);
            const modifierData = modifier.interface.encodeFunctionData("execTransactionFromModule", [guard.address, 0, data, 0]);
            await avatar.execTransaction(modifier.address, 0, modifierData, 0, 0, 0, 0, AddressZero, AddressZero, "0x");

            let delayedResult = await modifier.executeNextTx();
            await expect(delayedResult).to.emit(guard, "SetTarget").withArgs(guard.address, false, false, funcSig, false);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(false);
        });


        it("should block the direct setTarget call from avatar.", async () => {
            const { avatar, modifier, guardFactory } = await setupTests();


            const guard = await guardFactory.deploy(user1.address);

            await modifier.enableModule(avatar.address);
            await modifier.setTarget(avatar.address);
            await avatar.enableModule(modifier.address);

            await avatar.setGuard(guard.address);


            const funcSig = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, "0x00000000", false]).slice(0, 10);
            await guard.setTarget(guard.address, false, false, funcSig, true);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(true);



            await guard.transferOwnership(avatar.address);
            const data = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, funcSig, false]);
            //avatar try to unblock
            await expect(avatar.execTransaction(guard.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, "0x")).
                to.be.revertedWith("The function call to the target is blocked");
        });

    });






    describe("checkTransaction()", async () => {


        it("should revert if target is blocked", async () => {
            const { guard, tx } = await setupTests();
            await guard.setTarget(tx.to, true, false, "0x00000000", false);

            await expect(
                guard.checkTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.avatarTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    tx.signatures,
                    user1.address
                )
            ).to.be.revertedWith("Target address is blocked");
        });

        it("should revert delegate call if delegate calls are blocked to target", async () => {
            const { guard, tx } = await setupTests();
            tx.operation = 1;
            await guard.setTarget(tx.to, false, true, "0x00000000", false);
            await expect(
                guard.checkTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.avatarTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    tx.signatures,
                    user1.address
                )
            ).to.be.revertedWith("Delegate call not allowed to this address");
        });

        it("should allow delegate call if delegate calls are not blocked to target", async () => {
            const { guard, avatar, tx } = await setupTests();

            await guard.setTarget(tx.to, false, false, "0x12345678", true);
            tx.operation = 1;

            await guard.checkTransaction(
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.avatarTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                tx.signatures,
                user1.address
            )
        });

        it("should block the function call to the target", async () => {
            const { guard, avatar, tx } = await setupTests();

            tx.data = "0x12345678"
            await guard.setTarget(tx.to, false, false, tx.data, true);

            await expect(
                guard.checkTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.avatarTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    tx.signatures,
                    user1.address
                )
            ).to.be.revertedWith("The function call to the target is blocked");

            tx.data = "0x1234567889"
            await expect(
                guard.checkTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.avatarTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    tx.signatures,
                    user1.address
                )
            ).to.be.revertedWith("The function call to the target is blocked");

        });

        it("should allow the function call to the target", async () => {
            const { guard, avatar, tx } = await setupTests();


            await guard.setTarget(tx.to, false, false, "0x12345678", true);
            tx.data = "0x1234"
            await guard.checkTransaction(
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.avatarTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                tx.signatures,
                user1.address
            );

            tx.data = "0x"
            await guard.checkTransaction(
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.avatarTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                tx.signatures,
                user1.address
            );

        });


        it("it should be callable by a avatar", async () => {
            const { avatar, guard, tx } = await setupTests();
            tx.operation = 0;
            tx.to = guard.address;
            tx.value = 0;
            await expect(
                avatar.execTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.avatarTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    tx.signatures
                )
            );
        });


        it("should block avatar from calling target func", async () => {
            const { avatar, modifier, guardFactory } = await setupTests();


            const guard = await guardFactory.deploy(user1.address);
            await modifier.enableModule(guard.address);
            await modifier.setTarget(avatar.address);
            await avatar.enableModule(modifier.address);
            await avatar.setGuard(guard.address);


            const funcSig = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, "0x00000000", false]).slice(0, 10);
            await guard.setTarget(guard.address, false, false, funcSig, true);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(true);


            const data = guard.interface.encodeFunctionData("setTarget", [guard.address, false, false, funcSig, false]);
            await expect(avatar.execTransaction(guard.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, "0x")).
                to.be.revertedWith("The function call to the target is blocked");

        });
    });



    describe("isTargetAllBlocked", async () => {
        it("should return false if not set", async () => {
            const { avatar, guard } = await setupTests();

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);
        });

        it("should return true if target is blocked", async () => {
            const { avatar, guard } = await setupTests();

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);
            await guard.setTarget(avatar.address, true, false, "0x00000000", false);
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);
        });
    });


    describe("isBlockedFunction", async () => {
        it("should return false if not set", async () => {
            const { avatar, guard } = await setupTests();

            expect(
                await guard.isFunctionBlocked(avatar.address, "0x12345678")
            ).to.be.equals(false);
        });

        it("should return true if function is blocked", async () => {
            const { guard } = await setupTests();

            expect(
                await guard.isFunctionBlocked(guard.address, "0x12345678")
            ).to.be.equals(false);

            await expect(guard.setTarget(guard.address, false, false, "0x12345678", true))
                .to.emit(guard, "SetTarget")
                .withArgs(guard.address, false, false, "0x12345678", true);

            expect(
                await guard.isFunctionBlocked(guard.address, "0x12345678")
            ).to.be.equals(true);
        });
    });

    describe("isBlockedToDelegateCall", async () => {


        it("should return true if target is blocked to delegate call", async () => {
            const { avatar, guard } = await setupTests();

            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(
                false
            );
            await expect(guard.setTarget(avatar.address, false, true, "0x12345678", true))
                .to.emit(guard, "SetTarget")
                .withArgs(avatar.address, false, true, "0x12345678", true);

            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(
                true
            );
        });
    });
});