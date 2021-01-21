const chrono = require('chrono-node')
const {getStreamerChannel} = require('./utils')

async function cleanup(guild) {
  const streamerChannel = getStreamerChannel(guild)
  const allMessages = Array.from(
    (await streamerChannel.messages.fetch()).values(),
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
    const reactionMessage = message.reactions.cache.find(
      ({emoji}) => emoji.name === '✋',
    )
    if (reactionMessage) {
      // eslint-disable-next-line no-await-in-loop
      const notificationUsers = (await reactionMessage.users.fetch()).filter(
        user => !user.bot,
      )
      const streamerUser = Array.from(message.mentions.users.values())[0]
      notificationUsers.forEach(user => {
        promises.push(user.send(`Hey, ${streamerUser} is going to stream!!`))
      })
    }
    promises.push(message.delete())
  }

  await Promise.all(promises)
}

module.exports = {
  cleanup,
}
