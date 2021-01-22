const chrono = require('chrono-node')
const {
  getCommandArgs,
  getMember,
  commandPrefix,
  sendBotMessageReply,
} = require('../utils')
const {getStreamerChannel} = require('../../schedule-stream/utils')

const invalidCommandMessage = `The command is not valid. use \`${commandPrefix}schedule-stream help\` to know more about the command.`

async function scheduleStream(message) {
  const args = getCommandArgs(message.content)
  const member = getMember(message.guild, message.author.id)
  const now = new Date()

  const match = args.match(/^"(?<subject>.+)" on (?<scheduleTime>.+)$/i)

  if (!match) return sendBotMessageReply(message, invalidCommandMessage)
  const {subject, scheduleTime} = match.groups

  const parsedTime = chrono.parse(scheduleTime)

  if (
    parsedTime.length > 1 ||
    !parsedTime.length ||
    //If the string is partially malformed chrono will parse only the valid string
    parsedTime[0].text !== scheduleTime
  ) {
    return sendBotMessageReply(message, invalidCommandMessage)
  }

  if (parsedTime[0].start.date() < now) {
    return sendBotMessageReply(
      message,
      "The scheduled time can't be in the past",
    )
  }

  const streamerChannel = getStreamerChannel(message.guild)

  const streamerMessage = await streamerChannel.send(
    `📣 On ${scheduleTime} ${member} will be live streaming "${subject}". React with ✋ to be notified when the time arrives.`,
  )

  return streamerMessage.react('✋')
}
scheduleStream.description = 'Enable users to schedule a stream'
scheduleStream.help = message =>
  sendBotMessageReply(
    message,
    ` 
This command, available only for streamers, gives the ability to schedule a new streaming: 

Example:

${commandPrefix}schedule-stream "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM MDT"
    `.trim(),
  )

module.exports = scheduleStream
