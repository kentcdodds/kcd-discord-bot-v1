// Command purpose:
// this command is just to make sure the bot is running
const {getArgs} = require('../command-regex')

async function ping(message) {
  const args = getArgs(message.content)
  const result = await message.channel.send(`pong ${args}`.trim())
  return result
}
ping.description = 'Just helps you make sure the bot is running'
ping.help = message =>
  message.channel.send(`Replies with "pong" and whatever you send`)
ping.commandName = 'ping'
module.exports = ping
