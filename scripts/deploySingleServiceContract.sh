npm uninstall bcrypt
npm i bcrypt

now=$(date)
echo "$now" | tee deploySingle.log

echo 'init script running... ' | tee deploySingle.log

npx hardhat deploy --tags single-service-contract  --network $1 | tee deploySingle.log

echo 'End script running... ' | tee deploySingle.log