const {isWelcomeChannel} = require('./utils')
const {dedupeMessages} = require('./deduping-channel-posts')

function setup(client) {
  client.on('message', dedupeMessages)

  // prime the message cache for relevant channels
  const guild = client.guilds.cache.find(({name}) => name === 'KCD')
  const channels = guild.channels.cache.filter(
    ch => !isWelcomeChannel(ch) && ch.type === 'text',
  )
  for (const channel of Array.from(channels.values())) {
    // ignore the returned promise. Fire and forget.
    channel.messages.fetch({limit: 30})
  }
}

module.exports = {setup}
