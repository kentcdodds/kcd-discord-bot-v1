import Discord from 'discord.js'
import {setup} from './setup'
import rollbar from './rollbar'

function start() {
  const client = new Discord.Client()

  rollbar.log('logging in discord client')
  void client.login(process.env.DISCORD_BOT_TOKEN)

  client.on('ready', () => {
    rollbar.log('Client logged in... Setting up client.')
    setup(client)
  })
}

export {start}
