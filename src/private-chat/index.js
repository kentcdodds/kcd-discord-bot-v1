const privateChat = {
  ...require('./cleanup'),
}

function setup(client) {
  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      privateChat.cleanup(guild)
    })
  }, 5000)
}

module.exports = {...privateChat, setup}
