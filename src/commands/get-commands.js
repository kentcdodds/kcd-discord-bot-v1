const path = require('path')
const fs = require('fs')

const commands = {}
const commandNames = fs
  .readdirSync(path.join(__dirname, './command-fns'))
  .filter(cmd => cmd.endsWith('.js'))
  .map(cmd => cmd.slice(0, cmd.length - 3))
for (const name of commandNames) {
  commands[name] = require(`./command-fns/${name}`)
}

function getCommand(commandName) {
  return commands[commandName]
}

module.exports = {getCommand, commands}
