/* eslint-disable no-unused-vars */
const path = require('path')
const Discord = require('discord.js')

require('dotenv').config({
  path: path.join(__dirname, '..', `/.env.${process.env.NODE_ENV || 'local'}`),
})

const {onboarding, commands, clubApplication, admin} = require('.')

const client = new Discord.Client()

console.log('logging in')
client.login(process.env.DISCORD_BOT_TOKEN)

const getKcdGuild = () => client.guilds.cache.find(({name}) => name === 'KCD')

client.on('ready', () => {
  console.log('ready to go')
  // commands.setup(client)
  // clubApplication.setup(client)
  admin.setup(client)
  // onboarding.setup(client)
})
