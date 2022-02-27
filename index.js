require('dotenv').config()
const Discord = require('discord.js')
const Bot = require('./Bots/fBot.js')
const { display } = require('./Services/BotService.js')

const client = new Discord.Client()

const { BOT_TOKEN } = process.env

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});
  
client.on('message', async (msg) => {
  try {
    const [ prefix ] = msg.content.split(' ')
    if(prefix !== ".listen") return;

    const fBot = await new Bot(client, msg).exec()
    display(fBot, msg)
  } catch(e) {
    console.error(e.message)
  } 
});

client.login(BOT_TOKEN);