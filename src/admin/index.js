const {
  dedupeMessages,
  setup: setupDedupeMessages,
} = require('./deduping-channel-posts')
const {pingAboutMissingAvatar} = require('./ping-about-missing-avatar')

function setup(client) {
  client.on('message', dedupeMessages)
  setupDedupeMessages(client)

  client.on('message', pingAboutMissingAvatar)
}

module.exports = {setup, dedupeMessages, pingAboutMissingAvatar}
