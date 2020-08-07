const Discord = require('discord.js')
const {
  handleNewMessage,
  handleUpdatedMessage,
  handleNewMember,
  cleanup,
} = require('.')

require('dotenv').config({
  path: `../.env.${process.env.NODE_ENV || 'local'}`,
})

const client = new Discord.Client()

client.login(process.env.DISCORD_BOT_TOKEN)

client.on('message', handleNewMessage)
client.on('messageUpdate', handleUpdatedMessage)
// client.on('guildMemberAdd', handleNewMember)

const getKcdGuild = () => client.guilds.cache.find(({name}) => name === 'KCD')

client.on('ready', () => {
  setInterval(() => {
    cleanup(getKcdGuild())
  }, 5000)

  const memberThings = ['kentcdodds#8403']
  getKcdGuild()
    .members.cache.filter(({user: {username, discriminator}}) =>
      memberThings.includes(`${username}#${discriminator}`),
    )
    .forEach(member => {
      handleNewMember(member)
    })
})
