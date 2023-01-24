// RUN WITH
// npx hardhat run scripts/ssv-scripts/ssv-register-validator.js --network goerli

// We need to have defined first before running:
// 1. SSVNetworkContractABI.json: comes from the ssv-network smart contract (actually from the proxy 0x3D776231fE7EE264c89a9B09647ACFD955cD1d9b)
// 2. SSVTokenABI.json: comes from the ssv token smart contract 0x3a9f01091C446bdE031E39ea8354647AFef091E7
// 3. operators.json: can be gathered from https://api.ssv.network/api/v1/operators?page=1&perPage=10
// 4. keystores folder: keystores generated from deploy-service-contract.js

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


task("ssv-register", "Registers a validator into SSV network")
  .addParam("pubkey", "The validator public key")
  .setAction(async (taskArgs, hre) => {
    const { deploymentVariables } = require("../../helpers/variables");

    // Import Dependencies
    const { SSVKeys } = require('ssv-keys');
    const ABI = require('./SSVNetworkContractABI.json');
    const TokenABI = require('./SSVTokenABI.json');
    const ContractAddress = '0xb9e155e65B5c4D66df28Da8E9a0957f06F11Bc04';
    const SSVTokenContractAddress = '0x3a9f01091C446bdE031E39ea8354647AFef091E7';

    // const keystorePassword = deploymentVariables.keystorePasswordSSVTest;
    const keystorePassword = deploymentVariables.keystorePassword;

    const operators = require("./operators.json");
    const operatorKeys = operators.operators;
    const operatorIds = operators.operators_ids;

    const fs = require('fs');
    const path = require('path');

    const getFilesRecursive = (dir) => {
      let files = [];
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          files = files.concat(getFilesRecursive(filePath));
        } else {
          if (filePath.includes('keystore-m_12381_3600')) {
            const keystore = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if ('0X'+keystore.pubkey.toUpperCase() == taskArgs.pubkey.toUpperCase()) {
              files.push(filePath);
            }
          }
        }
      });
      return files;
    };
    
    const keystores_files = getFilesRecursive('keystores');
    if (keystores_files.length != 0) {
      let keystore = fs.readFileSync(keystores_files[0], 'utf8');
      keystore = JSON.parse(keystore);
      console.log("\nRegistering into SSV network pubkey:", keystore.pubkey);

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

      const validator_payload = [
        payload[0],
        payload[1].split(','),
        payload[2],
        payload[3],
        payload[4]
      ]
      
      const [ deployer ] = await ethers.getSigners();
      
      // ABI, Contract Address, Signer
      const contract = await ethers.getContractAt(ABI, ContractAddress, deployer);
      // ! importante, hay que darle allowance al contrato de los SSV tokens
      const tokenContract = await ethers.getContractAt(TokenABI, SSVTokenContractAddress, deployer);

      const aproval = await tokenContract.approve(ContractAddress, validator_payload[4]) // for approving ssv token expense
      aproval.wait(2); // wait for the approval to finish

      const contract_res = await contract.registerValidator(...validator_payload); // for registering validator v2
      contract_res.wait(2); // wait for the registration to finish
      console.log('Successfully registered new validator!\n')
    }
  });
