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
  const privateChatCategory = new Discord.CategoryChannel(guild, {
    type: Discord.Constants.ChannelTypes.CATEGORY,
    id: 'private-chat',
    name: 'PRIVATE CHAT',
  })
  guild.channels.cache.set(privateChatCategory.id, privateChatCategory)
  jest
    .spyOn(guild.channels, 'create')
    .mockImplementation((name, channelOptions) => {
      const {
        topic,
        nsfw,
        bitrate,
        userLimit,
        parent,
        permissionOverwrites,
        position,
        rateLimitPerUser,
      } = channelOptions
      const newChannel = new Discord.TextChannel(guild, {
        id: `${name}-id`,
        name,
        type: Discord.Constants.ChannelTypes.TEXT,
        topic,
        nsfw,
        bitrate,
        user_limit: userLimit,
        parent_id: parent,
        position,
        permission_overwrites: permissionOverwrites,
        rate_limit_per_user: rateLimitPerUser,
      })
      guild.channels.cache.set(newChannel.id, newChannel)
      jest
        .spyOn(newChannel, 'send')
        .mockImplementation(content =>
          Promise.resolve(
            new Discord.Message(client, {id: 'help_test', content}, newChannel),
          ),
        )
      return Promise.resolve(newChannel)
    })

  return {client, guild, bot, kody, talkToBotsChannel}
}

function createUser(client, username, guild) {
  const memberRole = guild.roles.cache.find(({name}) => name === 'Member')
  const newUser = new Discord.GuildMember(client, {nick: username}, guild)
  newUser.user = new Discord.User(client, {
    id: `${username}-id`,
    username,
    roles: [memberRole],
  })
  guild.members.cache.set(newUser.id, newUser)
  return newUser
}

module.exports = {makeFakeClient, createUser}
