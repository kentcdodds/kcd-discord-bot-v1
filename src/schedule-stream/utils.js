const {getChannel} = require('../utils')

function getStreamerChannel(guild) {
  return getChannel(guild, {name: '📅-stream-schedule'})
}

module.exports = {
  getStreamerChannel,
}
