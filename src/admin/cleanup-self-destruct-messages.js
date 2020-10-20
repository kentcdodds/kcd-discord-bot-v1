const {cleanupGuildOnInterval, getSelfDestructTime} = require('../utils')

async function cleanup(guild) {
  const channels = guild.channels.cache.filter(ch => ch.type === 'text')
  const botId = guild.client.user.id
  const promises = []

  for (const channel of Array.from(channels.values())) {
    for (const message of Array.from(channel.messages.cache.values())) {
      if (message?.author?.id === botId) {
        const timeToSelfDestruct = getSelfDestructTime(message.content)
        if (
          typeof timeToSelfDestruct === 'number' &&
          message.createdAt.getTime() + timeToSelfDestruct < Date.now()
        ) {
          promises.push(
            message.delete({
              reason: `Self destructed after ${timeToSelfDestruct}ms`,
            }),
          )
        }
      }
    }
  }

  return Promise.all(promises)
}

async function setup(client) {
  // prime the message cache for all channels
  // this is important for situations when the bot gets restarted after
  // it had just sent a self-destruct chat
  await Promise.all(
    Array.from(client.guilds.cache.values()).map(async guild => {
      const channels = guild.channels.cache.filter(ch => ch.type === 'text')
      return Promise.all(
        Array.from(channels.values()).map(channel => {
          return channel.messages.fetch({limit: 30})
        }),
      )
    }),
  )

  cleanupGuildOnInterval(client, guild => cleanup(guild), 5000)
}

module.exports = {setup}
