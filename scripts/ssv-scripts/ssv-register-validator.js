// RUN WITH
// npx hardhat run scripts/ssv-scripts/ssv-register-validator.js --network goerli

// We need to have defined first before running:
// 1. contractABI.json: comes from the ssv-network smart contract (actually from the proxy 0x687fb596F3892904F879118e2113e1EEe8746C2E)
// 2. operators.json: can be gathered from https://ssv-api.ssv.network/api/v1/operators?validatorsCount=true&ordering=validators_count:desc&page=1&perPage=10
// 3. keystore.json: is the keystore generated from deploy-service-contract.js

// In the operators.json example file, the operators that were selected are:
// 1. SenseiNode
// 2. Cryptomanufaktur
// 3. NodesGuru
// 4. DragonStake

// HOW TO USE

// REQUIRED
// 1. Edit the keystore.json file with the according data
// 2. Change in this file the keystorePassword according to the keystore

// OPTIONAL
// 1. If desired change operators.json file with desired operators
// 2. Change in this file the ValidatorManagerAddress if desired

// Notes on v2
// There is a slight change from v1, doesnt require a manager any longer, 
// and addedd fees total cost, also replaced operatorsPublicKeys with its ids
const { deploymentVariables } = require("../helpers/variables");

// Import Dependencies
const Web3 = require('web3');
const { encode } = require('js-base64');
const { EthereumKeyStore, Encryption, Threshold } = require('ssv-keys');
// const ABI = require('./contractABI.json'); // v1
const ABI = require('./contractABI.v2.json');
// this is the proxt contract address from ssv-network v1
// const ContractAddress = '0x687fb596F3892904F879118e2113e1EEe8746C2E'; // v1
const ContractAddress = '0x8feA36b975933A4ee73C31336cE013c45a11feC7';
// this is is the manager account (the one that can do further modifications to the validator) v1
// const ValidatorManagerAddress = '0xe44a718817387e585B3dFc775212C88c68e60a58'; // v2 doesnt use it any longer

// Get required data from the keystore file
const keystore = require('./keystore.json');
const keystorePassword = deploymentVariables.keystorePassword;

async function main() {
  // -------------------------------------------- STEP 1: Parse the keystore
  // Get the private key from the keystore using the keystore password
  const keyStore = new EthereumKeyStore(JSON.stringify(keystore)); // Get public key using the keystore password
  const publicKey = await keyStore.getPublicKey(keystorePassword); // Get private key using the keystore password
  const privateKey = await keyStore.getPrivateKey(keystorePassword);
  // Log the keys
  // console.debug("Public Key (keystore): " + publicKey);
  // console.debug("Private Key (keystore): " + privateKey);

  // -------------------------------------------- STEP 2: Build the shares\
  // const operators = require("./operators.json"); // v1
  const operators_v2 = require("./operators.v2.json");
  const operators = operators_v2.operators;
  const operators_ids = operators_v2.operators_ids;
  // Initialize the Threshold class
  const thresholdInstance = new Threshold();
  // Create the threshold instance using the private key
  const threshold = await thresholdInstance.create(privateKey); // Build the shares using an array of operator public keys
  let shares = new Encryption(operators, threshold.shares).encrypt();
  // Loop through the operators RSA keys and format them as base64
  shares = shares.map((share) => {
    share.operatorPublicKey = encode(share.operatorPublicKey);
    return share;
  });

  // -------------------------------------------- STEP 3: Build transaction payload
  // Initialize the web3 class
  const web3 = new Web3();
  // Loop through the operators and encode them as ABI parameters
  // const operatorsPublicKeys = operators.map((operator) =>
  //   web3.eth.abi.encodeParameter("string", encode(operator))
  // ); // Get all the public keys from the shares  v1
  const sharePublicKeys = shares.map((share) => share.publicKey); // Get all the private keys from the shares and encode them as ABI parameters
  const shareEncrypted = shares.map((share) =>
    web3.eth.abi.encodeParameter("string", share.privateKey)
  );
  // Token amount (liquidation collateral and operational runway balance to be funded)
  // Taken from the fee value (sum of all the operators selected)
  const tokenAmount = web3.utils.toBN(33226996920000).toString();

  // Return all the needed params to build a transaction payload
  return [
    // ValidatorManagerAddress,
    threshold.validatorPublicKey, // this is the validator public key (the one in the keystore)
    operators_ids,
    // operatorsPublicKeys, // this is an base64 encoded operator public keys (can be taken from the API specified in step 2)
    sharePublicKeys, // generated field
    shareEncrypted, // generated field,
    tokenAmount
  ];
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
  // const contract_res = await contract.operatorCount(); // for testing
  // const contract_res = await contract.addValidator(...res); // for registering validator v1
  const contract_res = await contract.registerValidator(...res); // for registering validator v2
  console.log(contract_res);
}