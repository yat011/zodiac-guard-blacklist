import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@gnosis.pm/zodiac";
import { getSafeSingletonDeployment } from "@gnosis.pm/safe-deployments";
import { deployAndSetUpModule } from "./util";
import { Contract, Signer, utils } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { Guard } from "../../typechain";
import assert from "assert";

const fs = require('fs');
interface TaskArgs {
    owner: string;
    deploymentjson: string;
}


const deployGuard = async (
    taskArgs: TaskArgs,
    hardhatRuntime: HardhatRuntimeEnvironment
) => {
    const [caller] = await hardhatRuntime.ethers.getSigners();
    console.log("Using the account:", caller.address);


    const chainId = Number(await hardhatRuntime.getChainId());


    const factorAddress = CONTRACT_ADDRESSES[chainId]['factory']
    const factorABI = CONTRACT_ABIS['factory'];


    let rawdata = fs.readFileSync(taskArgs.deploymentjson);
    const moduleDeployJson = JSON.parse(rawdata);

    const { transaction } = deployAndSetUpModule(
        moduleDeployJson['address'],
        moduleDeployJson['abi'],
        factorAddress,
        factorABI,
        {
            types: ["address"],
            values: [taskArgs.owner],
        },
        hardhatRuntime.ethers.provider,
        Number(chainId),
        Date.now().toString()
    );

    const deploymentTransaction = await caller.sendTransaction(transaction);
    const receipt = await deploymentTransaction.wait();
    console.log("Guard deployed to:", receipt.logs[1].address);
    return;

};

task("deployProxy", "Deploys a Guard")
    .addParam("deploymentjson",
        "The json contains the masterScopy address and abi", undefined, types.string)
    .addParam("owner", "Address of the Owner", undefined, types.string)
    .setAction(deployGuard);

// task("setTarget", "Block a target address.")
//     .addParam(
//         "guard",
//         "The address of the guard that you are seting up.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "target",
//         "The target address to be blocked.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "blockall",
//         "Block all access to the Target",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "blockdelegate",
//         "Block delegatedCall",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "funcsig",
//         "The signature of the target blocked function",
//         null,
//         types.string
//     )
//     .addParam(
//         "blockfunc",
//         "Block the target function",
//         false,
//         types.boolean
//     )
//     .setAction(async (taskArgs, hardhatRuntime) => {
//         const [caller] = await hardhatRuntime.ethers.getSigners();
//         console.log("Using the account:", caller.address);

//         const guard = await hardhatRuntime.ethers.getContractAt(
//             "BlacklistGuard",
//             taskArgs.guard
//         );
//         let funcHash = "0x00000000";
//         if (taskArgs.funcsig !== null) {
//             funcHash = keccak256(utils.toUtf8Bytes(taskArgs.funcsig)).slice(0, 10);
//         }

//         await guard.setTarget(
//             taskArgs.target,
//             taskArgs.blockall,
//             taskArgs.blockdelegate,
//             funcHash,
//             taskArgs.blockfunc
//         );

//         console.log("Target blocked: ", taskArgs);
//     });

task(
    "transferOwnership",
    "Toggles whether a target address is scoped to specific functions."
)
    .addParam(
        "guard",
        "The address of the guard that you are seting up.",
        undefined,
        types.string
    )
    .addParam(
        "newowner",
        "The address that will be the new owner of the gaurd.",
        undefined,
        types.string
    )
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);
        const guard = await hardhatRuntime.ethers.getContractAt(
            "BlacklistGuard",
            taskArgs.guard
        );
        let tx = await guard.transferOwnership(taskArgs.newowner);
        let receipt = await tx.wait();

        console.log("Guard now owned by: ", await guard.owner());
    });





task("linkAvatarAndGuard")
    .addParam(
        "avatar",
        "Address of the avatar (e.g. Safe)",
        undefined,
        types.string
    )
    .addParam("guard", "Address of the guard", undefined, types.string)
    .setAction(async (
        taskArgs,
        hardhatRuntime: HardhatRuntimeEnvironment
    ) => {

        const guard = await hardhatRuntime.ethers.getContractAt("BlacklistGuard", taskArgs.guard);

        const safeDeployment = getSafeSingletonDeployment({ version: "1.3.0" });
        assert(safeDeployment !== undefined);
        const avatar = new Contract(taskArgs.avatar, safeDeployment.abi, hardhatRuntime.ethers.provider);


        const [user1] = await hardhatRuntime.ethers.getSigners();
        const data = avatar.interface.encodeFunctionData("setGuard(address)", [guard.address]);
        await sendSafeTransaction(user1, avatar, avatar.address, data, hardhatRuntime);


    });


/// Optional Use Case: Combine the BlacklistGuard and Delay Modifier

task("deployDelayProxy", "Deploys a Guard")
    .addParam("owner", "Address of the Owner", undefined, types.string)
    .addParam(
        "avatar",
        "Address of the avatar (e.g. Safe)",
        undefined,
        types.string
    )
    .addParam("target", "Address of the target", undefined, types.string)
    .addParam(
        "cooldown",
        "Cooldown in seconds that should be required after a oracle provided answer",
        24 * 3600,
        types.int,
        true
    )
    .addParam(
        "expiration",
        "Time duration in seconds for which a positive answer is valid. After this time the answer is expired",
        7 * 24 * 3600,
        types.int,
        true
    )
    .setAction(async (
        taskArgs,
        hardhatRuntime: HardhatRuntimeEnvironment
    ) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);


        const chainId = Number(await hardhatRuntime.getChainId());


        const factorAddress = CONTRACT_ADDRESSES[chainId]['factory']
        const factorABI = CONTRACT_ABIS['factory'];

        const { transaction } = deployAndSetUpModule(
            CONTRACT_ADDRESSES[chainId]['delay'],
            CONTRACT_ABIS['delay'],
            factorAddress,
            factorABI,
            {
                values: [
                    taskArgs.owner,
                    taskArgs.avatar,
                    taskArgs.target,
                    taskArgs.cooldown,
                    taskArgs.expiration,
                ],
                types: ["address", "address", "address", "uint256", "uint256"],
            },
            hardhatRuntime.ethers.provider,
            Number(chainId),
            Date.now().toString()
        );

        const deploymentTransaction = await caller.sendTransaction(transaction);
        const receipt = await deploymentTransaction.wait();
        console.log("Delay deployed to:", receipt.logs[1].address);
        return;


    });





task("enableDelayModule")
    .addParam(
        "avatar",
        "Address of the avatar (e.g. Safe)",
        undefined,
        types.string
    )
    .addParam("delay", "Address of the delay", undefined, types.string)
    .setAction(async (
        taskArgs,
        hardhatRuntime: HardhatRuntimeEnvironment
    ) => {

        const [user1] = await hardhatRuntime.ethers.getSigners();
        const delayModifier = new Contract(taskArgs.delay, CONTRACT_ABIS['delay'], hardhatRuntime.ethers.provider);

        const safeDeployment = getSafeSingletonDeployment({ version: "1.3.0" });
        assert(safeDeployment !== undefined);
        const avatar = new Contract(taskArgs.avatar, safeDeployment.abi, hardhatRuntime.ethers.provider);


        await delayModifier.connect(user1).enableModule(avatar.address);

        const data = avatar.interface.encodeFunctionData("enableModule(address)", [delayModifier.address]);
        await sendSafeTransaction(user1, avatar, avatar.address, data, hardhatRuntime);

    });


// task("sendSetTargetTxToDelay", "Block a target address.")
//     .addParam(
//         "avatar",
//         "The address of the guard that you are seting up.",
//         undefined,
//         types.string
//     )
//     .addParam("delay", "Address of the delay", undefined, types.string)
//     .addParam(
//         "guard",
//         "The address of the guard that you are seting up.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "target",
//         "The target address to be blocked.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "blockall",
//         "Block all access to the Target",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "blockdelegate",
//         "Block delegatedCall",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "funcsig",
//         "The signature of the target blocked function",
//         null,
//         types.string
//     )
//     .addParam(
//         "blockfunc",
//         "Block the target function",
//         false,
//         types.boolean
//     )
//     .setAction(async (taskArgs, hardhatRuntime) => {
//         const [caller] = await hardhatRuntime.ethers.getSigners();
//         console.log("Using the account:", caller.address);

//         const guard = await hardhatRuntime.ethers.getContractAt(
//             "BlacklistGuard",
//             taskArgs.guard
//         );

//         const delayABI = CONTRACT_ABIS['delay'].slice();
//         delayABI.push("function execTransactionFromModule(address,uint256,bytes,uint8) public returns (bool success)")

//         const delayModifier = new Contract(taskArgs.delay, delayABI, hardhatRuntime.ethers.provider);

//         const safeDeployment = getSafeSingletonDeployment({ version: "1.3.0" });
//         assert(safeDeployment !== undefined);
//         const avatar = new Contract(taskArgs.avatar, safeDeployment.abi, hardhatRuntime.ethers.provider);

//         const [user1] = await hardhatRuntime.ethers.getSigners();

//         let funcHash = "0x00000000";
//         if (taskArgs.funcsig !== null) {
//             funcHash = keccak256(utils.toUtf8Bytes(taskArgs.funcsig)).slice(0, 10);
//         }

//         const data = await guard.interface.encodeFunctionData("setTarget",
//             [taskArgs.target,
//             taskArgs.blockall,
//             taskArgs.blockdelegate,
//                 funcHash,
//             taskArgs.blockfunc])

//         const delayData = delayModifier.interface.encodeFunctionData("execTransactionFromModule(address,uint256,bytes,uint8)", [guard.address, 0, data, 0]);

//         await sendSafeTransaction(user1, avatar, delayModifier.address, delayData, hardhatRuntime);

//     });


// task("execDelayedSetTarget", "Block a target address.")
//     .addParam("delay", "Address of the delay", undefined, types.string)
//     .addParam(
//         "guard",
//         "The address of the guard that you are seting up.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "target",
//         "The target address to be blocked.",
//         undefined,
//         types.string
//     )
//     .addParam(
//         "blockall",
//         "Block all access to the Target",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "blockdelegate",
//         "Block delegatedCall",
//         false,
//         types.boolean
//     )
//     .addParam(
//         "funcsig",
//         "The signature of the target blocked function",
//         null,
//         types.string
//     )
//     .addParam(
//         "blockfunc",
//         "Block the target function",
//         false,
//         types.boolean
//     )
//     .setAction(async (taskArgs, hardhatRuntime) => {
//         const [caller] = await hardhatRuntime.ethers.getSigners();
//         console.log("Using the account:", caller.address);

//         const guard = await hardhatRuntime.ethers.getContractAt(
//             "BlacklistGuard",
//             taskArgs.guard
//         );

//         const delayABI = CONTRACT_ABIS['delay'].slice();
//         delayABI.push("function execTransactionFromModule(address,uint256,bytes,uint8) public returns (bool success)")
//         delayABI.push("function executeNextTx(address,uint256,bytes,uint8) public")

//         const delayModifier = new Contract(taskArgs.delay, delayABI, hardhatRuntime.ethers.provider);


//         const [user1] = await hardhatRuntime.ethers.getSigners();

//         let funcHash = "0x00000000";
//         if (taskArgs.funcsig !== null) {
//             funcHash = keccak256(utils.toUtf8Bytes(taskArgs.funcsig)).slice(0, 10);
//         }

//         const data = await guard.interface.encodeFunctionData("setTarget",
//             [taskArgs.target,
//             taskArgs.blockall,
//             taskArgs.blockdelegate,
//                 funcHash,
//             taskArgs.blockfunc])

//         await delayModifier.connect(user1).executeNextTx(guard.address, 0, data, 0);

//     });




const sendSafeTransaction = async (user1: Signer, avatar: Contract, to: string, data: string, hardhatRuntime: HardhatRuntimeEnvironment) => {
    const nonce = await avatar.nonce()
    const addressZero = hardhatRuntime.ethers.constants.AddressZero

    const transHash = await avatar.connect(user1).getTransactionHash(to, 0, data, 0, 0, 0, 0, addressZero, addressZero, nonce);
    const typedDataHash = utils.arrayify(transHash)
    const signature = (await user1.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20");
    await avatar.connect(user1).execTransaction(to, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature);
}


export { };