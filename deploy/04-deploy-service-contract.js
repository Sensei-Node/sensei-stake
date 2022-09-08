const axios = require('axios');
const { BigNumber, utils } = ethers;
const { deploymentVariables } = require("../helpers/variables");
const strapi_url = process.env.STRAPI_URL;
const { deployServiceContract } = require("../scripts/full-service-contract-deploy");

module.exports = async ({deployments, upgrades, run}) => {
    let jwt;
    try {
        let { data } = await axios.post(strapi_url+'/auth/local', {
            identifier: process.env.STRAPI_OPERATOR_IDENTIFIER,
            password: process.env.STRAPI_OPERATOR_PASSWORD
        });
        jwt = data.jwt;
    } catch (err) {
        console.error(err);
    }

    const serviceContractDeploys = deploymentVariables.servicesToDeploy;

    for (let index = 1; index <= serviceContractDeploys; index++) {
        let service_contract = await deployServiceContract(deployments, upgrades, run, jwt);
    
        console.log("\n-- Validator (operator) deposit data --")
        // console.log("\n** Validator PRIVATE key: ", utils.hexlify(operatorPrivKey.toBytes()), "**\n");
        console.log("Validator public address: ", utils.hexlify(service_contract.depositData.validatorPubKey));
        console.log("Validator deposit signature: ", utils.hexlify(service_contract.depositData.depositSignature));
        console.log("Validator deposit data root: ", utils.hexlify(service_contract.depositData.depositDataRoot));
        console.log("Exit date: ", utils.hexlify(service_contract.exitDate));
        console.log("-- EOF --\n")
    
        console.log("\n-- Validator (operator) keystore --")
        console.log(JSON.stringify(service_contract.keystore));
        console.log("-- EOF --\n")
    }    
}

module.exports.tags = ["all", "service-contract"]