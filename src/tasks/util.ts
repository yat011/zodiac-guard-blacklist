import { calculateProxyAddress } from "@gnosis.pm/zodiac/dist/src/factory/factory";
import { BigNumber, Contract, ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";


export const deployAndSetUpModule = (
    masterCopyAddress: string,
    masterCopyABI: string[],
    factoryAddress: string,
    factoryABI: string[],
    args: {
        types: Array<string>;
        values: Array<any>;
    },
    provider: JsonRpcProvider,
    chainId: number,
    saltNonce: string
) => {

    const module = new Contract(masterCopyAddress, masterCopyABI, provider);
    const factory = new Contract(factoryAddress, factoryABI, provider);


    const encodedInitParams = new ethers.utils.AbiCoder().encode(
        args.types,
        args.values
    );
    const moduleSetupData = module.interface.encodeFunctionData("setUp", [
        encodedInitParams,
    ]);

    const expectedModuleAddress = calculateProxyAddress(
        factory,
        module.address,
        moduleSetupData,
        saltNonce
    );

    const deployData = factory.interface.encodeFunctionData("deployModule", [
        module.address,
        moduleSetupData,
        saltNonce,
    ]);
    const transaction = {
        data: deployData,
        to: factory.address,
        value: BigNumber.from(0),
    };
    return {
        transaction,
        expectedModuleAddress,
    };
};