import Discord from 'discord.js'
import {setup} from './setup'
import {botLog} from './utils'
import rollbar from './rollbar'

function start() {
  const client = new Discord.Client({
    ws: {
      intents: [
        'GUILDS',
        'GUILD_MEMBERS',
        'GUILD_EMOJIS',
        'GUILD_MESSAGES',
        'GUILD_MESSAGE_REACTIONS',
      ],
    },
  })

  rollbar.log('logging in discord client')
  void client.login(process.env.DISCORD_BOT_TOKEN)

  client.on('ready', () => {
    rollbar.log('Client logged in... Setting up client.')
    setup(client)

    const guild = client.guilds.cache.find(({name}) => name === 'KCD')
    if (guild) {
      botLog(guild, () => 'Logged in and ready to go.')
    }
  })
}

export {start}
