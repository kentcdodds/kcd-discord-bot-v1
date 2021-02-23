import type * as TDiscord from 'discord.js'
import {
  getCommandArgs,
  getMember,
  commandPrefix,
  sendBotMessageReply,
  getMessageLink,
  listify,
  getMentionedUser,
  getScheduledMeetupsChannel,
  getFollowMeChannel,
  startMeetup,
  getFollowers,
  rollbar,
  getTextChannel,
} from '../../meetup/utils'

const invalidCommandMessage = `The command is not valid. Use \`${commandPrefix}meetup help\` to know more about the command.`

const meetupDetailsLengthLimit = 800
const sendMeetupDetailsTooLongError = (
  message: TDiscord.Message,
  meetupDetails: string,
) =>
  sendBotMessageReply(
    message,
    `Meetup details are limited to ${meetupDetailsLengthLimit} characters and your details are ${meetupDetails.length} characters. If you need to, put extra details somewhere online and link to it.`,
  )

async function meetup(message: TDiscord.Message) {
  const [command, ...rest] = getCommandArgs(message.content).split(' ')
  const args = rest.join(' ').trim()
  switch (command) {
    case 'schedule': {
      return scheduleMeetup(message, args)
    }
    case 'force-update': {
      return updateScheduledMeetup(message, args, {force: true})
    }
    case 'update': {
      return updateScheduledMeetup(message, args)
    }
    case 'start': {
      if (!args) return sendBotMessageReply(message, invalidCommandMessage)
      return startMeetup({
        host: message.member,
        meetupDetails: `"${args}"`,
        createVoiceChannel: !args.toLowerCase().includes('zoom.us'),
      })
    }
    case 'follow-me': {
      if (!args) return sendBotMessageReply(message, invalidCommandMessage)
      return followMe(message, args)
    }
    default: {
      return sendBotMessageReply(message, invalidCommandMessage)
    }
  }
}

async function followMe(message: TDiscord.Message, args: string) {
  const followMeChannel = getFollowMeChannel(message.guild)
  if (!followMeChannel) return

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
      }! Find it here: <${getMessageLink(existingFollowMeMessage)}>

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
      }! Find it here: <${getMessageLink(followMeMessage)}>

You can update it by re-running \`${commandPrefix}meetup follow-me New bio here.\` and you can delete it by adding a ❌ emoji reaction to the message.
          `.trim(),
    )
  }
}

function getScheduleMessage({
  host,
  recurringPart,
  meetupDetails,
}: {
  host: TDiscord.GuildMember
  recurringPart: '' | 'recurring '
  meetupDetails: string
}) {
  return `
📣 ${host} is hosting a ${recurringPart}meetup:

${meetupDetails}

React with ✋ to be notified when it starts.
  `.trim()
}

async function scheduleMeetup(
  message: TDiscord.Message,
  meetupDetails: string,
) {
  const host = getMember(message.guild, message.author.id)
  if (!host) {
    rollbar.warn(`Trying to schedule a meetup without a host!`, {meetupDetails})
    return
  }
  const scheduledMeetupsChannel = getScheduledMeetupsChannel(message.guild)
  if (!scheduledMeetupsChannel) return

  const recurring = meetupDetails.startsWith('recurring')
  meetupDetails = meetupDetails.replace(/^recurring /, '')

  if (!/^"(.+)"/i.test(meetupDetails)) {
    return sendBotMessageReply(
      message,
      'Make sure to include the subject of your meetup in quotes. Send `?meetup help` for more info.',
    )
  }
  if (meetupDetails.length > meetupDetailsLengthLimit) {
    return sendMeetupDetailsTooLongError(message, meetupDetails)
  }

  const recurringPart = recurring ? 'recurring ' : ''
  const scheduledMeetupMessage = await scheduledMeetupsChannel.send(
    getScheduleMessage({host, recurringPart, meetupDetails}),
  )

  const scheduledMessageLink = getMessageLink(scheduledMeetupMessage)

  await sendBotMessageReply(
    message,
    `
Your ${recurringPart}meetup has been scheduled: <${scheduledMessageLink}>. You can control the meetup by reacting to that message with the following emoji:

- 🏁 to start the meetup and notify everyone it's begun.
- ❌ to cancel the meetup and notify everyone it's been canceled.
- 🛑 to cancel the meetup and NOT notify everyone it's been canceled.

If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )

  await scheduledMeetupMessage.react('✋')

  const testing = meetupDetails.includes('TESTING')
  const meetupNotifications = getTextChannel(
    message.guild,
    'meetup-notifications',
  )
  if (!meetupNotifications) return

  const followers = (await getFollowers(host)).map(follower =>
    testing ? follower.displayName : follower.toString(),
  )
  if (followers.length) {
    const followersList = listify(followers)
    await meetupNotifications.send(
      `
${host} has scheduled a ${recurringPart}meetup:

${meetupDetails}

CC: ${followersList}

I will notify you when ${host} starts the meetup.
      `.trim(),
    )
  }
}

async function updateScheduledMeetup(
  message: TDiscord.Message,
  args: string,
  {force = false}: {force?: boolean} = {},
) {
  const scheduledMeetupsChannel = getScheduledMeetupsChannel(message.guild)
  if (!scheduledMeetupsChannel) return

  const [link, ...rest] = args.split(' ')
  // Some folks use the angle brackets (`<link>` syntax) to avoid discord expanding the link
  const bracketlessLink = link.replace(/<|>/g, '')
  const updatedDetails = rest.join(' ').trim()
  const messageId = bracketlessLink.split('/').slice(-1)[0]
  const originalMessage = (await scheduledMeetupsChannel.messages.fetch(
    messageId,
    // fetch is incorrectly typed, it can return `null` potentially
  )) as TDiscord.Message | null
  if (!originalMessage) {
    return sendBotMessageReply(
      message,
      `Could not find (<${link}>) in ${scheduledMeetupsChannel}`,
    )
  }
  const host = getMentionedUser(originalMessage)
  if (!host || host.id !== message.author.id) {
    return sendBotMessageReply(
      message,
      `You cannot update a scheduled meetup you are not hosting. ${host} is the host for <${bracketlessLink}>.`,
    )
  }

  const recurring = updatedDetails.startsWith('recurring')
  const meetupDetails = updatedDetails.replace(/^recurring /, '')
  const wasRecurring = originalMessage.content.includes(
    'is hosting a recurring meetup',
  )

  if (!force) {
    if (!recurring && wasRecurring) {
      return sendBotMessageReply(
        message,
        `The original meetup was recurring, but you're updating it to not be recurring. This is a common mistake. If you're sure this is the change you want, use \`?meetup force-update\` rather than \`?meetup update\``,
      )
    } else if (recurring && !wasRecurring) {
      return sendBotMessageReply(
        message,
        `The original meetup was not recurring, but you're updating it to be recurring. This is a common mistake. If you're sure this is the change you want, use \`?meetup force-update\` rather than \`?meetup update\``,
      )
    }
  }

  if (!/^"(.+)"/i.test(meetupDetails)) {
    return sendBotMessageReply(
      message,
      'Make sure to include the subject of your meetup in quotes. Send `?meetup help` for more info.',
    )
  }

  if (meetupDetails.length > meetupDetailsLengthLimit) {
    return sendMeetupDetailsTooLongError(message, meetupDetails)
  }

  const recurringPart = recurring ? 'recurring ' : ''
  await originalMessage.edit(
    getScheduleMessage({host, recurringPart, meetupDetails}),
  )

  return sendBotMessageReply(message, `Your meetup info has been updated.`)
}

meetup.description = 'Enable users to start and schedule meetups'
meetup.help = (message: TDiscord.Message) =>
  sendBotMessageReply(
    message,
    `
This command gives the ability to start and schedule meetups:

Examples:

Schedule a one-time meetup:
  \`${commandPrefix}meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM MDT\`
  Make sure the meetup subject is first and in quotes.

Schedule a recurring meetup:
  \`${commandPrefix}meetup schedule recurring "Migrating to Tailwind" on Wednesdays from 3:00 PM - 8:00 PM MDT\`
  Make sure the meetup subject is first and in quotes.

Update a scheduled meetup:
  \`${commandPrefix}meetup update <link-to-upcoming-meetup-message> "Updated Subject" and any additional details\`

Update a recurring meetup:
  \`${commandPrefix}meetup update <link-to-upcoming-meetup-message> recurring "Updated Subject" and any additional details\`

Start a new meetup right now:
  \`${commandPrefix}meetup start Remix and Progressive Enhancement\`

Add yourself to ${getFollowMeChannel(message.guild)}:
  \`${commandPrefix}meetup follow-me Here's a brief description about me\`

NOTE: For both the schedule and start commands, if you include a Zoom link, that will be shared instead of creating a voice channel.
NOTE: If you just want to test things out and not notify people, include the text "TESTING" in your subject.
    `.trim(),
  )

export {meetup}
