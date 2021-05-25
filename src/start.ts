import Discord from 'discord.js'
import {setup} from './setup'
import {
  botLog,
  getStartTimeInfo,
  getCommitInfo,
  getBuildTimeInfo,
  typedBoolean,
  colors,
} from './utils'
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
      botLog(guild, () => {
        const commitInfo = getCommitInfo()
        const commitValue = commitInfo
          ? `
Commit:
  author: ${commitInfo.author}
  date: ${commitInfo.date}
  message: ${commitInfo.message}
  link: <${commitInfo.link}>
            `.trim()
          : null
        return {
          title: '✅ BOT Started',
          color: colors.base0B,
          description: `Logged in and ready to go. Here's some info on the running bot:`,
          fields: [
            {name: 'Startup', value: getStartTimeInfo(), inline: true},
            {name: 'Built', value: getBuildTimeInfo(), inline: true},
            commitValue ? {name: 'Commit', value: commitValue} : null,
          ].filter(typedBoolean),
        }
      })
    }
  })
}

export {start}
