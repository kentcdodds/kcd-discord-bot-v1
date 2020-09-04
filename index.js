require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'local'}`,
})

const Discord = require('discord.js')
const {setup} = require('./src')

const client = new Discord.Client()

console.log('logging in discord client')
client.login(process.env.DISCORD_BOT_TOKEN)

client.on('ready', error => {
  if (error) {
    console.log('Error logging client in')
    throw error
  } else {
    console.log('Client logged in... Setting up client.')
    setup(client)
  }
})

/*
eslint
  no-console: "off",
*/
