import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy-all", "Deploys and verifies contracts")
    .addParam("owner", "Address of the Owner", undefined, types.string)
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        await hre.run("deploy-verify");
        const jsonPath = "./deployments/" + hre.hardhatArguments.network + "/BlacklistGuard.json"
        await hre.run("deployProxy", { deploymentjson: jsonPath, owner: taskArgs.owner });
    });

export { }