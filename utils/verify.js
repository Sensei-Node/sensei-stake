const { run } = require("hardhat")

const verify = async (contractAddress, args) => {
    console.log("Verifying contract...")
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args
      })
    } catch(err) {
      if (err.message && err.message.toLowerCase().includes("already verified")) {
        console.log("Error: contract already verifyed")
      } else {
        console.log("Error verifying contract", err)
      }
    }
}

module.exports = { verify }