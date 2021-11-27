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


    describe("setTargetAllBlocked()", async () => {
        it("should revert if caller is not owner", async () => {
            const { guard } = await setupTests();
            await expect(guard.connect(user2).setTargetAllBlocked(guard.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            await expect(guard.setTargetAllBlocked(avatar.address, true)).to.emit(guard, "SetTargetAllBlocked").withArgs(avatar.address, true);

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

        });

        it("should completely unblock a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            await expect(guard.setTargetAllBlocked(avatar.address, true)).to.emit(guard, "SetTargetAllBlocked").withArgs(avatar.address, true);
            await expect(guard.setTargetAllBlocked(avatar.address, false)).to.emit(guard, "SetTargetAllBlocked").withArgs(avatar.address, false);

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

        });
    });



    describe("setDelegateCallBlocked()", async () => {
        it("should revert if caller is not owner", async () => {
            const { guard } = await setupTests();
            await expect(guard.connect(user2).setDelegateCallBlocked(guard.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(false);

            await expect(guard.setDelegateCallBlocked(avatar.address, true)).to.emit(guard, "SetDelegateCallBlocked").withArgs(avatar.address, true);

            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(true);

        });

        it("should completely unblock a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(false);

            await expect(guard.setDelegateCallBlocked(avatar.address, true)).to.emit(guard, "SetDelegateCallBlocked").withArgs(avatar.address, true);
            await expect(guard.setDelegateCallBlocked(avatar.address, false)).to.emit(guard, "SetDelegateCallBlocked").withArgs(avatar.address, false);

            expect(await guard.isDelegateCallBlocked(avatar.address)).to.be.equals(false);

        });
    });


    describe("setBlockedFunction()", async () => {
        const funcSign = "0xabcdabcd";
        it("should revert if caller is not owner", async () => {
            const { guard } = await setupTests();
            await expect(guard.connect(user2).setBlockedFunction(guard.address, funcSign, true)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(false);

            await expect(guard.setBlockedFunction(avatar.address, funcSign, true)).to.emit(guard, "SetBlockedFunction").withArgs(avatar.address, funcSign, true);

            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(true);

        });

        it("should completely unblock a target", async () => {
            const { avatar, guard } = await setupTests();

            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(false);

            await expect(guard.setBlockedFunction(avatar.address, funcSign, true)).to.emit(guard, "SetBlockedFunction").withArgs(avatar.address, funcSign, true);
            await expect(guard.setBlockedFunction(avatar.address, funcSign, false)).to.emit(guard, "SetBlockedFunction").withArgs(avatar.address, funcSign, false);

            expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(false);

        });
    });

    describe("setSendBlocked()", async () => {
        it("should revert if caller is not owner", async () => {
            const { guard } = await setupTests();
            await expect(guard.connect(user2).setSendBlocked(guard.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isSendBlocked(avatar.address,)).to.be.equals(false);

            await expect(guard.setSendBlocked(avatar.address, true)).to.emit(guard, "SetSendBlocked").withArgs(avatar.address, true);

            expect(await guard.isSendBlocked(avatar.address,)).to.be.equals(true);

        });

        it("should completely unblock a target", async () => {
            const { avatar, guard } = await setupTests();

            expect(await guard.isSendBlocked(avatar.address,)).to.be.equals(false);

            await expect(guard.setSendBlocked(avatar.address, true)).to.emit(guard, "SetSendBlocked").withArgs(avatar.address, true);
            await expect(guard.setSendBlocked(avatar.address, false)).to.emit(guard, "SetSendBlocked").withArgs(avatar.address, false);

            expect(await guard.isSendBlocked(avatar.address,)).to.be.equals(false);

        });
    });


    describe("checkTransaction()", async () => {


        it("should revert if target is blocked", async () => {
            const { guard, tx } = await setupTests();
            await guard.setTargetAllBlocked(tx.to, true);

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

        it("should allow if target is not blocked", async () => {
            const { guard, tx } = await setupTests();
            await guard.setTargetAllBlocked(tx.to, false);

            await (guard.checkTransaction(
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
            );
        });

        it("should allow if target is unblocked", async () => {
            const { guard, tx } = await setupTests();
            await guard.setTargetAllBlocked(tx.to, true);
            await guard.setTargetAllBlocked(tx.to, false);

            await (guard.checkTransaction(
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
            );
        });

        it("should revert delegate call if delegate calls are blocked to target", async () => {
            const { guard, tx } = await setupTests();
            tx.operation = 1;
            await guard.setDelegateCallBlocked(tx.to, true);
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

            await guard.setDelegateCallBlocked(tx.to, false);
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
            await guard.setBlockedFunction(tx.to, tx.data, true);

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

            tx.data = "0x12345678"
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


        it("should block the Send to the target", async () => {
            const { guard, avatar, tx } = await setupTests();
            await guard.setSendBlocked(tx.to, true);
            tx.data = "0x"
            await expect(guard.checkTransaction(
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
            )).to.be.revertedWith("Cannot send to this address");

        });

        it("should allow the Send to the target", async () => {
            const { guard, avatar, tx } = await setupTests();
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

        it("should block the target (data.length < 4) due to function signature too short", async () => {
            const { guard, avatar, tx } = await setupTests();
            await guard.setSendBlocked(tx.to, true);
            tx.data = "0x123456"
            await expect(guard.checkTransaction(
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
            )).to.be.revertedWith("Function signature too short");

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


            const funcSig = guard.interface.encodeFunctionData("setBlockedFunction", [guard.address, "0x00000000", false]).slice(0, 10);
            await guard.setBlockedFunction(guard.address, funcSig, true);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(true);


            // avatar trying to unblock
            const data = guard.interface.encodeFunctionData("setBlockedFunction", [guard.address, funcSig, false]);
            await expect(avatar.execTransaction(guard.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, "0x")).
                to.be.revertedWith("The function call to the target is blocked");

        });




        it("should allow the setBlockedFunction call from avatar through modifier module", async () => {
            const { avatar, modifier, guardFactory } = await setupTests();


            const guard = await guardFactory.deploy(user1.address);

            await modifier.enableModule(avatar.address);
            await modifier.setTarget(avatar.address);
            await avatar.enableModule(modifier.address);

            await avatar.setGuard(guard.address);


            const funcSig = guard.interface.encodeFunctionData("setBlockedFunction", [guard.address, "0x00000000", false]).slice(0, 10);
            await guard.setBlockedFunction(guard.address, funcSig, true);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(true);



            await guard.transferOwnership(avatar.address);
            const data = guard.interface.encodeFunctionData("setBlockedFunction", [guard.address, funcSig, false]);
            const modifierData = modifier.interface.encodeFunctionData("execTransactionFromModule", [guard.address, 0, data, 0]);
            await avatar.execTransaction(modifier.address, 0, modifierData, 0, 0, 0, 0, AddressZero, AddressZero, "0x");

            let delayedResult = await modifier.executeNextTx();
            await expect(delayedResult).to.emit(guard, "SetBlockedFunction").withArgs(guard.address, funcSig, false);
            expect(await guard.isFunctionBlocked(guard.address, funcSig)).to.be.equals(false);
        });
    });


});