const dedupeMessages = require('./deduping-channel-posts')
const {pingAboutMissingAvatar} = require('./ping-about-missing-avatar')
const exclusiveEpicReactRocket = require('./exclusive-epic-react-rocket')
const cleanupSelfDestructMessages = require('./cleanup-self-destruct-messages')

function setup(client) {
  client.on('message', dedupeMessages.handleNewMessage)
  dedupeMessages.setup(client)

  cleanupSelfDestructMessages.setup(client)

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
  exclusiveEpicReactRocket,
  cleanupSelfDestructMessages,
}
