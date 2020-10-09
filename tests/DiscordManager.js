/**
 * this class is used by the API to get channel and guild by their ids.
 * This is useful to clean up all things after each test and
 * to enable API to access guilds and channels because we don't have a DB
 **/
const DiscordManager = {
  channels: {},
  guilds: {},
  clients: [],
  cleanup: () => {
    DiscordManager.channels = {}
    DiscordManager.guilds = {}
    DiscordManager.clients.forEach(client => client.destroy())
  },
}

module.exports = DiscordManager
