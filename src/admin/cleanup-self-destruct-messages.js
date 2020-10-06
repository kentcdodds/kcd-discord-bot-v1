const {getSelfDestructTime} = require('../utils')

async function cleanup(guild) {
  const channels = guild.channels.cache.filter(ch => ch.type === 'text')
  const botId = guild.client.user.id

  for (const channel of Array.from(channels.values())) {
    for (const message of Array.from(channel.messages.cache.values())) {
      if (message?.author?.id === botId) {
        const timeToSelfDestruct = getSelfDestructTime(message.content)
        if (
          typeof timeToSelfDestruct === 'number' &&
          message.createdAt.getTime() + timeToSelfDestruct < Date.now()
        ) {
          // ignore the returned promise. Fire and forget
          message.delete({
            reason: `Self destructed after ${timeToSelfDestruct}ms`,
          })
        }
      }
    }
  }
}

function setup(client) {
  // prime the message cache for all channels
  // this is important for situations when the bot gets restarted after
  // it had just sent a self-destruct chat
  const guild = client.guilds.cache.find(({name}) => name === 'KCD')
  const channels = guild.channels.cache.filter(ch => ch.type === 'text')
  for (const channel of Array.from(channels.values())) {
    // ignore the returned promise. Fire and forget.
    channel.messages.fetch({limit: 30})
  }

  console.log('setting interval')
  setInterval(() => {
    cleanup(guild)
  }, 5000)
}

module.exports = {setup}
