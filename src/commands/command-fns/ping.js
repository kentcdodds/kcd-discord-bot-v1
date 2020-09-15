// Command purpose:
// this command is just to make sure the bot is running
const {getCommandArgs} = require('../utils')

async function ping(message) {
  const args = getCommandArgs(message.content)
  const result = await message.channel.send(`pong ${args}`.trim())
  return result
}
ping.description = 'Just helps you make sure the bot is running'
ping.help = message =>
  message.channel.send(`Replies with "pong" and whatever you send`)

module.exports = ping
