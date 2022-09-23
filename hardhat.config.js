require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('hardhat-contract-sizer');
require('hardhat-docgen');
require('hardhat-storage-layout');
require('solidity-coverage');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('dotenv').config({ path: require('find-config')('.env') })

// Need to compile first
task('storage', 'Print storage layout', async (taskArgs, hre) => {
  await hre.storageLayout.export();
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.8.4",
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    }
  },

  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      type: 'hardhat',
      name: 'hardhat'
    },
    goerli: {
      url: process.env.GOERLI_RPC,
      accounts: [process.env.ACCOUNT_PK_GOERLI, process.env.ACCOUNT_PK_GOERLI_ALICE, process.env.ACCOUNT_PK_GOERLI_BOB],
      chainId: 5,
      type: 'testnet',
      name: 'goerli'
    },
    ganache: {
      url: process.env.GANACHE_RPC,
      accounts: [process.env.ACCOUNT_PK_GANACHE, process.env.ACCOUNT_PK_GANACHE_ALICE, process.env.ACCOUNT_PK_GANACHE_BOB],
      type: 'ganache',
      name: 'ganache'
    },
    // mainnet: {
    //   url: process.env.MAINNET_RPC,
    //   accounts: [process.env.ACCOUNT_PK_MAINNET],
    //   chainId: 1,
    //   type: 'mainnet',
    //   name: 'mainnet'
    // },
  },

  gasReporter: {
    enabled: true,
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },

  mocha: {
    timeout: 1000000000
  },
};
