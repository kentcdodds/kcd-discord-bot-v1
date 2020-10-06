const Discord = require('discord.js')

function makeFakeClient() {
  const client = {options: {}}
  Object.assign(client, {
    channels: new Discord.ChannelManager(client),
    guilds: new Discord.GuildManager(client),
    users: new Discord.UserManager(client),
    user: new Discord.ClientUser(client, {
      id: 'bot-id',
      bot: true,
      username: 'kcd',
    }),
  })
  const guild = new Discord.Guild(client, {id: 'KCD_id', name: 'KCD'})
  const everyoneRole = new Discord.Role(
    client,
    // the everyone role has the same id as the guild.
    {id: guild.id, name: '@everyone'},
    guild,
  )
  client.guilds.cache.set(guild.id, guild)
  guild.roles.cache.set(guild.id, everyoneRole)

  const memberRole = new Discord.Role(
    client,
    {id: 'member-role-id', name: 'Member'},
    guild,
  )
  guild.roles.cache.set(memberRole.id, memberRole)

  const bot = new Discord.GuildMember(
    client,
    {bot: true, username: 'kcd', roles: [memberRole]},
    guild,
  )
  bot.user = new Discord.User(client, {id: 'bot-id'})
  guild.members.cache.set(bot.id, bot)

  const kody = new Discord.GuildMember(client, {nick: 'kody'}, guild)
  kody.user = new Discord.User(client, {
    id: 'kody-id',
    username: 'kodykoala',
    roles: [memberRole],
  })
  guild.members.cache.set(kody.id, kody)

  const talkToBotsChannel = new Discord.TextChannel(guild, {
    type: Discord.Constants.ChannelTypes.TEXT,
    id: 'talk-to-bots-id',
    name: '🤖-talk-to-bots',
  })
  jest
    .spyOn(talkToBotsChannel, 'send')
    .mockImplementation(content =>
      Promise.resolve(
        new Discord.Message(
          client,
          {id: 'help_test', content},
          talkToBotsChannel,
        ),
      ),
    )
  guild.channels.cache.set(talkToBotsChannel.id, talkToBotsChannel)
  return {client, guild, bot, kody, talkToBotsChannel}
}

module.exports = {makeFakeClient}
