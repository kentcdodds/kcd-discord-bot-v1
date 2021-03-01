import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {DiscordManager} from './DiscordManager'

type Handler = {handle(data: unknown): unknown}
type ClientActions = {
  MessageDelete: Handler
  MessageUpdate: Handler
  ChannelUpdate: Handler
  ChannelDelete: Handler
  MessageReactionAdd: Handler
}
const getClientActions = (client: TDiscord.Client): ClientActions => {
  // @ts-expect-error client.actions is psuedo-private, but we accept the risks
  return client.actions
}

async function createEmojis(guild: TDiscord.Guild) {
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
  const guildEmojis: Record<string, TDiscord.GuildEmoji> = {}
  for (const emoji of emojies) {
    guildEmojis[emoji] = await guild.emojis.create(Buffer.from(emoji), emoji)
  }
  return guildEmojis
}

async function createChannels(client: TDiscord.Client, guild: TDiscord.Guild) {
  const talkToBotsChannel = await guild.channels.create('🤖-talk-to-bots')
  guild.channels.cache.set(talkToBotsChannel.id, talkToBotsChannel)

  const privateChatCategory = await guild.channels.create('Private Chat', {
    type: 'category',
  })
  guild.channels.cache.set(privateChatCategory.id, privateChatCategory)

  const onBoardingCategory = await guild.channels.create('Onboarding-1', {
    type: 'category',
  })
  guild.channels.cache.set(onBoardingCategory.id, onBoardingCategory)

  const meetupsCategory = await guild.channels.create('Meetups', {
    type: 'category',
  })
  guild.channels.cache.set(meetupsCategory.id, meetupsCategory)

  const introductionChannel = await guild.channels.create('👶-introductions')
  guild.channels.cache.set(introductionChannel.id, introductionChannel)

  const tipsChannel = await guild.channels.create('💁-tips')
  guild.channels.cache.set(tipsChannel.id, tipsChannel)

  const botsOnlyChannel = await guild.channels.create('🤖-bots-only')
  guild.channels.cache.set(botsOnlyChannel.id, botsOnlyChannel)

  const thanksChannel = await guild.channels.create(`😍-thank-you`)
  guild.channels.cache.set(thanksChannel.id, thanksChannel)

  const scheduledMeetupsChannel = await guild.channels.create(
    `⏱-upcoming-meetups`,
  )
  guild.channels.cache.set(scheduledMeetupsChannel.id, scheduledMeetupsChannel)

  const followMeChannel = await guild.channels.create('➡️-follow-me')
  guild.channels.cache.set(followMeChannel.id, followMeChannel)

  const meetupNotificationsChannel = await guild.channels.create(
    '🔔-meetup-notifications',
  )
  guild.channels.cache.set(
    meetupNotificationsChannel.id,
    meetupNotificationsChannel,
  )

  return {
    tipsChannel,
    botsOnlyChannel,
    introductionChannel,
    onBoardingCategory,
    privateChatCategory,
    talkToBotsChannel,
    thanksChannel,
    scheduledMeetupsChannel,
    followMeChannel,
    meetupNotificationsChannel,
  }
}

function createRoles(client: TDiscord.Client, guild: TDiscord.Guild) {
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

  async function createUser(username: string, options = {}) {
    const newMember = new Discord.GuildMember(client, {nick: username}, guild)
    newMember.user = new Discord.User(client, {
      id: SnowflakeUtil.generate(),
      username,
      discriminator: client.users.cache.size,
      ...options,
    })
    guild.members.cache.set(newMember.id, newMember)
    client.users.cache.set(newMember.id, newMember.user)
    await newMember.roles.add(memberRole)
    return newMember
  }

  const kody = await createUser('kody')
  const marty = await createUser('marty')
  const hannah = await createUser('hannah')

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

  function reactFromUser({
    user = kody,
    message,
    reactionName,
    emoji = guild.emojis.cache.find(({name}) => reactionName === name),
  }:
    | {
        user?: TDiscord.GuildMember | TDiscord.User
        message?: TDiscord.Message | null
        reactionName: string
        emoji?: {name: string; id?: string}
      }
    | {
        user?: TDiscord.GuildMember | TDiscord.User
        message?: TDiscord.Message | null
        reactionName?: string
        emoji: {name: string; id?: string}
      }) {
    if (!message) {
      throw new Error(
        `Tried to react to a message but did not provide a message`,
      )
    }
    if (!emoji) {
      throw new Error(
        `No guild emoji found with the name ${
          typeof reactionName === 'undefined' ? 'NO NAME GIVEN' : reactionName
        }`,
      )
    }
    const handleData = {
      channel_id: message.channel.id,
      message_id: message.id,
      user_id: user.id,
      emoji: {name: emoji.name, id: emoji.id},
    }
    const result = getClientActions(client).MessageReactionAdd.handle(
      handleData,
    ) as
      | {
          message: TDiscord.Message
          reaction: TDiscord.MessageReaction
          user: TDiscord.User
        }
      | false
    if (result) {
      let reactionsMap = DiscordManager.reactions[result.message.id]
      if (!reactionsMap) {
        reactionsMap = {}
        DiscordManager.reactions[result.message.id] = reactionsMap
      }
      reactionsMap[result.reaction.emoji.name] = result.reaction
    } else {
      console.warn('reactFromUser did not work', handleData)
    }
    return result
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
    marty,
    hannah,
    defaultChannels,
    createUser,
    sendFromUser,
    reactFromUser,
    cleanup,
  }
}

function waitUntil(
  expectation: () => void,
  {timeout = 3000, interval = 1000} = {},
) {
  if (interval < 1) interval = 1
  const maxTries = Math.ceil(timeout / interval)
  let tries = 0
  return new Promise((resolve, reject) => {
    const rejectOrRerun = (error: unknown) => {
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
          .then(() => resolve(undefined))
          .catch(rejectOrRerun)
      } catch (error: unknown) {
        rejectOrRerun(error)
      }
    }
    setTimeout(runExpectation, 0)
  })
}

export {makeFakeClient, waitUntil, DiscordManager, getClientActions}
/*
eslint
  no-await-in-loop: "off",
*/
