const { network } = require("hardhat");
require('dotenv').config({ path: require('find-config')('.env') })

const waitConfirmations = {
    ganache: 0,
    hardhat: 0,
    testnet: 2,
    mainnet: 2
}

const deploymentVariables = {
    servicesToDeploy: ['testnet', 'mainnet'].includes(network.config.type) ? 10 : 2,
    depositContractAddress: {
        1: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
        5: '0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b',
        1337903:'0x4242424242424242424242424242424242424242'
    },
    keystorePassword: process.env.VALIDATOR_PASSPHRASE,
    waitConfirmations: waitConfirmations[network.config.type],
}

const mappingChainId = {
    mainnet: 1,
    goerli: 5,
    shandong:1337903
}

// const forkVersion = {
//     mainnet: '00000000',
//     goerli: '00001020'
// }

module.exports = { deploymentVariables, mappingChainId, waitConfirmations }