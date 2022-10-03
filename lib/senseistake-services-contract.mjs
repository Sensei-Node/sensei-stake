"use strict";

const blsLib = await import("@chainsafe/bls");

try {
  await blsLib.init("blst-native");
} catch (e) {
  await blsLib.init("herumi");
  // console.warn("Using WASM BLS");
}

export const { bls } = blsLib;

const ssz = await import("@chainsafe/ssz");
const { keccak256, solidityPack, getCreate2Address } = await import("ethers/lib/utils.js");

const DEPOSIT_AMOUNT = BigInt(32_000_000_000);

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

export const forkVersionDefinition = {
  mainnet: '00000000',
  testnet: '00001020',
  hardhat: '00000000',
  ganache: '00001020',
  goerli: '00001020'
}

export function generateDepositDomain(domainType, genesisValidatorsRoot, network) {
  const _forkVersion = forkVersionDefinition[network] ? forkVersionDefinition[network] : '00000000';
  const forkVersion = Buffer.from(_forkVersion, 'hex'); // 00000000 mainnet - 00001020 prater
  const domainTypeBytes = Buffer.from([domainType, 0, 0, 0]);
  const forkDataRoot = ForkData.hashTreeRoot({
    forkVersion,
    genesisValidatorsRoot
  });
  return Buffer.concat([domainTypeBytes, forkDataRoot.slice(0, 28)])
}

export const GENESIS_VALIDATORS_ROOT = "0";

export function withdrawalCredentials(servicesContractAddress) {
  return Buffer.concat([
    Buffer.from('010000000000000000000000', 'hex'),
    Buffer.from(servicesContractAddress.slice(2), 'hex')]);
}

export function saltBytesToContractAddress(saltBytes, networkData) {
  const proxyInitCodeHash = keccak256(
    `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${networkData.CONTRACT_IMPL_ADDRESS.substring(2)}5af43d82803e903d91602b57fd5bf3`);

  return getCreate2Address(
    networkData.TOKEN_ADDRESS,
    saltBytes,
    proxyInitCodeHash
  );
}

// input
// validatorKey: private key of the operator
// servicesContractAddress: services smart contract public key
export function createOperatorDepositData(validatorKey, servicesContractAddress, network) {
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
    domain: generateDepositDomain(DomainType.DEPOSIT, GENESIS_VALIDATORS_ROOT, network)
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
    depositDataRoot: depositDataRoot,
    network
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

// FOR DEPOSIT SIGNATURE VERIFICATION

export const bufferHex = (x) => Buffer.from(x, "hex");

// Note: usage of this method requires awaiting the initBLS() method from "@chainsafe/bls";
export const verifySignature = (depositDatum) => {
  try {
    const pubkeyBuffer = bufferHex(depositDatum.validatorPubKey);
    const signatureBuffer = bufferHex(depositDatum.depositSignature);
    const depositMessageBuffer = bufferHex(depositDatum.depositDataRoot);
    const domain = generateDepositDomain(DomainType.DEPOSIT, GENESIS_VALIDATORS_ROOT, depositDatum.network);
    const signingRoot = SignatureSchema.hashTreeRoot({ rootHash: depositMessageBuffer, domain });
    return bls.verify(pubkeyBuffer, signingRoot, signatureBuffer);
  } catch (err) {
    console.error(err)
  }
};