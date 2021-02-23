const {commandRegex, getRole, getMember} = require('./utils')
const {default: commands} = require('./commands')

function handleNewMessage(message) {
  const {command, args} = message.content.match(commandRegex)?.groups ?? {}

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

  const member = getMember(message.guild, message.author.id)
  if (!member) return

  const memberRole = getRole(message.guild, {name: 'Member'})
  if (!member.roles.cache.has(memberRole.id)) {
    return message.channel.send(
      `
Sorry, only members can issue commands. Please, finish the onboarding process, then you can use the commands.
      `.trim(),
    )
  }

  return commandFn(message)
}

function setup(client) {
  client.on('message', handleNewMessage)
}

module.exports = {handleNewMessage, setup}
