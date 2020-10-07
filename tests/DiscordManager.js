/**
 * this class is used by the API to get channel and guild by their ids.
 * The only thing to remember is that if a new message
 **/
class DiscordManager {
  static channels = {}
  static guilds = {}
  static clients = []

  static cleanup() {
    this.channels = {}
    this.guilds = {}
    this.clients.forEach(client => client.destroy())
  }
}

module.exports = DiscordManager
