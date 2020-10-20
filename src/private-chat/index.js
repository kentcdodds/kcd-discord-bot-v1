const {cleanupGuildOnInterval} = require('../utils')
const privateChat = {
  ...require('./cleanup'),
}

function setup(client) {
  cleanupGuildOnInterval(client, guild => privateChat.cleanup(guild), 5000)
}

module.exports = {...privateChat, setup}
