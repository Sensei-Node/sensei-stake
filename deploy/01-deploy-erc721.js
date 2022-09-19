const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const { deploymentVariables } = require("../helpers/variables");
const axios = require('axios');
const strapi_url = process.env.STRAPI_URL;
const strapi_path = '/erc-721'

module.exports = async ({
    deployments,
}) => {
    const { deploy, log } = deployments;
    const [deployer] = await ethers.getSigners();

    // deposit contract address
    let ethDepositContractAddress;
    try {
        ethDepositContractAddress = await deployments.get("DepositContract");
        console.log(`\n --- UTILIZA DEPOSIT CONTRACT PROPIO: ${ethDepositContractAddress.address} --- \n`);
    } catch(err) {
        console.log('\n --- NO UTILIZA DEPOSIT CONTRACT PROPIO, USA EL DE LA RED --- \n');
        ethDepositContractAddress = deploymentVariables.depositContractAddress[network.config.chainId] ? 
        { address: deploymentVariables.depositContractAddress[network.config.chainId] } : { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' }
    }

    // name, symbol, commissionRate
    const args = ["SenseiStakeValidator", "SNSV", 100_000, ethDepositContractAddress.address];
    const senseistakeERC721 = await deploy("SenseiStake", {
        contract: "SenseiStake",
        from: deployer.address,
        args,
        log: true,
        waitConfirmations: deploymentVariables.waitConfirmations
    })

    if (['testnet', 'mainnet'].includes(network.config.type)) {
        let jwt;
        try {
            let { data } = await axios.post(strapi_url+'/auth/local', {
                identifier: process.env.STRAPI_OPERATOR_IDENTIFIER,
                password: process.env.STRAPI_OPERATOR_PASSWORD
            });
            jwt = data.jwt;
                await axios.put(strapi_url+strapi_path, {
                    address: senseistakeERC721.address
                }, { headers: { authorization: `Bearer ${jwt}` }});
        } catch (err) {
            console.error(err);
        }
    }

    if (['testnet', 'mainnet'].includes(network.config.type) && process.env.ETHERSCAN_KEY) {
        await verify(senseistakeERC721.address, args)
    }
}

module.exports.tags = ["all", "erc721"]