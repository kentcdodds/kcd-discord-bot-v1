const onboarding = require('./onboarding')
const commands = require('./commands')
const clubApplication = require('./club-application')
const rollbar = require('./rollbar')

function setup(client) {
  onboarding.setup(client)
  commands.setup(client)
  clubApplication.setup(client)
}

module.exports = {
  onboarding,
  commands,
  clubApplication,
  setup,
  rollbar,
}
