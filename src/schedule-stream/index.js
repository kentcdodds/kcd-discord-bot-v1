const {cleanupGuildOnInterval} = require('../utils')
const scheduleStream = {
  ...require('./cleanup'),
}

function setup(client) {
  cleanupGuildOnInterval(client, guild => scheduleStream.cleanup(guild), 5000)
}

module.exports = {...scheduleStream, setup}
