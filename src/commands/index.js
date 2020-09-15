const {regex: commandRegex} = require('./command-regex')
const commands = require('./commands')

function handleNewMessage(message) {
  const {command, args} = message.content.match(commandRegex)?.groups ?? {}
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

  return commandFn(message)
}

function setup(client) {
  client.on('message', handleNewMessage)
}

module.exports = {handleNewMessage, setup}
