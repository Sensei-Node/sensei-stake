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
    const contracts = ['SenseistakeStorage','SenseistakeERC721', 'SenseistakeServicesContractFactory']
    
    let tx;
    for(contract_name of contracts){
        console.log('... Seteando variables', contract_name, '...')
        const contractDeployment = await deployments.get(contract_name)
        tx = await storageContract.setBool(
            keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.exists", contractDeployment.address])),
            true
        );
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await tx.wait(1);
        }
        // Register the contract's name by address
        tx = await storageContract.setString(
            keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.name", contractDeployment.address])),
            contract_name
        );
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await tx.wait(1);
        }
        // Register the contract's address by name
        tx = await storageContract.setAddress(
            keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.address", contract_name])),
            contractDeployment.address
        );
        console.log(contract_name, contractDeployment.address, keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.address", contract_name])))
        if (['testnet', 'mainnet'].includes(network.config.type)) {
            await tx.wait(1);
        }
        // const artifact = await deployments.getArtifact('SenseistakeStorage');
        // // Compress and store the ABI by name
        // await storageContract.setString(
        //     keccak256(ethers.utils.solidityPack(["string", "string"], ["contract.abi", contract_name])),
        //     compressABI(artifact.abi)
        // );
    }

    // disabling transfers
    const contractDeployment = await deployments.get("SenseistakeERC721")
    tx = await storageContract.setBool(
        keccak256(ethers.utils.solidityPack(["string", "address"], ["contract.exists", contractDeployment.address])),
        true
    );

    // This method seals the storage for new storage, wont allow operator to add new entries to storage
    // is it is set to true
    // await storageContract.setDeployedStatus();
}

module.exports.tags = ["all", "mappings"]