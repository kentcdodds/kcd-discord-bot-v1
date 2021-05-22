import type * as TDiscord from 'discord.js'
import {
  commandRegex,
  getRole,
  getMember,
  getErrorStack,
  getMessageLink,
  botLog,
} from './utils'
import commands from './commands'

function handleNewMessage(message: TDiscord.Message) {
  const guild = message.guild
  if (!guild) return

  const {command, args = ''} = message.content.match(commandRegex)?.groups ?? {}

  if (!command) return

  const commandFn = commands[command]
  if (!commandFn) return

  if (commandFn.authorize && !commandFn.authorize(message)) return

  if (args.toLowerCase().trim() === 'help') {
    if (commandFn.help) {
      return commandFn.help(message)
    } else if (commandFn.description) {
      return message.channel.send(commandFn.description)
    }
  }

  const member = getMember(guild, message.author.id)
  if (!member) return

  const memberRole = getRole(guild, 'Member')
  if (!memberRole) return

  if (!member.roles.cache.has(memberRole.id)) {
    return message.channel.send(
      `
Sorry, only members can issue commands. Please, finish the onboarding process, then you can use the commands.
      `.trim(),
    )
  }

  return commandFn(message).catch((error: unknown) => {
    console.error(getErrorStack(error))
    botLog(guild, () => `Command for ${getMessageLink(message)} failed`)
  })
}

function setup(client: TDiscord.Client) {
  client.on('message', msg => {
    // eslint-disable-next-line no-void
    void handleNewMessage(msg)
  })
}

export {handleNewMessage, setup}
