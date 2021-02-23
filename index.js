const path = require('path')

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'local'}`,
})

const Discord = require('discord.js')

let bot
if (process.env.NODE_ENV === 'production') {
  bot = require('./dist')
} else {
  require('ts-node').register({
    dir: path.resolve('src'),
    pretty: true,
    transpileOnly: true,
    ignore: ['/node_modules/', '/__tests__/'],
    project: require.resolve('./tsconfig.json'),
  })
  bot = require('./src')
}

const {setup, rollbar} = bot

const client = new Discord.Client()

rollbar.log('logging in discord client')
client.login(process.env.DISCORD_BOT_TOKEN)

client.on('ready', error => {
  if (error) {
    rollbar.log('Error logging client in')
    throw error
  } else {
    rollbar.log('Client logged in... Setting up client.')
    setup(client)
  }
})
