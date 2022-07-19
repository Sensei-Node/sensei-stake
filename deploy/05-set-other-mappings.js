const { network } = require("hardhat")
const pako = require('pako');
const { utils } = ethers;
const { keccak256 } = utils;
const { deploymentVariables } = require("../helpers/variables");

// Compress / decompress ABIs
function compressABI(abi) {
    return Buffer.from(pako.deflate(JSON.stringify(abi))).toString('base64');
}

// Load ABI files and parse
function loadABI(abiFilePath) {
    return JSON.parse(config.fs.readFileSync(abiFilePath));
}

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const storageDeployment = await deployments.get('SenseistakeStorage')
    const contr = await ethers.getContractFactory(
        'SenseistakeStorage'
    );
    const storageContract = await contr.attach(storageDeployment.address);
    const factoryDeployment = await deployments.get("SenseistakeServicesContractFactory");
    const FactoryContract = await ethers.getContractFactory(
        'SenseistakeServicesContractFactory'
    );
    const factoryContract = await FactoryContract.attach(factoryDeployment.address);
    // const serviceContractIndex = await factoryContract.getLastIndexServiceContract();
    const serviceContractIndex = deploymentVariables.servicesToDeploy;
    const contracts = ['SenseistakeStorage','SenseistakeERC20Wrapper', 'SenseistakeServicesContractFactory']
    for( let i = 1 ; i <= serviceContractIndex; i++) {
        contracts.push("SenseistakeServicesContract"+i)
    }
    for(contract_name of contracts){
        console.log('... Seteando variables', contract_name, '...')
        const contractDeployment = await deployments.get(contract_name)
        await storageContract.setBool(
            keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.exists", contractDeployment.address])),
            true
        );
        // Register the contract's name by address
        await storageContract.setString(
            keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.name", contractDeployment.address])),
            contract_name
        );
        
        // Register the contract's address by name
        await storageContract.setAddress(
            keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.address", contract_name])),
            contractDeployment.address
        );
        
        // const artifact = await deployments.getArtifact('SenseistakeStorage');
        // // Compress and store the ABI by name
        // await storageContract.setString(
        //     keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.abi", contract_name])),
        //     compressABI(artifact.abi)
        // );
    }
}

module.exports.tags = ["all", "mappings"]