const chrono = require('chrono-node')
const {
  getCommandArgs,
  getMember,
  commandPrefix,
  sendBotMessageReply,
  getMessageLink,
} = require('../utils')
const {getScheduledMeetupsChannel, startMeetup} = require('../../meetup/utils')

const invalidCommandMessage = `The command is not valid. use \`${commandPrefix}meetup help\` to know more about the command.`

async function meetup(message) {
  const [command, ...rest] = getCommandArgs(message.content).split(' ')
  const args = rest.join(' ')
  switch (command) {
    case 'schedule': {
      return scheduleMeetup(message, args)
    }
    case 'start': {
      const subject = args.match(/"(?<subject>.+)"$/i)?.groups?.subject
      if (!subject) return sendBotMessageReply(message, invalidCommandMessage)
      return startMeetup({guild: message.guild, host: message.member, subject})
    }
    default: {
      return sendBotMessageReply(message, invalidCommandMessage)
    }
  }
}

async function scheduleMeetup(message, args) {
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

  const scheduledMeetupsChannel = getScheduledMeetupsChannel(message.guild)

  const scheduledMeetupMessage = await scheduledMeetupsChannel.send(
    `📣 On ${scheduleTime} ${member} will be hosting a meetup about "${subject}". React with ✋ to be notified when the time arrives.`,
  )

  await sendBotMessageReply(
    message,
    `
Your meetup has been scheduled: ${getMessageLink(scheduledMeetupMessage)}.
To cancel, react to that message with ❌. If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )

  return scheduledMeetupMessage.react('✋')
}

meetup.description = 'Enable users to start and schedule meetups'
meetup.help = message =>
  sendBotMessageReply(
    message,
    `
This command gives the ability to start and schedule meetups:

Examples:

Schedule a meetup for later: ${commandPrefix}meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM MDT
Start a new meetup right now: ${commandPrefix}meetup start "Remix and Progressive Enhancement"
    `.trim(),
  )

module.exports = meetup
