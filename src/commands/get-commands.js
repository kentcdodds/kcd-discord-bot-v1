const path = require('path')
const fs = require('fs')

const commands = {}
const commandNames = fs
  .readdirSync(path.join(__dirname, './command-fns'))
  .filter(cmd => cmd.endsWith('.js'))
  .map(cmd => cmd.slice(0, cmd.length - 3))
for (const name of commandNames) {
  const command = require(`./command-fns/${name}`)
  commands[command.commandName] = command
}

function getCommand(commandName) {
  return commands[commandName]
}

module.exports = {getCommand, commands}
