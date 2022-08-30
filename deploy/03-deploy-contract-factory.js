const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const { deploymentVariables } = require("../helpers/variables");
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/contract-factory'

module.exports = async ({
    deployments,
    upgrades, 
    run
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    const storageDeployment = await deployments.get("SenseistakeStorage")
    const args = [100_000, storageDeployment.address];

    const senseistakeFactory = await deploy("SenseistakeServicesContractFactory", {
        contract: "SenseistakeServicesContractFactory",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    const tokenDeployment = await deployments.get("SenseistakeERC721");
    const SenseistakeERC721 = await ethers.getContractFactory('SenseistakeERC721');
    const ERC721 = await SenseistakeERC721.attach(tokenDeployment.address);
    await ERC721.connect(deployer).setFactory(senseistakeFactory.address);

    let jwt;
    try {
        let { data } = await axios.post(strapi_url+'/auth/local', {
            identifier: process.env.STRAPI_OPERATOR_IDENTIFIER,
            password: process.env.STRAPI_OPERATOR_PASSWORD
        });
        jwt = data.jwt;
            await axios.put(strapi_url+strapi_path, {
                address: senseistakeFactory.address
            }, { headers: { authorization: `Bearer ${jwt}` }});
    } catch (err) {
        console.error(err);
    }

    // if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
    //     await verify(senseistakeFactory.address, args)
    // }
}

module.exports.tags = ["all", "factory"]