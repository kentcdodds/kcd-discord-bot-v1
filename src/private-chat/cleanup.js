const {getSend, sleep} = require('../utils')
const warnedChannels = new Set()

async function cleanup(guild) {
  const categoryPrivateChat = guild.channels.cache.find(
    ({name, type}) =>
      type === 'category' && name.toLowerCase().includes('private chat'),
  )

  const warningStep = 1000 * 60 * 5
  const maxExistingTime = 1000 * 60 * 60
  const maxInactiveTime = 1000 * 60 * 10
  const eolReason = 'deleted for end of life 👻'
  const inactivityReason = 'deleted for inactivity 🚶‍♀️'

  const allActivePrivateChannels = guild.channels.cache.filter(
    channel =>
      channel.type === 'text' &&
      channel.parentID === categoryPrivateChat.id &&
      channel.name.includes('-private-') &&
      !channel.deleted,
  )

  allActivePrivateChannels.forEach(async channel => {
    const channelCreateDate = channel.createdAt
    const lastMessageDate = channel.lastMessage?.createdAt ?? channelCreateDate
    const timeSinceChannelCreation = new Date() - channelCreateDate
    const timeSinceLastMessage = new Date() - lastMessageDate
    const send = getSend(channel)
    if (
      timeSinceChannelCreation > maxExistingTime ||
      timeSinceLastMessage > maxInactiveTime
    ) {
      let reason
      if (timeSinceChannelCreation > maxExistingTime) {
        reason = eolReason
      } else {
        reason = inactivityReason
      }
      await send(
        `
    This channel is getting deleted for the following reason: ${reason}
    
    Goodbye 👋
        `.trim(),
      )

      // Give just a while for the users to understand that the channel will be deleted soon
      await sleep(3000)
      await channel.delete(reason)
      return
    }

    if (
      (timeSinceChannelCreation > maxExistingTime - warningStep ||
        timeSinceLastMessage > maxInactiveTime - warningStep) &&
      !warnedChannels.has(channel.id)
    ) {
      let reason
      if (timeSinceChannelCreation > maxExistingTime - warningStep) {
        reason = eolReason
      } else {
        reason = inactivityReason
      }
      await send(
        `
    This channel will be deleted in 5 minutes for the following reason: ${reason}
        `.trim(),
      )
      warnedChannels.add(channel.id)
    }
  })
}

module.exports = {cleanup}
