const chrono = require('chrono-node')
const {
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
  getFollowMeMessages,
  getMessageLink,
} = require('./utils')

// we'd just use the message.mentions here, but sometimes the mentions aren't there for some reason 🤷‍♂️
// so we parse it out ourselves
function getMentionedUser(message) {
  const mentionId = message.content.match(/<@!?(\d+)>/)?.[1]
  if (!mentionId) {
    throw new Error(
      `This message (${getMessageLink(message)}) has no mentions: ${
        message.content
      }`,
    )
  }
  return message.guild.members.cache.get(mentionId)
}

async function maybeDeleteMessage(message, member) {
  const deleteMessageReaction = message.reactions.cache.get('❌')
  if (!deleteMessageReaction) return
  const deleteReactions = await deleteMessageReaction.users.fetch()
  if (deleteReactions.some(user => user.id === member.id)) {
    await message.delete()
  }
}

async function cleanup(guild) {
  const meetupChannels = getMeetupChannels(guild)

  const now = Date.now()

  const deletingMeetups = []
  const cutoffAge = now - 1000 * 60 * 15
  for (const meetupChannel of meetupChannels.values()) {
    if (
      meetupChannel.createdAt.getTime() < cutoffAge &&
      meetupChannel.members.size === 0
    ) {
      deletingMeetups.push(meetupChannel.delete())
    }
  }

  const deletingFollowMeMessages = Array.from(
    (await getFollowMeMessages(guild)).values(),
  ).map(msg => maybeDeleteMessage(msg, getMentionedUser(msg)))

  const scheduledMeetupsChannel = getScheduledMeetupsChannel(guild)
  const deletingScheduledMeetupMessages = Array.from(
    (await scheduledMeetupsChannel.messages.fetch()).values(),
  ).map(msg => maybeDeleteMessage(msg, getMentionedUser(msg)))

  const parsedMessages = scheduledMeetupsChannel.messages.cache.reduce(
    (acc, message) => {
      const content = message.content
      const match = content.match(/^📣 On (?<scheduleTime>.+) <.+$/i)
      if (match) {
        const parsedTime = chrono.parse(match.groups.scheduleTime)
        if (
          parsedTime.length > 1 ||
          !parsedTime.length ||
          parsedTime[0].text !== match.groups.scheduleTime
        ) {
          acc.invalidMessages.push(message)
        } else if (parsedTime[0].start.date() <= now) {
          acc.meetupsToStart.push(message)
        }
      } else {
        acc.invalidMessages.push(message)
      }
      return acc
    },
    {
      invalidMessages: [],
      meetupsToStart: [],
    },
  )

  const invalidMessages = parsedMessages.invalidMessages.map(message =>
    message.delete(),
  )
  const meetupsStarted = parsedMessages.meetupsToStart.map(
    startMeetupFromMessage,
  )

  async function startMeetupFromMessage(message) {
    const hostMember = getMentionedUser(message)
    const subject = message.content.match(
      /will be hosting a meetup about "(?<subject>.+)"./,
    )?.groups?.subject
    const notificationReactionMessage = message.reactions.cache.get('✋')
    const notificationUsers = Array.from(
      (await notificationReactionMessage.users.fetch()).values(),
    ).filter(user => !user.bot)
    await startMeetup({guild, host: hostMember, subject, notificationUsers})

    await message.delete()
  }

  await Promise.all([
    ...invalidMessages,
    ...meetupsStarted,
    ...deletingMeetups,
    ...deletingFollowMeMessages,
    ...deletingScheduledMeetupMessages,
  ])
}

module.exports = {
  cleanup,
}
