npm uninstall bcrypt
npm i bcrypt

echo 'Inicio script running... ' | tee deploySingle.log

npx hardhat deploy --tags single-service-contract  --network $1 | tee deploySingle.log

echo 'End script running... '