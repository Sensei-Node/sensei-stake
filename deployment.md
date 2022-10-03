# Deployment

## Deploy details

The deploy was made using [hardhat-deplpy plugin](https://github.com/wighawag/hardhat-deploy "hardhat-deplpy plugin").

Is orgranized in 4 files described in following: 

`00-deploy-deposit-contract.js` (tags : "all", "deposit_contract" )

Deploy the deposit service contract in case we want to test using our deposit contract.

`00-deploy-service-implementation.js`  (tags: "all", "service_implementation")

This step deploy the implementation of the service conttract.

`01-deploy-erc721.js` (tags:  "all", "erc721" )

Deploy the ERC721 contract. This is the new entry point.

`02-add-validaror-erc721.js` (tags:  "all", "service_contract" )

This deploy uses some method from  `lib/senseistake-services-contract.mjs`. 
This prepares all the data to create a validator. 

There is a variable called `start_`. This is the tokenId used as a key in the mapping validator. The first deploy must be 0 like follow: 
`const start_ = 0;` 
If you want to add more records in the validator mapping you need to change it using the index of the next tokenId.
for example: 
last tokenId in the mapping is 10 --> {validator data} the `start_` must be 11 like the following: 
`const start_ = 11;`
and run the deploy with the param : `--tags service_contract`

`03-verify-contracts.js`

This step verify all the contract in etherscan

## Step By Step Deploy

- `npx hardhat compile`
- `cp .env.default .env` and update its values
- `npx hardhat deploy --network goerli`

---
### Step 0 addValidator prerequisite

The deploy process ```02-add-validator-erc721``` to  need to populate the validator mapping with validator params. 


### Step 1 fund the service contract

The user must call the following method with msg.value. 
```
msg.value : multiple of 32 eth
```
SenseiStake.sol —> createContract
During this execution the following acctions happen :
1. For each 32 ethers using one salt to get to the serviceContract.
2. Deposit 32 ethers in each service contracts.


### Step 2 create validator

The user must call the createValidator method from the SenseistakeServicesContract. 

Call the following method to create the validator with parameters from the backend :

```jsx
Method : 
SenseistakeServicesContract —> createValidator(
 bytes calldata validatorPubKey,
 bytes calldata depositSignature,
 bytes32 depositDataRoot,
 uint64 exitDate); 
```

This creates a validator sending all the total supply to the ETH deposit contract. 

The service contract will have no eth after run it and keep it in the deposit address.
