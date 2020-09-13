const {dedupeMessages} = require('./deduping-channel-posts')

function setup(client) {
  dedupeMessages(client)
}

module.exports = {setup}
