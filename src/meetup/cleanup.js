const chrono = require('chrono-node')
const {
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
} = require('./utils')

function getStreamer(message) {
  // if someone has been tagged into the subject the only mention is the host
  return Array.from(message.mentions.members.values())[0]
}

async function filterNotDeletedMessages(messages) {
  const deletePromises = []
  const filteredMessages = []
  for (const message of messages) {
    const hostMember = getStreamer(message)
    const deleteMessageReaction = message.reactions.cache.find(
      ({emoji}) => emoji.name === '❌',
    )
    let shouldDeleteTheMessage = false
    if (deleteMessageReaction) {
      shouldDeleteTheMessage =
        Array.from(
          // eslint-disable-next-line no-await-in-loop
          (await deleteMessageReaction.users.fetch()).values(),
        ).findIndex(user => user.id === hostMember.id) >= 0
      if (shouldDeleteTheMessage) {
        deletePromises.push(message.delete())
      }
    }
    if (!shouldDeleteTheMessage) {
      filteredMessages.push(message)
    }
  }
  await Promise.all(deletePromises)
  return filteredMessages
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
  const scheduledMeetupsChannel = getScheduledMeetupsChannel(guild)
  const allMessages = await filterNotDeletedMessages(
    Array.from((await scheduledMeetupsChannel.messages.fetch()).values()),
  )

  const parsedMessages = allMessages.reduce(
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
    const hostMember = getStreamer(message)
    const subject = message.content.match(
      /will be hosting a meetup about "(?<subject>.+)"./,
    )?.groups?.subject
    const notificationReactionMessage = message.reactions.cache.find(
      ({emoji}) => emoji.name === '✋',
    )
    const notificationUsers = Array.from(
      (await notificationReactionMessage.users.fetch()).values(),
    ).filter(user => !user.bot)
    await startMeetup({guild, host: hostMember, subject, notificationUsers})

    await message.delete()
  }

  await Promise.all([...invalidMessages, ...meetupsStarted, ...deletingMeetups])
}

module.exports = {
  cleanup,
}
