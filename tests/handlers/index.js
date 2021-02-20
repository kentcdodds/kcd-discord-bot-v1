const kifHandlers = require('./kif')
const blogHandlers = require('./blog')
const discordHandlers = require('./discord')
const onboardingHandlers = require('./onboarding')

module.exports = [
  ...kifHandlers,
  ...blogHandlers,
  ...discordHandlers,
  ...onboardingHandlers,
]
