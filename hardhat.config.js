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
require('./scripts/ssv-scripts/ssv-register-task');

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
        version: "0.8.17",
      },
      {
        version: "0.8.18",
        settings: {},
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
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
    chiado: {
      url: "https://rpc.chiadochain.net",
      accounts: [process.env.ACCOUNT_PK_GOERLI, process.env.ACCOUNT_PK_GOERLI_ALICE, process.env.ACCOUNT_PK_GOERLI_BOB],
      chainId: 10200,
      gasPrice: 1000000000,
      type: 'testnet',
      name: 'chiado'
    },
    polyedge: {
      url: "http://18.219.1.98:8545",
      accounts: [process.env.ACCOUNT_PK_GOERLI, process.env.ACCOUNT_PK_GOERLI_ALICE, process.env.ACCOUNT_PK_GOERLI_BOB],
      chainId: 100,
      type: 'testnet',
      name: 'polyedge'
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
    mainnet: {
      url: process.env.MAINNET_RPC,
      accounts: [process.env.ACCOUNT_PK_MAINNET],
      chainId: 1,
      type: 'mainnet',
      name: 'mainnet'
    },
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

  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_KEY
  // },

  etherscan: {
    customChains: [
      {
        network: "chiado",
        chainId: 10200,
        urls: {
          //Blockscout
          apiURL: "https://blockscout.com/gnosis/chiado/api",
          browserURL: "https://blockscout.com/gnosis/chiado",
        },
      },
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          // 3) Select to what explorer verify the contracts
          // Gnosisscan
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io/",
          // Blockscout
          //apiURL: "https://blockscout.com/xdai/mainnet/api",
          //browserURL: "https://blockscout.com/xdai/mainnet",
        },
      },
    ],
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY,
      chiado: "your key",
      gnosis: "your key",
    },
  },

  mocha: {
    timeout: 1000000000
  },
};
