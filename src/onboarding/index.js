const {cleanupGuildOnInterval} = require('./utils')

const onboarding = {
  ...require('./handle-new-member'),
  ...require('./handle-new-message'),
  ...require('./handle-updated-message'),
  ...require('./cleanup'),
}

function setup(client) {
  client.on('message', onboarding.handleNewMessage)
  client.on('messageUpdate', onboarding.handleUpdatedMessage)
  client.on('guildMemberAdd', onboarding.handleNewMember)

  cleanupGuildOnInterval(client, guild => onboarding.cleanup(guild), 5000)
}

module.exports = {...onboarding, setup}
