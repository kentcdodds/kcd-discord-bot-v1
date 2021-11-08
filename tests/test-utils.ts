import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {RawRoleData} from 'discord.js/typings/rawDataTypes'
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
    'botconfirm',
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
      type: 'GUILD_CATEGORY',
    }),
    onBoardingCategory: guild.channels.create('Onboarding-1', {
      type: 'GUILD_CATEGORY',
    }),
    meetupsCategory: guild.channels.create('Meetups', {type: 'GUILD_CATEGORY'}),
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
  function createRole({
    id = SnowflakeUtil.generate(),
    name,
  }: Partial<RawRoleData> & {name: string}): TDiscord.Role {
    // @ts-expect-error this is private, but I mean... I need it...
    const role: TDiscord.Role = new Discord.Role(
      client,
      {
        id,
        name,
        color: 0x0001,
        hoist: false,
        position: 1,
        permissions: '',
        managed: true,
        mentionable: true,
      },
      guild,
    )
    guild.roles.cache.set(id, role)
    return role
  }
  const everyoneRole = createRole({id: guild.id, name: '@everyone'})

  const officeHoursRole = createRole({name: 'Notify: Office Hours'})

  const liveStreamRole = createRole({name: 'Notify: Kent Live'})

  const unconfirmedRole = createRole({name: 'Unconfirmed Member'})

  const memberRole = createRole({name: 'Member'})

  const newConfirmedMemberRole = createRole({
    name: 'New confirmed member',
  })

  return {
    memberRole,
    unconfirmedRole,
    liveStreamRole,
    officeHoursRole,
    everyoneRole,
    newConfirmedMemberRole,
  }
}

// eslint-disable-next-line max-lines-per-function
async function makeFakeClient() {
  const client = new Discord.Client({
    intents: [
      'GUILDS',
      'GUILD_MEMBERS',
      'GUILD_EMOJIS_AND_STICKERS',
      'GUILD_MESSAGES',
      'GUILD_MESSAGE_REACTIONS',
    ],
  })
  Object.assign(client, {
    token: process.env.DISCORD_BOT_TOKEN,
    // @ts-expect-error this is protected, but I need it for tests...
    user: new Discord.ClientUser(client, {
      id: SnowflakeUtil.generate(),
      bot: true,
      username: 'BOT',
    }),
  })
  // @ts-expect-error this is protected, but I need it for tests...
  const kent = new Discord.User(client, {
    id: SnowflakeUtil.generate(),
    username: 'kentcdodds',
    discriminator: '0001',
  })

  const guild = new Discord.Guild(client, {
    // most of these values are made up...
    id: SnowflakeUtil.generate(),
    name: 'KCD',
    discovery_splash: null,
    owner_id: kent.id,
    icon: null,
    splash: null,
    region: '',
    afk_channel_id: null,
    afk_timeout: 1000,
    verification_level: 0,
    default_message_notifications: 1,
    explicit_content_filter: 2,
    roles: [],
    emojis: [],
    features: [],
    mfa_level: 0,
    application_id: null,
    system_channel_id: null,
    system_channel_flags: 1,
    rules_channel_id: null,
    vanity_url_code: null,
    description: null,
    banner: null,
    premium_tier: 3,
    preferred_locale: 'en-US',
    public_updates_channel_id: null,
    nsfw_level: 2,
    stickers: [],
  })

  DiscordManager.guilds[guild.id] = guild
  client.guilds.cache.set(guild.id, guild)

  const {memberRole} = createRoles(client, guild)

  const defaultChannels = await createChannels(guild)

  await createEmojis(guild)

  async function createUser(
    username: string,
    options = {},
  ): Promise<TDiscord.GuildMember> {
    // @ts-expect-error this is private, but I need it for tests...
    const newMember: TDiscord.GuildMember = new Discord.GuildMember(
      client,
      {nick: username},
      guild,
    )

    // @ts-expect-error this is protected, but I need it for tests...
    const newUser: TDiscord.User = new Discord.User(client, {
      id: SnowflakeUtil.generate(),
      username,
      discriminator: '0001',
      ...options,
    })
    newMember.user = newUser
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
  }: {
    user?: TDiscord.GuildMember | TDiscord.User
    message?: TDiscord.Message | null
  } & (
    | {
        reactionName: string
        emoji?: never
      }
    | {
        reactionName?: never
        emoji: {name: string; id?: string} | TDiscord.GuildEmoji
      }
  )) {
    if (!message) {
      throw new Error(
        `Tried to react to a message but did not provide a message`,
      )
    }
    if (typeof emoji === 'undefined' || !emoji.name || !emoji.id) {
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
      if (result.reaction.emoji.name === null) {
        throw new Error('emoji name should not be null')
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
