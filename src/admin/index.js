const {
  dedupeMessages,
  setup: setupDedupeMessages,
} = require('./deduping-channel-posts')
const {pingAboutMissingAvatar} = require('./ping-about-missing-avatar')
const exclusiveEpicReactRocket = require('./exclusive-epic-react-rocket')

function setup(client) {
  client.on('message', dedupeMessages)
  setupDedupeMessages(client)

  client.on('message', pingAboutMissingAvatar)
  client.on(
    'guildMemberUpdate',
    exclusiveEpicReactRocket.handleGuildMemberUpdate,
  )
  client.on('message', exclusiveEpicReactRocket.handleNewMessage)
}

module.exports = {
  setup,
  dedupeMessages,
  pingAboutMissingAvatar,
  ...exclusiveEpicReactRocket,
}
