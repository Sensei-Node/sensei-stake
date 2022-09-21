# Sensei Stake ETH 2.0

## Description 

This project is a non-custodial staking platform to Ethereum 2. When you create a validator you receive a NFT refering to your new validator. 

## Technical Description

To create a service contract we do it with [Clone proxy](#clone)<sup>1</sup>. To do that we need a salt (a unique identifier) and the contract implementation. We use a numeric sequence for the salt and use it as the nft tokenId. 
The process of the create a validator we do it in a just simple function call createContract with no paramter, just the msg.value with 32 ethers.
The create of services contract is made in the createContract. 


<sup>1</sup><a name="clone"></a><sub>The Clones library provides a way to deploy minimal non-upgradeable proxies for cheap. This can be useful for applications that require deploying many instances of the same contract (for example one per user, or one per task). These instances are designed to be both cheap to deploy, and cheap to call.</sub>

## Useful commands 

```shell
npx hardhat compile (the compile run in all the other calls before test or deploy)
npx hardhat test
npx hardhat deploy --network goerli 

you can use tags to deploy diferent part of the deploy --tags XXX 
```

---
## Deploy details

The deploy was made using [hardhat-deplpy plugin](https://github.com/wighawag/hardhat-deploy "hardhat-deplpy plugin").

Is orgranized in 4 files described in following: 

`00-deploy-deposit-contract.js` (tags : "all", "deposit_contract" )

Deploy the deposit service contract in case we want to test using our deposit contract.

`00-deploy-service-implementation.js`  (tags: "all", "service_implementation")

This deploy uses some method from  `lib/senseistake-services-contract.mjs`.
- * This deploy create the clone of service contract using a proxy
- * create the deposit data with pubkey, depositSignature, and depositDataRoot to be able for the validator creation. 
- All this information is stored in the backend

`01-deploy-erc721.js` (tags:  "all", "erc721" )

Deploy the ERC721 contract. This is the new entry point.

`02-add-validaror-erc721.js` (tags:  "all", "factory" )

## Step By Step Deploy

- `npx hardhat compile`
- `cp .env.default .env` and update its values
- `npx hardhat deploy --network goerli`

---

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

--- 

## Notes

### Goerli **DepositContract** address

``0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b``

### Mainnet **DepositContract** address

``0x00000000219ab540356cBB839Cbe05303d7705Fa``

## How does it work?
- The process starts with a user that call to SenseiStake-->createContract with 32 eth.  
- This process : 
  - clones the Service contract, 
  - send the ether to the desposit contract, 
  - create validator  
  - mint the nft
- After this process the state is setted to PostDeposit. 
- So far the user is an active validator. 
- At this moment the user has to wait to withdraw to 
- Once the validator is decided to be stopped , the deposit is able to be withdrawn (we'll need to see how things are handled after the merge). After this, the validator funds go to the services smart contract address. Then the function ``endOperatorServices`` can be called, which triggers a change of state in the smart contract, from ``PostDeposit`` to ``Withdrawn``. Only in this state, clients (and the operator) are able to withdraw their initial investments (and/or revenues) (this must be done by operator or the depositor after exit date).
- Clients are the ones that are able to use the ``withdraw`` or ``withdrawAll`` to withdraw their deposit. What they can withdraw are their initial deposit plus earnings minus operator fees.
- If the operator wants to withdraw its earnings (collected fees of clients), it can do it calling the function ``operatorClaim``.

## Sequence diagrams 

### Deposit 32 eth

![Deposit 32Eth - SenseiStake.drawio.png](readme_assets/deposit32Eth.png)



### Create a validator

![Create a Validator - SenseiStake.drawio.png](readme_assets/createValidator.png)



## Complete diagram of all process
![Complete Diagram - SenseiStake.drawio.png](readme_assets/diagramaUIsenseistakeNFT.png)
