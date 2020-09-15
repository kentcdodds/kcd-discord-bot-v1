const {commandRegex, getRole, getMember, commandPrefix} = require('./utils')
const commands = require('./commands')

function handleNewMessage(message) {
  let {command, args} = message.content.match(commandRegex)?.groups ?? {}

  // a nice little shortcut
  if (message.content.trim() === commandPrefix) {
    command = 'help'
    args = ''
  }

  if (!command) return

  const commandFn = commands[command]
  if (!commandFn) return

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
  if (!member.roles.cache.has(memberRole)) {
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
