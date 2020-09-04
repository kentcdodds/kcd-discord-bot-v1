const {newClubChannelPrefix, getMemberIdFromChannel} = require('../utils')

const finalMessage =
  'This channel will self-destruct in a little while. Thanks!'
const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

async function getMessageContents(msg, answers, member) {
  if (typeof msg === 'function') {
    const result = await msg(answers, member)
    return result
  } else {
    return msg
  }
}

function getCaptainFromChannel(channel) {
  if (!channel.name.startsWith(newClubChannelPrefix)) {
    return null
  }
  const memberId = getMemberIdFromChannel(channel)
  return channel.guild.members.cache.find(({user}) => user.id === memberId)
}

function getCaptainFromMessage(message) {
  // message must have been sent from the new member
  const memberId = getMemberIdFromChannel(message.channel)
  if (message.author.id !== memberId) return null

  const member = message.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  return member
}

module.exports = {
  ...require('../utils'),
  finalMessage,
  newClubChannelPrefix,
  editErrorMessagePrefix,
  getMessageContents,
  getCaptainFromMessage,
  getCaptainFromChannel,
}
