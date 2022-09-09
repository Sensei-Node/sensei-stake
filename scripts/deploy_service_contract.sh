#!/bin/bash

cd /SenseiStake

echo 'Backing up package.json... ' | tee deploySingle.log
rm -rf package.json
cp package.internal.json package.json

echo 'Removing dependencies... ' | tee -a deploySingle.log
echo 'bls... ' | tee -a deploySingle.log
yarn remove @chainsafe/bls
echo 'ssz... ' | tee -a deploySingle.log
yarn remove @chainsafe/ssz
echo 'bls-keystore... ' | tee -a deploySingle.log
yarn remove @chainsafe/bls-keystore

echo 'Installing dependencies... ' | tee -a deploySingle.log
echo 'bls... ' | tee -a deploySingle.log
yarn add --dev @chainsafe/bls@^6.0.2
echo 'ssz... ' | tee -a deploySingle.log
yarn add --dev @chainsafe/ssz@^0.8.17
echo 'bls-keystore... ' | tee -a deploySingle.log
yarn add @chainsafe/bls-keystore@^2.0.0

echo 'Inicio script running... ' | tee -a deploySingle.log
npx hardhat deploy --tags single-service-contract  --network $1 | tee -a deploySingle.log
echo 'Fin script running... ' | tee -a deploySingle.log

# echo 'Restoring package.internal.json... ' | tee deploySingle.log
# mv package.internal2.json package.internal.json