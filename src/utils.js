const rollbar = require('./rollbar')
const sleep = t =>
  new Promise(resolve =>
    setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : t),
  )

const privateChannelPrefix =
  process.env.NODE_ENV === 'production' ? '🤫-private-' : '😎-private-'

const welcomeChannelPrefix =
  process.env.NODE_ENV === 'production' ? '👋-welcome-' : '🌊-welcome-'

const isWelcomeChannel = ch => ch.name.startsWith(welcomeChannelPrefix)
const getSend = channel => async (...args) => {
  const result = await channel.send(...args)
  // wait a brief moment before continuing because channel.send doesn't
  // always resolve after the message is actually sent.
  await sleep(200)
  return result
}

const getBotMessages = messages =>
  messages.filter(({author, client}) => author.id === client.user.id)

function getMemberIdFromChannel(channel) {
  return (
    channel.topic.match(/Member ID: "(?<memberId>.*?)"/)?.groups?.memberId ??
    null
  )
}

function getMember(guild, memberId) {
  const member = guild.members.cache.find(({user}) => user.id === memberId)

  return member
}

/**
 * The name will be lowercased and the first channel that includes the given
 * name will be returned
 * @param {*} guild the guild to find the channel in
 * @param {{name: string, type: 'text' | 'voice'}} searchOptions
 */
function getChannel(guild, {name, type = 'text'}) {
  return guild.channels.cache.find(
    ch =>
      ch.name.toLowerCase().includes(name.toLowerCase()) && type === ch.type,
  )
}

/**
 * The name will be lowercased and the first channel with a lowercased name that
 * equals it will be returned.
 * @param {*} guild the guild to find the role in
 * @param {{name: string}} searchOptions
 */
function getRole(guild, {name}) {
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === name.toLowerCase(),
  )
}

const prodRegex = /^\?(?<command>\S+?)($| )(?<args>(.|\n)*)/
const devRegex = /^~(?<command>\S+?)($| )(?<args>(.|\n)*)/
const commandPrefix =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
    ? '?'
    : '~'
const commandRegex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
    ? prodRegex
    : devRegex
const getCommandArgs = string =>
  string.match(commandRegex)?.groups?.args ?? null
const isCommand = string => commandRegex.test(string)

const listify = (
  array,
  {conjunction = 'and ', stringify = JSON.stringify} = {},
) =>
  array.reduce((list, item, index) => {
    if (index === 0) return stringify(item)
    if (index === array.length - 1) {
      if (index === 1) return `${list} ${conjunction}${stringify(item)}`
      else return `${list}, ${conjunction}${stringify(item)}`
    }
    return `${list}, ${stringify(item)}`
  }, '')

const getMessageLink = msg =>
  `https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`

module.exports = {
  rollbar,
  sleep,
  getSend,
  getMemberIdFromChannel,
  getBotMessages,
  getChannel,
  getRole,
  commandPrefix,
  commandRegex,
  getCommandArgs,
  isCommand,
  getMember,
  listify,
  getMessageLink,
  isWelcomeChannel,
  welcomeChannelPrefix,
  privateChannelPrefix,
}
