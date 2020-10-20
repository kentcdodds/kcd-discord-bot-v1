const {cleanupGuildOnInterval} = require('../utils')
const clubApplication = {
  ...require('./cleanup'),
}

function setup(client) {
  cleanupGuildOnInterval(client, guild => clubApplication.cleanup(guild), 5000)
}

module.exports = {...clubApplication, setup}
