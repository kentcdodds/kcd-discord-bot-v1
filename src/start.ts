import Discord from 'discord.js'
import * as Sentry from '@sentry/node'
import {setup} from './setup'
import {
  botLog,
  getStartTimeInfo,
  getCommitInfo,
  getBuildTimeInfo,
  typedBoolean,
  colors,
} from './utils'

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

  Sentry.captureMessage('logging in discord client')
  void client.login(process.env.DISCORD_BOT_TOKEN)

  client.on('ready', () => {
    Sentry.captureMessage('Client logged in... Setting up client.')
    setup(client)

    const guild = client.guilds.cache.find(({name}) => name === 'KCD')
    if (guild) {
      void botLog(guild, () => {
        const commitInfo = getCommitInfo()
        const commitValue = commitInfo
          ? [
              `author: ${commitInfo.author}`,
              `date: ${commitInfo.date}`,
              `message: ${commitInfo.message}`,
              `link: <${commitInfo.link}>`,
            ].join('\n')
          : null
        return {
          title: '🤖 BOT Started',
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
