/* eslint-disable no-await-in-loop */
const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const DiscordManager = require('./DiscordManager')

async function createEmojis(guild) {
  const emojies = [
    'jest',
    'react',
    'reactquery',
    'nextjs',
    'gatsby',
    'remix',
    'graphql',
    'html',
    'css',
    'js',
    'node',
    'msw',
    'cypress',
    'ReactTestingLibrary',
    'DOMTestingLibrary',
  ]
  const guildEmojis = {}
  for (const emoji of emojies) {
    guildEmojis[emoji] = await guild.emojis.create(Buffer.from(emoji), emoji)
  }
  return guildEmojis
}

async function createChannels(client, guild) {
  const talkToBotsChannel = await guild.channels.create('🤖-talk-to-bots')
  guild.channels.cache.set(talkToBotsChannel.id, talkToBotsChannel)

  const privateChatCategory = await guild.channels.create('Private Chat', {
    type: 'CATEGORY',
  })
  guild.channels.cache.set(privateChatCategory.id, privateChatCategory)

  const onBoardingCategory = await guild.channels.create('Onboarding-1', {
    type: 'CATEGORY',
  })
  guild.channels.cache.set(onBoardingCategory.id, onBoardingCategory)

  const introductionChannel = await guild.channels.create('👶-introductions')
  guild.channels.cache.set(introductionChannel.id, introductionChannel)

  const botsOnlyChannel = await guild.channels.create('🤖-bots-only')
  guild.channels.cache.set(botsOnlyChannel.id, botsOnlyChannel)

  const officeHoursVoiceChannel = await guild.channels.create(
    `🏫 Kent's Office Hours`,
    {
      type: 'VOICE',
    },
  )
  guild.channels.cache.set(officeHoursVoiceChannel.id, officeHoursVoiceChannel)

  const officeHoursChannel = await guild.channels.create(`🏫-office-hours`)
  guild.channels.cache.set(officeHoursChannel.id, officeHoursChannel)

  const kentLiveVoiceChannel = await guild.channels.create(`💻-kent-live`, {
    type: 'VOICE',
  })
  guild.channels.cache.set(kentLiveVoiceChannel.id, kentLiveVoiceChannel)

  const kentLiveChannel = await guild.channels.create(`💻-kent-live`)
  guild.channels.cache.set(kentLiveChannel.id, kentLiveChannel)

  const thanksChannel = await guild.channels.create(`😍-thank-you`)
  guild.channels.cache.set(thanksChannel.id, thanksChannel)

  const streamerChannel = await guild.channels.create(`📅-stream-schedule`)
  guild.channels.cache.set(streamerChannel.id, streamerChannel)

  return {
    kentLiveChannel,
    kentLiveVoiceChannel,
    officeHoursChannel,
    officeHoursVoiceChannel,
    botsOnlyChannel,
    introductionChannel,
    onBoardingCategory,
    privateChatCategory,
    talkToBotsChannel,
    thanksChannel,
    streamerChannel,
  }
}

function createRoles(client, guild) {
  const everyoneRole = new Discord.Role(
    client,
    {id: guild.id, name: '@everyone'},
    guild,
  )
  guild.roles.cache.set(guild.id, everyoneRole)

  const officeHoursRole = new Discord.Role(
    client,
    {id: SnowflakeUtil.generate(), name: 'Notify: Office Hours'},
    guild,
  )
  guild.roles.cache.set(officeHoursRole.id, officeHoursRole)

  const liveStreamRole = new Discord.Role(
    client,
    {id: SnowflakeUtil.generate(), name: 'Notify: Kent Live'},
    guild,
  )
  guild.roles.cache.set(liveStreamRole.id, liveStreamRole)

  const unconfirmedRole = new Discord.Role(
    client,
    {id: SnowflakeUtil.generate(), name: 'Unconfirmed Member'},
    guild,
  )
  guild.roles.cache.set(unconfirmedRole.id, unconfirmedRole)

  const memberRole = new Discord.Role(
    client,
    {id: SnowflakeUtil.generate(), name: 'Member'},
    guild,
  )
  guild.roles.cache.set(memberRole.id, memberRole)

  const newConfirmedMemberRole = new Discord.Role(
    client,
    {id: SnowflakeUtil.generate(), name: 'New confirmed member'},
    guild,
  )
  guild.roles.cache.set(newConfirmedMemberRole.id, newConfirmedMemberRole)

  return {
    memberRole,
    unconfirmedRole,
    liveStreamRole,
    officeHoursRole,
    everyoneRole,
    newConfirmedMemberRole,
  }
}

async function makeFakeClient() {
  const client = new Discord.Client()
  Object.assign(client, {
    token: process.env.DISCORD_BOT_TOKEN,
    user: new Discord.ClientUser(client, {
      id: SnowflakeUtil.generate(),
      bot: true,
      username: 'BOT',
    }),
  })
  const guild = new Discord.Guild(client, {
    id: SnowflakeUtil.generate(),
    name: 'KCD',
  })

  DiscordManager.guilds[guild.id] = guild
  client.guilds.cache.set(guild.id, guild)

  const {memberRole} = createRoles(client, guild)
  const defaultChannels = await createChannels(client, guild)
  await createEmojis(guild)

  async function createUser(username, options = {}) {
    const newUser = new Discord.GuildMember(client, {nick: username}, guild)
    newUser.user = new Discord.User(client, {
      id: SnowflakeUtil.generate(),
      username,
      discriminator: client.users.cache.size,
      ...options,
    })
    guild.members.cache.set(newUser.id, newUser)
    await newUser.roles.add(memberRole)
    return newUser
  }

  const kody = await createUser('kody')

  function sendFromUser({
    user = kody,
    content = 'content',
    channel = defaultChannels.talkToBotsChannel,
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
    return userMessage
  }

  function reactFromUser({user = kody, message, reactionName = 'react'} = {}) {
    const emoji = guild.emojis.cache.find(({name}) => reactionName === name)
    let re = message.reactions.cache.get(emoji.name)
    if (!re) {
      re = {
        message,
        emoji: {name: emoji.name},
        users: {cache: new Discord.Collection()},
      }
      message.reactions.cache.set(emoji.name, re)
    }
    re.users.cache.set(user.id, user)
    return message
  }

  function cleanup() {
    DiscordManager.cleanup()
  }
  DiscordManager.clients.push(client)
  return {
    client,
    guild,
    bot: client.user,
    kody,
    defaultChannels,
    createUser,
    sendFromUser,
    reactFromUser,
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
