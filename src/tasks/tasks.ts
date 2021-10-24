import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@gnosis.pm/zodiac";
import { deployAndSetUpModule } from "./util";
import { utils } from "ethers";
import { keccak256 } from "ethers/lib/utils";

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

task("setTarget", "Block a target address.")
    .addParam(
        "guard",
        "The address of the guard that you are seting up.",
        undefined,
        types.string
    )
    .addParam(
        "target",
        "The target address to be blocked.",
        undefined,
        types.string
    )
    .addParam(
        "blockall",
        "Block all access to the Target",
        false,
        types.boolean
    )
    .addParam(
        "blockdelegate",
        "Block delegatedCall",
        false,
        types.boolean
    )
    .addParam(
        "funcsig",
        "The signature of the target blocked function",
        null,
        types.string
    )
    .addParam(
        "blockfunc",
        "Block the target function",
        false,
        types.boolean
    )
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);

        const guard = await hardhatRuntime.ethers.getContractAt(
            "BlacklistGuard",
            taskArgs.guard
        );
        let funcHash = "0x00000000";
        if (taskArgs.funcsig !== null) {
            funcHash = keccak256(utils.toUtf8Bytes(taskArgs.funcsig)).slice(0, 10);
        }

        await guard.setTarget(
            taskArgs.target,
            taskArgs.blockall,
            taskArgs.blockdelegate,
            funcHash,
            taskArgs.blockfunc
        );

        console.log("Target blocked: ", taskArgs);
    });

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



export { };