const kifHandlers = require('./kif')
const blogHandlers = require('./blog')
const discordHandlers = require('./discord')

module.exports = [...kifHandlers, ...blogHandlers, ...discordHandlers]
