// Command purpose:
// lists all available commands
const {getArgs} = require('../command-regex')

async function help(message) {
  const args = getArgs(message.content)
  const commands = require('../commands')
  const [arg1] = args.split(' ')
  const commandFn = commands[arg1]
  if (commandFn) {
    if (commandFn.help) {
      return commandFn.help(message)
    } else if (commandFn.description) {
      return message.channel.send(commandFn.description)
    }
  } else {
    const result = await message.channel.send(
      `
Here are the available commands:

- ${Object.entries(commands)
        .map(([name, fn]) => [name, fn.description].filter(Boolean).join(': '))
        .join('\n- ')}
      `.trim(),
    )
    return result
  }
}
help.description = 'Lists available commands'

module.exports = help
