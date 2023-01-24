// RUN WITH
// npx hardhat run scripts/ssv-scripts/ssv-register-validator.js --network goerli

// We need to have defined first before running:
// 1. contractABI.json: comes from the ssv-network smart contract (actually from the proxy 0x3D776231fE7EE264c89a9B09647ACFD955cD1d9b)
// 2. operators.json: can be gathered from https://api.ssv.network/api/v1/operators?page=1&perPage=10
// 3. keystore.json: is the keystore generated from deploy-service-contract.js

// In the operators.json example file, the operators that were selected are:
// 1. Allnodes
// 2. ONEinfraNA
// 3. ChainLayer
// 4. SenseiNode

// HOW TO USE

// REQUIRED
// 1. Edit the keystore.json file with the according data
// 2. Change in this file the keystorePassword according to the keystore

// OPTIONAL
// 1. If desired change operators.json file with desired operators
// 2. Change in this file the ValidatorManagerAddress if desired

const { deploymentVariables } = require("../../helpers/variables");

// Import Dependencies
const { SSVKeys } = require('ssv-keys');
const ABI = require('./SSVNetworkContractABI.json');
const TokenABI = require('./SSVTokenABI.json');
const ContractAddress = '0xb9e155e65B5c4D66df28Da8E9a0957f06F11Bc04';
const SSVTokenContractAddress = '0x3a9f01091C446bdE031E39ea8354647AFef091E7';

const keystore = require('./keystore.json');
const keystorePassword = deploymentVariables.keystorePasswordSSVTest;

const operators = require("./operators.json");
const operatorKeys = operators.operators;
const operatorIds = operators.operators_ids;

async function main() {
  // Step 1: read keystore file
  const ssvKeys = new SSVKeys();
  const privateKey = await ssvKeys.getPrivateKeyFromKeystoreData(keystore, keystorePassword);

  // Step 2: Build shares from operator IDs and public keys
  const threshold = await ssvKeys.createThreshold(privateKey, operatorIds);
  const shares = await ssvKeys.encryptShares(operatorKeys, threshold.shares);

  const ssv_amount_in_wei = '10000000000000000000';

  // Step 3: Build final web3 transaction payload
  const payload = await ssvKeys.buildPayload(
    threshold.validatorPublicKey,
    operatorIds,
    shares,
    ssv_amount_in_wei,
  );

  return [
    payload[0],
    payload[1].split(','),
    payload[2],
    payload[3],
    payload[4]
  ]
}

// Deploy with hardhat
main()
  .then(async (res) => {
    deploy(res)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


async function deploy(res) {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  // ABI, Contract Address, Signer
  const contract = await ethers.getContractAt(ABI, ContractAddress, deployer);
  // ! importante, hay que darle allowance al contrato de los SSV tokens
  const tokenContract = await ethers.getContractAt(TokenABI, SSVTokenContractAddress, deployer);
  const aproval = await tokenContract.approve(ContractAddress, res[4]) // for approving ssv token expense
  aproval.wait(3); // wait for the approval to finish
  // console.log(aproval);
  const contract_res = await contract.registerValidator(...res); // for registering validator v2
  contract_res.wait(3); // wait for the registration to finish
  console.log('\n\n...SUCCESS!\n\n')
  // console.log(contract_res);
}