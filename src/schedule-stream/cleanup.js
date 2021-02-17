const chrono = require('chrono-node')
const {getStreamerChannel, getChannel, listify} = require('./utils')

function getStreamer(message) {
  // if someone has been tagged into the subject the first mention is always the streamer
  return Array.from(message.mentions.users.values())[0]
}

async function filterNotDeletedMessages(messages) {
  const deletePromises = []
  const filteredMessages = []
  for (const message of messages) {
    const streamerUser = getStreamer(message)
    const deleteMessageReaction = message.reactions.cache.find(
      ({emoji}) => emoji.name === '❌',
    )
    let shouldDeleteTheMessage = false
    if (deleteMessageReaction) {
      shouldDeleteTheMessage =
        Array.from(
          // eslint-disable-next-line no-await-in-loop
          (await deleteMessageReaction.users.fetch()).values(),
        ).findIndex(user => user.id === streamerUser.id) >= 0
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
  const streamerChannel = getStreamerChannel(guild)
  const allMessages = await filterNotDeletedMessages(
    Array.from((await streamerChannel.messages.fetch()).values()),
  )

  const now = new Date()

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
          acc.streamingToNotify.push(message)
        }
      } else {
        acc.invalidMessages.push(message)
      }
      return acc
    },
    {
      invalidMessages: [],
      streamingToNotify: [],
    },
  )

  const promises = parsedMessages.invalidMessages.map(message =>
    message.delete(),
  )
  for (const message of parsedMessages.streamingToNotify) {
    const streamerUser = getStreamer(message)
    const notificationReactionMessage = message.reactions.cache.find(
      ({emoji}) => emoji.name === '✋',
    )
    if (notificationReactionMessage) {
      const notificationUsers = Array.from(
        // eslint-disable-next-line no-await-in-loop
        (await notificationReactionMessage.users.fetch()).values(),
      ).filter(user => !user.bot)

      const botsChannel = getChannel(guild, {name: 'talk-to-bots'})
      // eslint-disable-next-line no-await-in-loop
      await botsChannel.send(
        `${streamerUser} is live! Notifying: ${listify(notificationUsers, {
          stringify: i => i,
        })}`,
      )
    }
    promises.push(message.delete())
  }

  await Promise.all(promises)
}

module.exports = {
  cleanup,
}
