mv package_internal.json package.json
npm i --dev @chainsafe/bls@^6.0.2 
npm i --dev @chainsafe/ssz@^0.8.17
npm i @chainsafe/bls-keystore@^2.0.0 

echo 'Inicio script running... ' | tee deploySingle.log

npx hardhat deploy --tags single-service-contract  --network $1 | tee deploySingle.log

echo 'End script running... '