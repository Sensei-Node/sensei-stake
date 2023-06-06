const { network } = require("hardhat");
require('dotenv').config({ path: require('find-config')('.env') })

const waitConfirmations = {
    ganache: 0,
    hardhat: 0,
    testnet: 2,
    mainnet: 2
}

const deploymentVariables = {
    servicesToDeploy: ['testnet', 'mainnet'].includes(network.config.type) ? 70 : 70,
    depositContractAddress: {
        1: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
        5: '0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b',
        100: '0x0B98057eA310F4d31F2a452B414647007d1645d9',
        10200: '0xb97036A26259B7147018913bD58a774cf91acf25',
    },
    tokenDeployed: {
        1: {
            name: 'SenseiStake Ethereum Validator',
            symbol: 'SSEV'
        },
        5: {
            name: 'SenseiStake Ethereum Validator',
            symbol: 'SSEV'
        },
        100: {
            name: 'SenseiStake Gnosis Validator',
            symbol: 'SSGV'
        },
        10200: {
            name: 'SenseiStake Gnosis Validator',
            symbol: 'SSGV'
        },
        31337: {
            name: 'SenseiStake Hardhat Validator',
            symbol: 'SSHV'
        }
    },
    senseiStakeV1Address: {
        1: '0x2421A0aF8baDfAe12E1c1700E369747D3DB47B09',
        5: '0x953AD21B031A25C5fC75DeaA7A1c3a1520cAC13d'
    },
    senseistakeMetadataAddress: {
        1: '',
        5: '0x54D90D50C598b3b5C8d0dafE1894f17A85fe2CE7'
    },
    gnoContractAddress: {
        100: '',
        10200: '0x19C653Da7c37c66208fbfbE8908A5051B57b4C70',
        31337: '0x19C653Da7c37c66208fbfbE8908A5051B57b4C70'
    },
    keystorePassword: process.env.VALIDATOR_PASSPHRASE,
    keystorePasswordSSVTest: process.env.VALIDATOR_PASSPHRASE_SSV_TEST,
    waitConfirmations: waitConfirmations[network.config.type],
}

module.exports = { deploymentVariables, waitConfirmations }