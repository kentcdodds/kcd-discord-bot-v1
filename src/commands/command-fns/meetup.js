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
  const args = rest.join(' ').trim()
  switch (command) {
    case 'schedule': {
      return scheduleMeetup(message, args)
    }
    case 'start': {
      const subject = args.trim()
      if (!subject) return sendBotMessageReply(message, invalidCommandMessage)
      return startMeetup({host: message.member, subject})
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

async function scheduleMeetup(message, meetupDetails) {
  const member = getMember(message.guild, message.author.id)

  const recurring = meetupDetails.startsWith('recurring')
  meetupDetails = meetupDetails.replace(/^recurring /, '')

  if (!/^"(.+)"/i.test(meetupDetails)) {
    return sendBotMessageReply(
      message,
      'Make sure to include the subject of your meetup in quotes. Send `?meetup help` for more info.',
    )
  }

  const scheduledMeetupsChannel = getScheduledMeetupsChannel(message.guild)

  const recurringPart = recurring ? 'recurring ' : ''
  const scheduledMeetupMessage = await scheduledMeetupsChannel.send(
    `📣 ${member} is hosting a ${recurringPart}meetup: ${meetupDetails}. React with ✋ to be notified when it starts.`,
  )

  const scheduledMessageLink = getMessageLink(scheduledMeetupMessage)

  await sendBotMessageReply(
    message,
    `
Your ${recurringPart}meetup has been scheduled: ${scheduledMessageLink}. You can control the meetup by reacting to that message with the following emoji:

- 🏁 to start the meetup and notify everyone it's begun.
- ❌ to cancel the meetup and notify everyone it's been canceled.
- 🛑 to cancel the meetup and NOT notify everyone it's been canceled.

If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )

  await scheduledMeetupMessage.react('✋')

  const testing = meetupDetails.includes('TESTING')
  const botsChannel = getChannel(message.guild, {name: 'talk-to-bots'})
  const followers = await getFollowers(member)
  if (followers.length) {
    const followersList = listify(followers, {
      stringify: follower => {
        return testing ? follower.nickname : follower.toString()
      },
    })
    await botsChannel.send(
      `
${member} has scheduled a ${recurringPart}meetup: ${meetupDetails}!

CC: ${followersList}

I will notify you when ${member} starts the meetup.
      `.trim(),
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

Schedule a one-time meetup: \`${commandPrefix}meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM MDT\`
  Make sure the meetup subject is first and in quotes.

Schedule a recurring meetup: \`${commandPrefix}meetup schedule recurring "Migrating to Tailwind" on Wednesdays from 3:00 PM - 8:00 PM MDT\`
  Make sure the meetup subject is first and in quotes.

Start a new meetup right now: \`${commandPrefix}meetup start Remix and Progressive Enhancement\`

Add yourself to ${getFollowMeChannel(
      message.guild,
    )}: ${commandPrefix}meetup follow-me Here's a brief description about me

NOTE: For both the schedule and start commands, if you include a Zoom link, that will be shared instead of creating a voice channel.
NOTE: If you just want to test things out and not notify people, include the text "TESTING" in your subject.
    `.trim(),
  )

module.exports = meetup
