const {
  dedupeMessages,
  setup: setupDedupeMessages,
} = require('./deduping-channel-posts')
const {pingAboutMissingAvatar} = require('./ping-about-missing-avatar')
const {handleGuildMemberUpdate} = require('./exclusive-epic-react-rocket')

function setup(client) {
  client.on('message', dedupeMessages)
  setupDedupeMessages(client)

  client.on('message', pingAboutMissingAvatar)
  client.on('guildMemberUpdate', handleGuildMemberUpdate)
}

module.exports = {
  setup,
  dedupeMessages,
  pingAboutMissingAvatar,
  handleGuildMemberUpdate,
}
