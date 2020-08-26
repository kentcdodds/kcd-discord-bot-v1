// Command purpose:
// lists all available commands
const {getArgs} = require('../command-regex')

async function help(message) {
  const args = getArgs(message.content)
  const {commands} = require('../get-commands')
  const [arg1] = args.split(' ')
  if (arg1 && commands[arg1] && commands[arg1].help) {
    const result = commands[arg1].help(message)
    return result
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
help.commandName = 'help'
help.description = 'Lists available commands'
module.exports = help
