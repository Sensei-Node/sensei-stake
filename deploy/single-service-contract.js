const { deployServiceContract } = require("../scripts/full-service-contract-deploy");

module.exports = async ({deployments, upgrades,  run}) => {
    // console.log('\nDeploying single contract\n')
    // let service_contract = await deployServiceContract(deployments, upgrades, run);
}

module.exports.tags = ["single-service-contract"]