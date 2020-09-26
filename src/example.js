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
const getKent = () =>
  getKcdGuild().members.cache.find(
    ({user: {username, discriminator}}) =>
      username === 'kentcdodds' && discriminator === '0001',
  )

client.on('ready', () => {
  console.log('ready to go')
  // commands.setup(client)
  // clubApplication.setup(client)
  // admin.setup(client)
  // onboarding.setup(client)
  client.on('guildMemberUpdate', admin.handleGuildMemberUpdate)
  // client.on('message', onboarding.handleNewMessage)
  // client.on('messageUpdate', onboarding.handleUpdatedMessage)

  // onboarding.handleNewMember(getKent())

  // setInterval(() => {
  //   client.guilds.cache.forEach(guild => {
  //     onboarding.cleanup(guild)
  //   })
  // }, 5000)
})
