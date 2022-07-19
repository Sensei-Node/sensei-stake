const { network } = require("hardhat");
require('dotenv').config({ path: require('find-config')('.env') })

const deploymentVariables = {
    servicesToDeploy: [1, 5].includes(network.config.chainId) ? 2 : 3,
    depositContractAddress: {
        1: '0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b',
        5: '0x00000000219ab540356cBB839Cbe05303d7705Fa'
    },
    keystorePassword: process.env.VALIDATOR_PASSPHRASE,
    waitConfirmations: [1, 5].includes(network.config.chainId) ? 4 : 0,
}

const mappingChainId = {
    mainnet: 1,
    goerli: 5
}

module.exports = { deploymentVariables, mappingChainId }