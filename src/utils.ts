import type * as TDiscord from 'discord.js'
import {setIntervalAsync} from 'set-interval-async/dynamic'
import rollbar from './rollbar'

const sleep = (t: number) =>
  new Promise(resolve =>
    process.env.NODE_ENV === 'test' ? resolve(t) : setTimeout(resolve, t),
  )

const privateChannelPrefix =
  process.env.NODE_ENV === 'production' ? '🤫-private-' : '😎-private-'

const welcomeChannelPrefix =
  process.env.NODE_ENV === 'production' ? '👋-welcome-' : '🌊-welcome-'

const meetupChannelPrefix =
  process.env.NODE_ENV === 'production' ? '💡 Meetup: ' : '🤪 Meetup: '

const isWelcomeChannel = (ch: TDiscord.TextChannel) =>
  ch.name.startsWith(welcomeChannelPrefix)

const isTextChannel = (ch: TDiscord.Channel): ch is TDiscord.TextChannel =>
  ch.type === 'text'

const isVoiceChannel = (ch: TDiscord.Channel): ch is TDiscord.VoiceChannel =>
  ch.type === 'voice'

const isCategoryChannel = (
  ch: TDiscord.Channel,
): ch is TDiscord.CategoryChannel => ch.type === 'category'

const getSend = (channel: TDiscord.TextChannel) => async (message: string) => {
  if (!message) {
    throw new Error('Attempting to call send with no message!')
  }
  const result = await channel.send(message)
  // wait a brief moment before continuing because channel.send doesn't
  // always resolve after the message is actually sent.
  await sleep(200)
  return result
}

const getBotMessages = (messages: Array<TDiscord.Message>) =>
  messages.filter(({author, client}) => author.id === client.user?.id)

function getMemberIdFromChannel(channel: TDiscord.TextChannel) {
  return (
    channel.topic?.match(/Member ID: "(?<memberId>.*?)"/)?.groups?.memberId ??
    null
  )
}

function getMember(guild: TDiscord.Guild | null, memberId: string) {
  // somehow the guild isn't always accessible
  if (!guild) return null
  return guild.members.cache.find(({user}) => user.id === memberId)
}

/**
 * The name will be lowercased and the first channel that includes the given
 * name will be returned
 */
function getChannel(
  guild: TDiscord.Guild | null,
  options: {name: string; type?: 'text'},
): null | TDiscord.TextChannel
function getChannel(
  guild: TDiscord.Guild | null,
  options: {name: string; type: 'voice'},
): null | TDiscord.VoiceChannel
function getChannel(
  guild: TDiscord.Guild | null,
  options: {name: string; type: 'category'},
): null | TDiscord.CategoryChannel

function getChannel(
  guild: TDiscord.Guild | null,
  {name, type = 'text'}: {name: string; type?: 'text' | 'voice' | 'category'},
) {
  const channel = guild?.channels.cache.find(
    ch =>
      ch.name.toLowerCase().includes(name.toLowerCase()) && type === ch.type,
  )
  if (!channel) {
    rollbar.warn(
      `Tried to find a channel "${name}" of type ${type} but could not find it`,
    )
    return null
  }
  return channel
}

const getTextChannel = (guild: TDiscord.Guild | null, name: string) =>
  getChannel(guild, {name})

const getVoiceChannel = (guild: TDiscord.Guild | null, name: string) =>
  getChannel(guild, {name, type: 'voice'})

const getCategoryChannel = (guild: TDiscord.Guild | null, name: string) =>
  getChannel(guild, {name, type: 'category'})

/**
 * The name will be lowercased and the first role with a lowercased name that
 * equals it will be returned.
 */
function getRole(guild: TDiscord.Guild, name: string) {
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === name.toLowerCase(),
  )
}

const prodRegex = /(^|\n)\?(?<command>\S+?)($| +)(?<args>(.|\n)*)/
const devRegex = /(^|\n)~(?<command>\S+?)($| +)(?<args>(.|\n)*)/
const commandPrefix =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
    ? '?'
    : '~'
const commandRegex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
    ? prodRegex
    : devRegex
const getCommandArgs = (string: string) =>
  string.match(commandRegex)?.groups?.args ?? ''
const isCommand = (string: string) => commandRegex.test(string)

// unfortunately TypeScript doesn't have Intl.ListFormat yet 😢
// so we'll just add it ourselves:
type ListFormatOptions = {
  type?: 'conjunction' | 'disjunction' | 'unit'
  style?: 'long' | 'short' | 'narrow'
  localeMatcher?: 'lookup' | 'best fit'
}
// I don't know how to make this work without a namespace
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  class ListFormat {
    constructor(locale: string, options: ListFormatOptions)
    public format: (items: Array<string>) => string
  }
}
type ListifyOptions<ItemType> = {
  type?: ListFormatOptions['type']
  style?: ListFormatOptions['style']
  stringify?: (item: ItemType) => string
}
function listify<ItemType>(
  array: Array<ItemType>,
  {
    type = 'conjunction',
    style = 'long',
    stringify = (thing: {toString(): string}) => thing.toString(),
  }: ListifyOptions<ItemType> = {},
) {
  const stringified = array.map(item => stringify(item))
  const formatter = new Intl.ListFormat('en', {style, type})
  try {
    return formatter.format(stringified)
  } catch (error: unknown) {
    rollbar.error('Trouble formatting this:', stringified)
    throw error
  }
}

const getMessageLink = (msg: TDiscord.Message) =>
  `https://discordapp.com/channels/${msg.guild?.id ?? '@me'}/${
    msg.channel.id
  }/${msg.id}`

// we'd just use the message.mentions here, but sometimes the mentions aren't there for some reason 🤷‍♂️
// so we parse it out ourselves
function getMentionedUser(
  message: TDiscord.Message,
): TDiscord.GuildMember | null {
  const mentionId = message.content.match(/<@!?(\d+)>/)?.[1]
  if (!mentionId) {
    rollbar.error(
      `This message (${getMessageLink(message)}) has no mentions: ${
        message.content
      }`,
    )
    return null
  }
  return message.guild?.members.cache.get(mentionId) ?? null
}

const timeToMs = {
  seconds: (t: number) => t * 1000,
  minutes: (t: number) => t * 1000 * 60,
  hours: (t: number) => t * 1000 * 60 * 60,
  days: (t: number) => t * 1000 * 60 * 60 * 24,
  weeks: (t: number) => t * 1000 * 60 * 60 * 24 * 7,
}

async function sendSelfDestructMessage(
  channel: TDiscord.TextChannel,
  messageContent: string,
  {
    time = 10,
    units = 'seconds',
  }: {time?: number; units?: keyof typeof timeToMs} = {},
) {
  return channel.send(
    `
${messageContent}

_This message will self-destruct in about ${time} ${units}_
    `.trim(),
  )
}

function getSelfDestructTime(messageContent: string) {
  const supportedUnits = Object.keys(timeToMs).join('|')
  const regex = new RegExp(
    `self-destruct in about (?<time>\\d+) (?<units>${supportedUnits})`,
    'i',
  )
  const match = messageContent.match(regex)
  if (!match) return null
  const {units, time} = match.groups as {
    time: string
    units: keyof typeof timeToMs
  }
  return timeToMs[units](Number(time))
}

async function sendBotMessageReply(msg: TDiscord.Message, reply: string) {
  const botsChannel = getTextChannel(msg.guild, 'talk-to-bots')
  if (!botsChannel) return
  if (botsChannel.id === msg.channel.id) {
    // if they sent this from the bot's channel then we'll just send the reply
    return botsChannel.send(reply)
  } else {
    // otherwise, we'll send the reply in the bots channel and let them know
    // where they can get the reply.
    const botMsg = await botsChannel.send(
      `
_Replying to ${msg.author} <${getMessageLink(msg)}>_
  
${reply}
      `.trim(),
    )
    if (msg.channel.type === 'text') {
      return sendSelfDestructMessage(
        msg.channel,
        `Hey ${msg.author}, I replied to you here: ${getMessageLink(botMsg)}`,
        {time: 7, units: 'seconds'},
      )
    }
  }
}

function getErrorStack(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.stack
  return 'Unknown Error'
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Unknown Error'
}

function botLog(guild: TDiscord.Guild, messageFn: () => string) {
  const botsChannel = getTextChannel(guild, 'bot-logs')
  if (!botsChannel) return

  let message: string
  try {
    message = messageFn()
  } catch (error: unknown) {
    console.error(`Unable to get message for bot log`, getErrorStack(error))
    return
  }

  const callerStack = new Error('Caller stack:')

  // fire and forget, who cares if it fails
  botsChannel.send(message).catch((error: unknown) => {
    console.error(
      `Unabel to log message: "${message}"`,
      getErrorStack(error),
      callerStack,
    )
  })
}

// read up on dynamic setIntervalAsync here: https://github.com/ealmansi/set-interval-async#dynamic-and-fixed-setintervalasync
function cleanupGuildOnInterval(
  client: TDiscord.Client,
  cb: (client: TDiscord.Guild) => Promise<unknown>,
  interval: number,
) {
  const uncaughtError = new Error(
    'Uncaught cleanupGuildOnInterval callback error',
  )
  setIntervalAsync(() => {
    return Promise.all(Array.from(client.guilds.cache.values()).map(cb)).catch(
      error => {
        rollbar.error(uncaughtError.stack, error)
      },
    )
  }, interval)
}

function typedBoolean<T>(
  value: T,
): value is Exclude<T, false | null | undefined | '' | 0> {
  return Boolean(value)
}

export {
  cleanupGuildOnInterval,
  rollbar,
  sleep,
  getSend,
  getMemberIdFromChannel,
  getBotMessages,
  getChannel,
  getTextChannel,
  getVoiceChannel,
  getCategoryChannel,
  getRole,
  commandPrefix,
  commandRegex,
  getCommandArgs,
  isCommand,
  getMember,
  listify,
  typedBoolean,
  getMessageLink,
  isWelcomeChannel,
  sendBotMessageReply,
  botLog,
  getErrorStack,
  getErrorMessage,
  getSelfDestructTime,
  welcomeChannelPrefix,
  privateChannelPrefix,
  meetupChannelPrefix,
  getMentionedUser,
  sendSelfDestructMessage,
  timeToMs,
  isTextChannel,
  isVoiceChannel,
  isCategoryChannel,
}
