import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {DiscordManager} from './DiscordManager'

type Handler<Data = unknown, Return = unknown> = {handle(data: Data): Return}
type ClientActions = {
  MessageDelete: Handler
  MessageUpdate: Handler
  ChannelUpdate: Handler
  ChannelDelete: Handler
  MessageReactionAdd: Handler<
    {
      channel_id: string
      message_id: string
      user_id: string
      emoji: {name: string; id?: string}
    },
    | {
        message: TDiscord.Message
        reaction: TDiscord.MessageReaction
        user: TDiscord.User
      }
    | false
  >
  MessageCreate: Handler<
    {
      id: string
      content: string
      author: TDiscord.User
      channel_id: string
    },
    {message?: TDiscord.Message}
  >
  MessageReactionRemoveEmoji: Handler<
    {
      channel_id: string
      message_id: string
      emoji: {name: string; id: string | null}
    },
    {reaction: TDiscord.MessageReaction} | false
  >
}

const getClientActions = (client: TDiscord.Client): ClientActions => {
  // @ts-expect-error client.actions is psuedo-private, but we accept the risks
  return client.actions
}

async function createEmojis(guild: TDiscord.Guild) {
  const emojies = [
    'botask',
    'botofficehours',
    'botdontasktoask',
    'botdouble',
    'bothelp',
    'botgender',
    'jest',
    'react',
    'reactquery',
    'nextjs',
    'gatsby',
    'remix',
    'graphql',
    'html',
    'css',
    'javascript',
    'typescript',
    'nodejs',
    'msw',
    'cypress',
    'reacttestinglibrary',
    'domtestinglibrary',
  ]
  const guildEmojis: Record<string, TDiscord.GuildEmoji> = {}
  for (const emoji of emojies) {
    guildEmojis[emoji] = await guild.emojis.create(Buffer.from(emoji), emoji)
  }
  return guildEmojis
}

type Await<Type> = Type extends Promise<infer Value> ? Await<Value> : Type

async function awaitObject<Promises extends Record<string, Promise<unknown>>>(
  promises: Promises,
) {
  const entries = Object.entries(promises)
  const resolvedPromises = await Promise.all(
    entries.map(([, promise]) => promise),
  )
  return entries
    .map(([key], index) => ({[key]: resolvedPromises[index]}))
    .reduce((acc, obj) => ({...acc, ...obj}), {}) as {
    [Key in keyof Promises]: Await<Promises[Key]>
  }
}

async function createChannels(guild: TDiscord.Guild) {
  const channels = await awaitObject({
    privateChatCategory: guild.channels.create('Private Chat', {
      type: 'category',
    }),
    onBoardingCategory: guild.channels.create('Onboarding-1', {
      type: 'category',
    }),
    meetupsCategory: guild.channels.create('Meetups', {type: 'category'}),
    generalChannel: guild.channels.create('💬-general'),
    kcdOfficeHoursChannel: guild.channels.create('🏫-kcd-office-hours'),
    introductionChannel: guild.channels.create('👶-introductions'),
    tipsChannel: guild.channels.create('💁-tips'),
    botLogsChannel: guild.channels.create('🤖-bot-logs'),
    thanksChannel: guild.channels.create(`😍-thank-you`),
    scheduledMeetupsChannel: guild.channels.create(`⏱-upcoming-meetups`),
    followMeChannel: guild.channels.create('➡️-follow-me'),
    meetupNotificationsChannel: guild.channels.create(
      '🔔-meetup-notifications',
    ),
    talkToBotsChannel: guild.channels.create('🤖-talk-to-bots'),
    botMessagesChannel: guild.channels.create('🤖-bot-messages'),
  })

  for (const channel of Object.values(channels)) {
    guild.channels.cache.set(channel.id, channel)
  }

  return channels
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
    {
      id: SnowflakeUtil.generate(),
      name: 'New confirmed member',
    },
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
  const defaultChannels = await createChannels(guild)
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

  const kody = await createUser('kody', {id: SnowflakeUtil.generate()})
  const marty = await createUser('marty', {id: SnowflakeUtil.generate()})
  const hannah = await createUser('hannah', {id: SnowflakeUtil.generate()})

  function sendFromUser({
    user = kody,
    content = 'content',
    channel = defaultChannels.talkToBotsChannel,
  } = {}) {
    const messageData = {
      id: SnowflakeUtil.generate(),
      content,
      author: user.user,
      channel_id: channel.id,
    }
    const {message} = getClientActions(client).MessageCreate.handle(messageData)
    if (!message) {
      throw new Error(
        `Failed to sendFromUser: ${user} in ${channel} with content:\n${content}`,
      )
    }
    return message
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
    )
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
  {timeout = 3000, interval = 100} = {},
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
