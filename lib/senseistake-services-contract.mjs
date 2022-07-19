"use strict";

const blsLib = await import("@chainsafe/bls");

try {
  await blsLib.init("blst-native");
} catch (e) {
  await blsLib.init("herumi");
  console.warn("Using WASM BLS");
}

export const { bls } = blsLib;

const ssz = await import("@chainsafe/ssz");
const { keccak256, solidityPack, getCreate2Address } = await import("ethers/lib/utils.js");

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const YEAR = 365 * DAY;
export const COMMISSION_RATE_SCALE = 1_000_000;

export const NETWORKS = {
  GOERLI: {
    FACTORY_ADDRESS: "",
    CONTRACT_IMPL_ADDRESS: "",
    CONTRACT_IMPL_ADDRESS: ""
  }
}

const DEPOSIT_AMOUNT = BigInt(32_000_000_000);
// const DEPOSIT_AMOUNT = BigInt(1_000_000_000);

export const DomainType = {
  BEACON_PROPOSER: 0,
  BEACON_ATTESTER: 1,
  RANDAO: 2,
  DEPOSIT: 3,
  VOLUNTARY_EXIT: 4,
  SELECTION_PROOF: 5,
  AGGREGATE_AND_PROOF: 6,
  SYNC_COMMITTEE: 7,
  SYNC_COMMITTEE_SELECTION_PROOF: 8,
  CONTRIBUTION_AND_PROOF: 9
}

export const State = {
  NotInitialized: 0,
  PreDeposit: 1,
  PostDeposit: 2,
  Withdrawn: 3
};

export const SignatureSchema = new ssz.ContainerType({
  fields: {
    rootHash: new ssz.ByteVectorType({
      length: 32,
    }),
    domain: new ssz.ByteVectorType({
      length: 32,
    })
  }
});

export const DepositMessageSchema = new ssz.ContainerType({
  fields: {
    validatorPubKey: new ssz.ByteVectorType({
      length: 48,
    }),
    withdrawalCredentials: new ssz.ByteVectorType({
      length: 32,
    }),
    depositAmount: new ssz.BigIntUintType({
      byteLength: 8,
    })
  }
});

export const DepositDataSchema = new ssz.ContainerType({
  fields: {
    pubKey: new ssz.ByteVectorType({
      length: 48,
    }),
    withdrawalCredentials: new ssz.ByteVectorType({
      length: 32,
    }),
    amount: new ssz.BigIntUintType({
      byteLength: 8,
    }),
    signature: new ssz.ByteVectorType({
      length: 96,
    })
  }
});

export const ForkData = new ssz.ContainerType({
  fields: {
    forkVersion: new ssz.ByteVectorType({
      length: 4,
    }),
    genesisValidatorsRoot: new ssz.ByteVectorType({
      length: 32,
    }),
  },
});

export function generateDepositDomain(domainType, genesisValidatorsRoot) {
  const forkVersion = Buffer.from('00000000', 'hex'); // 00000000 mainnet - 00001020 prater
  const domainTypeBytes = Buffer.from([domainType, 0, 0, 0]);
  const forkDataRoot = ForkData.hashTreeRoot({
    forkVersion,
    genesisValidatorsRoot
  });
  return Buffer.concat([domainTypeBytes, forkDataRoot.slice(0, 28)])
}

// for prater taken from https://github.com/eth-clients/eth2-networks/tree/master/shared/prater
export const DEPOSIT_CONTRACT_ADDRESS =
  "0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b";
export const GENESIS_TIME = 1614588812; 
export const GENESIS_VALIDATORS_ROOT = "0";

// generated based on the above constants
export const DEPOSIT_DOMAIN = generateDepositDomain(DomainType.DEPOSIT, GENESIS_VALIDATORS_ROOT)

export function withdrawalCredentials(servicesContractAddress) {
  return Buffer.concat([
    Buffer.from('010000000000000000000000', 'hex'),
    Buffer.from(servicesContractAddress.slice(2), 'hex')]);
}

export function saltBytesToContractAddress(saltBytes, networkData) {
  const proxyInitCodeHash = keccak256(
    `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${networkData.CONTRACT_IMPL_ADDRESS.substring(2)}5af43d82803e903d91602b57fd5bf3`);

  return getCreate2Address(
    networkData.FACTORY_ADDRESS,
    saltBytes,
    proxyInitCodeHash
  );
}

// input
// validatorKey: private key of the operator
// servicesContractAddress: services smart contract public key
export function createOperatorDepositData(validatorKey, servicesContractAddress) {
  const validatorPubKeyBytes = validatorKey.toPublicKey().toBytes();

  // the services smart contract address is the one used as withdrawal address
  const withdrawalCreds = withdrawalCredentials(servicesContractAddress);

  const depositMessageRoot = DepositMessageSchema.hashTreeRoot({
    validatorPubKey: validatorPubKeyBytes,
    withdrawalCredentials: withdrawalCreds,
    depositAmount: DEPOSIT_AMOUNT
  });

  const signingRoot = SignatureSchema.hashTreeRoot({
    rootHash: depositMessageRoot,
    domain: DEPOSIT_DOMAIN
  });

  const signature = bls.sign(validatorKey.toBytes(), signingRoot);

  const depositDataRoot = DepositDataSchema.hashTreeRoot({
    pubKey: validatorPubKeyBytes,
    withdrawalCredentials: withdrawalCreds,
    amount: DEPOSIT_AMOUNT,
    signature: signature
  });

  return {
    validatorPubKey: validatorPubKeyBytes,
    depositSignature: signature,
    depositDataRoot: depositDataRoot
  };
}

export function createOperatorCommitment(
  serviceContractAddress,
  validatorPubKey,
  depositSignature,
  depositDataRoot,
  exitDate
) {
  return keccak256(
    solidityPack(
      ["address", "bytes", "bytes", "bytes32", "uint64"],
      [
        serviceContractAddress,
        validatorPubKey,
        depositSignature,
        depositDataRoot,
        exitDate
      ]
    )
  );
}

// export const VoluntaryExitSchema = new ssz.ContainerType({
//   fields: {
//     epoch: new ssz.UintType({
//       byteLength: 8,
//     }),
//     validatorIndex: new ssz.UintType({
//       byteLength: 8,
//     })
//   }
// });

// export function computeSigningDomain(domainType, genesisValidatorsRoot) {
//   const forkVersion = Buffer.from('00000000', 'hex'); // mainnet
//   const domainTypeBytes = Buffer.from([domainType, 0, 0, 0]);
//   const forkDataRoot = ForkData.hashTreeRoot({
//     forkVersion,
//     genesisValidatorsRoot
//   });
//   return Buffer.concat([domainTypeBytes, forkDataRoot.slice(0, 28)])
// }

// export const VOLUNTARY_EXIT_DOMAIN = computeSigningDomain(
//   DomainType.VOLUNTARY_EXIT, GENESIS_VALIDATORS_ROOT);

// export function createVoluntaryExitSignature(
//   validatorKey,
//   epoch,
//   validatorIndex
// ) {
//   const voluntaryExitRoot = VoluntaryExitSchema.hashTreeRoot({ epoch, validatorIndex });
//   const signingRoot = SignatureSchema.hashTreeRoot({
//     rootHash: voluntaryExitRoot,
//     domain: VOLUNTARY_EXIT_DOMAIN
//   });
//   return bls.sign(validatorKey.toBytes(), signingRoot);
// }

