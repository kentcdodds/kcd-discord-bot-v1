const kifHandlers = require('./kif')
const blogHandlers = require('./blog')
const discordHandlers = require('./discord')
const onBoardHandlers = require('./onBoarding')

module.exports = [
  ...kifHandlers,
  ...blogHandlers,
  ...discordHandlers,
  ...onBoardHandlers,
]
