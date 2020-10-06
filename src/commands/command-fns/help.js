// Command purpose:
// lists all available commands
const {getCommandArgs, sendBotMessageReply} = require('../utils')

async function help(message) {
  const args = getCommandArgs(message.content)
  const commands = require('../commands')
  const [arg1] = args.split(' ')
  const commandFn = commands[arg1]
  if (commandFn) {
    if (commandFn.help) {
      return commandFn.help(message)
    } else if (commandFn.description) {
      return sendBotMessageReply(message, commandFn.description)
    }
  } else {
    const result = sendBotMessageReply(
      message,
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
