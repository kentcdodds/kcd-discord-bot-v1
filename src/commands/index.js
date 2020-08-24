const {regex: commandRegex} = require('./command-regex')
const {getCommand} = require('./get-commands')

function handleNewMessage(message) {
  const {command} = message.content.match(commandRegex)?.groups ?? {}
  if (!command) return

  const commandFn = getCommand(command)
  if (!commandFn) return

  return commandFn(message)
}

module.exports = {handleNewMessage}
