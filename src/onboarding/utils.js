const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const {CONVERT_KIT_API_SECRET, CONVERT_KIT_API_KEY} = process.env

const welcomeChannelPrefix =
  process.env.NODE_ENV === 'production' ? '👋-welcome-' : '🌊-welcome-'

if (!CONVERT_KIT_API_SECRET) {
  throw new Error('CONVERT_KIT_API_SECRET env variable is required')
}
if (!CONVERT_KIT_API_KEY) {
  throw new Error('CONVERT_KIT_API_KEY env variable is required')
}

function getSubscriberEndpoint(email) {
  const url = new URL('https://api.convertkit.com/v3/subscribers')
  url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET)
  url.searchParams.set('email_address', email)
  return url.toString()
}

const sleep = t =>
  new Promise(resolve =>
    setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : t),
  )

const getSend = channel => async (...args) => {
  const result = await channel.send(...args)
  // wait a brief moment before continuing because channel.send doesn't
  // always resolve after the message is actually sent.
  await sleep(200)
  return result
}

async function getMessageContents(msg, answers, member) {
  if (typeof msg === 'function') {
    const result = await msg(answers, member)
    return result
  } else {
    return msg
  }
}

const getBotMessages = messages =>
  messages.filter(({author, client}) => author.id === client.user.id)

function getMemberId(channel) {
  return (
    channel.topic.match(/\(New Member ID: "(?<memberId>.*?)"\)/)?.groups
      ?.memberId ?? null
  )
}

function getMember(message) {
  // message must have been sent from the new member
  const memberId = getMemberId(message.channel)
  if (message.author.id !== memberId) return null

  const member = message.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  return member
}

const getWelcomeChannels = guild =>
  guild.channels.cache.filter(({name}) => name.startsWith(welcomeChannelPrefix))

const isMemberUnconfirmed = member => {
  return member.roles.cache.some(({name}) => {
    return name === 'Unconfirmed Member'
  })
}

const getMemberWelcomeChannel = member =>
  getWelcomeChannels(member.guild).find(
    channel => getMemberId(channel) === member.id,
  )

module.exports = {
  editErrorMessagePrefix,
  getSubscriberEndpoint,
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  welcomeChannelPrefix,
  getWelcomeChannels,
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getMessageContents,
  getBotMessages,
  getMember,
  getMemberId,
  getSend,
  sleep,
}
