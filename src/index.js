const onboarding = require('./onboarding')
const commands = require('./commands')
const admin = require('./admin')
const clubApplication = require('./club-application')
const privateChat = require('./private-chat')
const rollbar = require('./rollbar')
const scheduleStream = require('./schedule-stream')

function setup(client) {
  onboarding.setup(client)
  commands.setup(client)
  admin.setup(client)
  clubApplication.setup(client)
  privateChat.setup(client)
  scheduleStream.setup(client)
}

module.exports = {
  onboarding,
  commands,
  clubApplication,
  setup,
  rollbar,
  admin,
}
