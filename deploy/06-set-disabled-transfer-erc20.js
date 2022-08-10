const { utils } = ethers;
const { keccak256 } = utils;

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
    console.log("... Seteando transfer.erc20 == disabled ...");
    // disabling transfers
    const contractDeployment = await deployments.get("SenseistakeERC721")
    const tx = await storageContract.setBool(
        keccak256(ethers.utils.solidityPack(["string", "address"], ["transfer", contractDeployment.address])),
        true
    );
}

module.exports.tags = ["disable-erc20-transfer"]