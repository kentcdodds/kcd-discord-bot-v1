const chrono = require('chrono-node')
const {
  getChannel,
  getCommandArgs,
  getMember,
  commandPrefix,
  sendBotMessageReply,
  getMessageLink,
  listify,
} = require('../utils')
const {
  getScheduledMeetupsChannel,
  getFollowMeChannel,
  startMeetup,
  getFollowers,
} = require('../../meetup/utils')

const invalidCommandMessage = `The command is not valid. use \`${commandPrefix}meetup help\` to know more about the command.`

async function meetup(message) {
  const [command, ...rest] = getCommandArgs(message.content).split(' ')
  const args = rest.join(' ')
  switch (command) {
    case 'schedule': {
      return scheduleMeetup(message, args)
    }
    case 'start': {
      const subject = args.trim()
      if (!subject) return sendBotMessageReply(message, invalidCommandMessage)
      return startMeetup({guild: message.guild, host: message.member, subject})
    }
    case 'follow-me': {
      return followMe(message, args)
    }
    default: {
      return sendBotMessageReply(message, invalidCommandMessage)
    }
  }
}

async function followMe(message, args) {
  const followMeChannel = getFollowMeChannel(message.guild)
  const existingFollowMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(message.author.id),
  )
  const messageContent = `
Raise your hand ✋ to be notified whenever ${message.author} schedules and starts meetups. Here's a bit about ${message.author}:

> ${args}
      `.trim()
  if (existingFollowMeMessage) {
    await existingFollowMeMessage.edit(messageContent)
    return sendBotMessageReply(
      message,
      `
I've updated your message in ${followMeChannel} for you ${
        message.author
      }! Find it here: ${getMessageLink(existingFollowMeMessage)}

You can update it by re-running \`${commandPrefix}meetup follow-me New bio here.\` and you can delete it by adding a ❌ emoji reaction to the message.
          `.trim(),
    )
  } else {
    const followMeMessage = await followMeChannel.send(messageContent)
    await followMeMessage.react('✋')

    return sendBotMessageReply(
      message,
      `
I've posted a message in ${followMeChannel} for you ${
        message.author
      }! Find it here: ${getMessageLink(followMeMessage)}

You can update it by re-running \`${commandPrefix}meetup follow-me New bio here.\` and you can delete it by adding a ❌ emoji reaction to the message.
          `.trim(),
    )
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

  await scheduledMeetupMessage.react('✋')
  const botsChannel = getChannel(message.guild, {name: 'talk-to-bots'})
  const followers = await getFollowers(message.guild, member)
  if (followers.length) {
    await botsChannel.send(
      `${member} has scheduled a "${subject}" meetup for ${scheduleTime}! CC: ${listify(
        followers,
      )}`,
    )
  }
}

meetup.description = 'Enable users to start and schedule meetups'
meetup.help = message =>
  sendBotMessageReply(
    message,
    `
This command gives the ability to start and schedule meetups:

Examples:

Schedule a meetup for later: \`${commandPrefix}meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM MDT\`
Start a new meetup right now: \`${commandPrefix}meetup start Remix and Progressive Enhancement\`
Add yourself to ${getFollowMeChannel(
      message.guild,
    )}: ${commandPrefix}meetup follow-me Here's a brief description about me

NOTE: For bo the schedule and start commands, if you include a Zoom link, that will be shared instead of creating a voice channel.
    `.trim(),
  )

module.exports = meetup
