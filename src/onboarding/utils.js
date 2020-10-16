const {
  sleep,
  getSend,
  getMemberIdFromChannel,
  isWelcomeChannel,
} = require('../utils')

const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const {CONVERT_KIT_API_SECRET, CONVERT_KIT_API_KEY} = process.env

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

async function getMessageContents(msg, answers, member) {
  if (typeof msg === 'function') {
    const result = await msg(answers, member)
    return result
  } else {
    return msg
  }
}

const getWelcomeChannels = guild =>
  guild.channels.cache.filter(isWelcomeChannel)

const isMemberUnconfirmed = member => {
  return member.roles.cache.some(({name}) => {
    return name === 'Unconfirmed Member'
  })
}

const getMemberWelcomeChannel = member =>
  getWelcomeChannels(member.guild).find(
    channel => getMemberIdFromChannel(channel) === member.id,
  )

module.exports = {
  ...require('../utils'),
  editErrorMessagePrefix,
  getSubscriberEndpoint,
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  getWelcomeChannels,
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getMessageContents,
  getMemberIdFromChannel,
  getSend,
  sleep,
}
