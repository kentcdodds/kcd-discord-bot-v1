const {cleanupGuildOnInterval} = require('../utils')
const meetup = {
  ...require('./cleanup'),
}

function setup(client) {
  cleanupGuildOnInterval(client, guild => meetup.cleanup(guild), 5000)
}

module.exports = {...meetup, setup}
