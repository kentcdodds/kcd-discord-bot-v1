const {getChannel} = require('../utils')

function getStreamerChannel(guild) {
  return getChannel(guild, {name: '⏱-upcoming-streams'})
}

module.exports = {
  getStreamerChannel,
}
