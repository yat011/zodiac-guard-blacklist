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
        const guard = await guardFactory.deploy(user1.address, avatar.address, avatar.address);
        const executorFactory = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await executorFactory.deploy();

        await avatar.enableModule(user1.address);
        await avatar.setGuard(AddressZero);
        const initializeParams = abiCoder.encode(["address", "address", "address"], [user1.address, avatar.address, avatar.address]);

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
            executor,
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
            await expect(await guard.owner()).to.be.equals(ethers.constants.AddressZero);
            await expect(guard.setUp(initializeParams)).to.be.revertedWith(
                "Initializable: contract is already initialized"
            );
        });


        it("throws if owner is zero address", async () => {
            const { avatar } = await setupTests();
            const Guard = await hre.ethers.getContractFactory("BlacklistGuard");
            await expect(Guard.deploy(AddressZero, avatar.address, avatar.address)).to.be.revertedWith(
                "Ownable: new owner is the zero address"
            );
        });

        it("should emit event because of successful set up", async () => {
            const { avatar } = await setupTests();
            const Guard = await hre.ethers.getContractFactory("BlacklistGuard");
            const guard = await Guard.deploy(user1.address, avatar.address, avatar.address);
            await guard.deployed();

            await expect(guard.deployTransaction)
                .to.emit(guard, "BlacklistGuardSetup")
                .withArgs(user1.address, user1.address, avatar.address, avatar.address);
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
            expect(
                guard.connect(user2).setTarget("0xaaa", true, true, "0x00000000", false)
            ).to.be.revertedWith("Only 'avator' and owner can call");
        });

        it("should completely block a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            expect(await guard.setTarget(avatar.address, true, false, "0x00000000", false));

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

        });

        it("can be set by avatar", async () => {
            const { avatar, guard } = await setupTests();
            const data = guard.interface.encodeFunctionData("setTarget", [avatar.address, true, false, "0x00000000", false]);
            const result = await avatar.connect(user2).execTransaction(guard.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, "0x");
            expect(result).to.emit(guard, "SetTarget").withArgs(avatar.address, true, false, "0x00000000", false);
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);

        });


        it("should unblock a target", async () => {
            const { avatar, guard } = await setupTests();
            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

            expect(await guard.setTarget(avatar.address, true, false, "0x00000000", false));

            expect(await guard.setTarget(avatar.address, false, false, "0x00000000", false));

            expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);

        });


        it("should block a target function", async () => {
            const { avatar, guard } = await setupTests();
            const data = guard.interface.encodeFunctionData("setTarget", [avatar.address, true, false, "0x00000000", false]);
            const funcSign = data.slice(0, 10);
            await expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(false);

            // const funcSig = abiCoder.encode("SetTarget")
            await expect(await guard.setTarget(avatar.address, false, false, funcSign, true));

            await expect(await guard.isFunctionBlocked(avatar.address, funcSign)).to.be.equals(true);

        });

    });


    describe("setExecptionalSender", async () => {
        it("should set Exceptional sender", async () => {
            const { avatar, guard } = await setupTests();
            await expect(await guard.getExceptionalSender(avatar.address)).to.be.equals(AddressZero);
            await expect(await guard.setExecptionalSender(avatar.address, user3.address)).to.emit(guard, "SetExceptionalSender").withArgs(avatar.address, user3.address);
            await expect(await guard.getExceptionalSender(avatar.address)).to.be.equals(user3.address);

        })
    })

    describe("requestSetTarget()", async () => {

        // it("should set Target by a callback from Avatar", async () => {
        //     const { avatar, guard } = await setupTests();
        //     await avatar.enableModule(guard.address);

        //     const result = await guard.requestSetTarget(avatar.address, true, false, "0x00000000", false, {
        //         safeTxGas: 0, baseGas: 0, gasPrice: 0, gasToken: AddressZero, refundReceiver: AddressZero, signatures: "0x"
        //     });

        //     await expect(result).to.emit(avatar, "ExecTransaction");
        //     await expect(result).to.emit(guard, "SetTarget").withArgs(avatar.address, true, false, "0x00000000", false);
        //     await expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);
        // });

        it("should send request to an executor, and set Target by a callback", async () => {
            const { avatar, executor, guardFactory } = await setupTests();


            const guard = await guardFactory.deploy(user1.address, avatar.address, executor.address)
            await executor.enableModule(guard.address);
            await executor.setTarget(avatar.address);
            await avatar.enableModule(executor.address);


            const result = await guard.requestSetTarget(avatar.address, true, false, "0x00000000", false, {
                safeTxGas: 0, baseGas: 0, gasPrice: 0, gasToken: AddressZero, refundReceiver: AddressZero, signatures: "0x"
            });

            await expect(result).not.to.emit(avatar, "ExecTransaction");
            await expect(result).not.to.emit(guard, "SetTarget").withArgs(avatar.address, true, false, "0x00000000", false);
            await expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(false);


            const delayedResult = await executor.executeNextTx();
            await expect(delayedResult).to.emit(avatar, "ExecTransaction");
            await expect(delayedResult).to.emit(guard, "SetTarget").withArgs(avatar.address, true, false, "0x00000000", false);
            await expect(await guard.isTargetAllBlocked(avatar.address)).to.be.equals(true);
        });
    })

    // describe("checkTransaction()", async () => {
    //     it("should revert if target is not allowed", async () => {
    //         const { guard, tx } = await setupTests();
    //         await expect(
    //             guard.checkTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures,
    //                 user1.address
    //             )
    //         ).to.be.revertedWith("Target address is not allowed");
    //     });

    //     it("should revert delegate call if delegate calls are not allowed to target", async () => {
    //         const { guard, tx } = await setupTests();
    //         tx.operation = 1;
    //         await expect(
    //             guard.checkTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures,
    //                 user1.address
    //             )
    //         ).to.be.revertedWith("Delegate call not allowed to this address");
    //     });

    //     it("should allow delegate call if delegate calls are allowed to target", async () => {
    //         const { guard, avatar, tx } = await setupTests();

    //         await guard.setTargetAllowed(avatar.address, true);
    //         await guard.setDelegateCallAllowedOnTarget(avatar.address, true);
    //         tx.operation = 1;

    //         await expect(
    //             guard.checkTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures,
    //                 user1.address
    //             )
    //         );
    //     });

    //     it("should revert if scoped and target function is not allowed", async () => {
    //         const { avatar, guard, tx } = await setupTests();
    //         await guard.setTargetAllowed(avatar.address, true);
    //         await guard.setScoped(avatar.address, true);
    //         tx.data = "0x12345678";
    //         tx.operation = 0;

    //         await expect(
    //             guard.checkTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures,
    //                 user1.address
    //             )
    //         ).to.be.revertedWith("Target function is not allowed");
    //     });

    //     it("should revert if scoped and no transaction data is disallowed", async () => {
    //         const { avatar, guard, tx } = await setupTests();
    //         await guard.setTargetAllowed(avatar.address, true);
    //         await guard.setScoped(avatar.address, true);
    //         tx.data = "0x";
    //         tx.value = 1;
    //         await expect(
    //             guard.checkTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures,
    //                 user1.address
    //             )
    //         ).to.be.revertedWith("Cannot send to this address");
    //     });

    //     it("it should be callable by a avatar", async () => {
    //         const { avatar, guard, tx } = await setupTests();
    //         expect(guard.setTargetAllowed(guard.address, true));
    //         tx.operation = 0;
    //         tx.to = guard.address;
    //         tx.value = 0;
    //         await expect(
    //             avatar.execTransaction(
    //                 tx.to,
    //                 tx.value,
    //                 tx.data,
    //                 tx.operation,
    //                 tx.avatarTxGas,
    //                 tx.baseGas,
    //                 tx.gasPrice,
    //                 tx.gasToken,
    //                 tx.refundReceiver,
    //                 tx.signatures
    //             )
    //         );
    //     });
    // });


    // describe("isAllowedTarget", async () => {
    //     it("should return false if not set", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(await guard.isAllowedTarget(avatar.address)).to.be.equals(false);
    //     });

    //     it("should return true if target is allowed", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(await guard.isAllowedTarget(avatar.address)).to.be.equals(false);
    //         expect(guard.setTargetAllowed(avatar.address, true));
    //         expect(await guard.isAllowedTarget(avatar.address)).to.be.equals(true);
    //     });
    // });

    // describe("isScoped", async () => {
    //     it("should return false if not set", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(await guard.isScoped(guard.address)).to.be.equals(false);
    //     });

    //     it("should return false if set to false", async () => {
    //         const { guard } = await setupTests();

    //         expect(guard.setScoped(guard.address, false));
    //         expect(await guard.isScoped(guard.address)).to.be.equals(false);
    //     });

    //     it("should return true if set to true", async () => {
    //         const { guard } = await setupTests();

    //         expect(await guard.isScoped(guard.address)).to.be.equals(false);
    //         expect(guard.setScoped(guard.address, true));
    //         expect(await guard.isScoped(guard.address)).to.be.equals(true);
    //     });
    // });

    // describe("isAllowedFunction", async () => {
    //     it("should return false if not set", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(
    //             await guard.isAllowedFunction(avatar.address, "0x12345678")
    //         ).to.be.equals(false);
    //     });

    //     it("should return true if function is allowed", async () => {
    //         const { guard } = await setupTests();

    //         expect(
    //             await guard.isAllowedFunction(guard.address, "0x12345678")
    //         ).to.be.equals(false);
    //         expect(guard.setAllowedFunction(guard.address, "0x12345678", true))
    //             .to.emit(guard, "SetFunctionAllowedOnTarget")
    //             .withArgs(guard.address, "0x12345678", true);
    //         expect(
    //             await guard.isAllowedFunction(guard.address, "0x12345678")
    //         ).to.be.equals(true);
    //     });
    // });

    // describe("isAllowedToDelegateCall", async () => {
    //     it("should return false by default", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(await guard.isAllowedTarget(avatar.address)).to.be.equals(false);
    //     });

    //     it("should return true if target is allowed to delegate call", async () => {
    //         const { avatar, guard } = await setupTests();

    //         expect(await guard.isAllowedToDelegateCall(avatar.address)).to.be.equals(
    //             false
    //         );
    //         expect(guard.setDelegateCallAllowedOnTarget(avatar.address, true));
    //         expect(await guard.isAllowedToDelegateCall(avatar.address)).to.be.equals(
    //             true
    //         );
    //     });
    // });
});