const Discord = require('discord.js')
const {onboarding} = require('./src')

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'local'}`,
})

const client = new Discord.Client()

console.log('logging in discord client')
client.login(process.env.DISCORD_BOT_TOKEN)

client.on('message', onboarding.handleNewMessage)
client.on('message', async message => {
  // just a way to check that the bot is running
  if (message.content.toLowerCase() === '?ping') {
    await message.channel.send('pong')
  }
})
client.on('messageUpdate', onboarding.handleUpdatedMessage)
client.on('guildMemberAdd', onboarding.handleNewMember)

client.on('ready', error => {
  if (error) {
    console.log('Error logging client in')
    throw error
  } else {
    console.log('client logged in')
    setInterval(() => {
      client.guilds.cache.forEach(guild => {
        onboarding.cleanup(guild)
      })
    }, 5000)
  }
})

/*
eslint
  no-console: "off",
*/
