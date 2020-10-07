const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const DiscordManager = require('./DiscordManager')

async function makeFakeClient() {
  const client = new Discord.Client()
  Object.assign(client, {
    token: process.env.DISCORD_BOT_TOKEN,
    user: new Discord.ClientUser(client, {
      id: SnowflakeUtil.generate(),
      bot: true,
      username: 'kcd',
    }),
  })
  const guild = new Discord.Guild(client, {
    id: SnowflakeUtil.generate(),
    name: 'KCD',
  })
  guild.messages = []
  DiscordManager.guilds[guild.id] = guild
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
    {id: SnowflakeUtil.generate(), name: 'Member'},
    guild,
  )
  guild.roles.cache.set(memberRole.id, memberRole)

  let bot = new Discord.GuildMember(client, {bot: true, username: 'kcd'}, guild)
  bot.user = new Discord.User(client, {id: SnowflakeUtil.generate()})
  bot = await bot.roles.add([memberRole])
  guild.members.cache.set(bot.id, bot)

  let kody = new Discord.GuildMember(client, {nick: 'kody'}, guild)
  kody.user = new Discord.User(client, {
    id: SnowflakeUtil.generate(),
    username: 'kodykoala',
  })
  kody = await kody.roles.add([memberRole])
  guild.members.cache.set(kody.id, kody)

  const talkToBotsChannel = await guild.channels.create('🤖-talk-to-bots')
  guild.channels.cache.set(talkToBotsChannel.id, talkToBotsChannel)

  const privateChatCategory = await guild.channels.create('PRIVATE CHAT', {
    type: 'CATEGORY',
  })
  guild.channels.cache.set(privateChatCategory.id, privateChatCategory)

  function createUser(username) {
    const newUser = new Discord.GuildMember(client, {nick: username}, guild)
    newUser.user = new Discord.User(client, {
      id: SnowflakeUtil.generate(),
      username,
      roles: [memberRole],
    })
    guild.members.cache.set(newUser.id, newUser)
    return newUser
  }

  function addUserMessage({
    user = kody,
    content = 'content',
    channel = talkToBotsChannel,
  } = {}) {
    const userMessage = new Discord.Message(
      client,
      {
        id: SnowflakeUtil.generate(Date.now()),
        content,
        author: user,
      },
      channel,
    )
    channel.messages.cache.set(userMessage.id, userMessage)
  }

  function cleanup() {
    DiscordManager.channels = {}
    DiscordManager.guilds = {}
  }

  return {
    client,
    guild,
    bot,
    kody,
    talkToBotsChannel,
    createUser,
    addUserMessage,
    cleanup,
  }
}

function waitUntil(expectation, {timeout = 3000, interval = 1000} = {}) {
  if (interval < 1) interval = 1
  const maxTries = Math.ceil(timeout / interval)
  let tries = 0
  return new Promise((resolve, reject) => {
    const rejectOrRerun = error => {
      if (tries > maxTries) {
        reject(error)
        return
      }
      setTimeout(runExpectation, interval)
    }
    function runExpectation() {
      tries += 1
      try {
        Promise.resolve(expectation())
          .then(() => resolve())
          .catch(rejectOrRerun)
      } catch (error) {
        rejectOrRerun(error)
      }
    }
    setTimeout(runExpectation, 0)
  })
}

module.exports = {
  makeFakeClient,
  waitUntil,
  DiscordManager,
}
