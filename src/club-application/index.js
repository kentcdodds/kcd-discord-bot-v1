const clubApplication = {
  ...require('./handle-new-message'),
  ...require('./handle-updated-message'),
  ...require('./cleanup'),
}

function setup(client) {
  client.on('message', clubApplication.handleNewMessage)
  client.on('messageUpdate', clubApplication.handleUpdatedMessage)

  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      clubApplication.cleanup(guild)
    })
  }, 5000)
}

module.exports = {...clubApplication, setup}
