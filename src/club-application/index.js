const clubApplication = {
  ...require('./cleanup'),
}

function setup(client) {
  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      clubApplication.cleanup(guild)
    })
  }, 5000)
}

module.exports = {...clubApplication, setup}
