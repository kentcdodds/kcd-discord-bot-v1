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

  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      onboarding.cleanup(guild)
    })
  }, 5000)
}

module.exports = {...onboarding, setup}
