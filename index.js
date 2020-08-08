const Discord = require('discord.js')
const {
  handleNewMessage,
  handleUpdatedMessage,
  handleNewMember,
  cleanup,
} = require('./src')

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'local'}`,
})

const client = new Discord.Client()

console.log('logging in discord client')
client.login(process.env.DISCORD_BOT_TOKEN)

client.on('message', handleNewMessage)
client.on('messageUpdate', handleUpdatedMessage)
client.on('guildMemberAdd', handleNewMember)

client.on('ready', error => {
  if (error) {
    console.log('Error logging client in')
    throw error
  } else {
    console.log('client logged in')
    setInterval(() => {
      client.guilds.cache.forEach(guild => {
        cleanup(guild)
      })
    }, 5000)
  }
})

/*
eslint
  no-console: "off",
*/
