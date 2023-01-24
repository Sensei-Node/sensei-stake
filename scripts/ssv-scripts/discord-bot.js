//In bot.js
const token = process.env.DISCORD_BOT; //Token that you saved in step 5 of this tutorial
const { Client, Events, GatewayIntentBits } = require("discord.js");
const hre = require("hardhat")
let contract;

const init = async () => {
    const senseistake = await hre.deployments.get("SenseiStake");
    const address = senseistake.address;
    contract = await hre.ethers.getContractAt("SenseiStake", address);
} 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
    if (message.channel.name == "senseistake") {
        try {
            const tokenId = message.content;
            const validator_data = await contract.validators(tokenId);
            const validator_id = validator_data[0];
            await hre.tasks['ssv-register'].action({ pubkey: validator_id });
        } catch (err) {
            console.error(err)
        }
    }
});

// Log in to Discord with your client's token
client.login(token);
init();