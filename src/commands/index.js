const {regex: commandRegex} = require('./command-regex')
const commands = require('./commands')

function handleNewMessage(message) {
  const {command} = message.content.match(commandRegex)?.groups ?? {}
  if (!command) return

  const commandFn = commands[command]
  if (!commandFn) return

  return commandFn(message)
}

function setup(client) {
  client.on('message', handleNewMessage)
}

module.exports = {handleNewMessage, setup}
