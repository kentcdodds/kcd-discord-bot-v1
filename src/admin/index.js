const {dedupeMessages} = require('./deduping-channel-posts')

function setup(client) {
  client.on('message', dedupeMessages)
}

module.exports = {setup}
