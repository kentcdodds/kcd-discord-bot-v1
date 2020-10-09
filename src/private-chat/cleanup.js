/* eslint-disable no-await-in-loop */
const {getSend, sleep, getCategory} = require('../utils')

async function cleanup(guild) {
  const categoryPrivateChat = getCategory(guild, {name: 'private chat'})

  const warningStep = 1000 * 60 * 5
  const maxExistingTime = 1000 * 60 * 60
  const maxInactiveTime = 1000 * 60 * 10
  const forceDelayTime = 1000 * 60 * 2
  const eolReason = 'deleted for end of life 👻'
  const inactivityReason = 'deleted for inactivity 🚶‍♀️'

  const allActivePrivateChannels = Array.from(
    guild.channels.cache
      .filter(
        channel =>
          channel.type === 'text' &&
          channel.parentID === categoryPrivateChat.id &&
          channel.name.includes('-private-') &&
          !channel.deleted,
      )
      .values(),
  )

  for (const channel of allActivePrivateChannels) {
    const channelCreateDate = channel.createdAt

    const timeSinceChannelCreation = Date.now() - channelCreateDate

    const allMessages = Array.from((await channel.messages.fetch()).values())
    const botMessages = allMessages.filter(message => message.author?.bot)
    const messages = allMessages
      .filter(message => !message.author?.bot)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    let timeSinceLastMessage = timeSinceChannelCreation

    if (messages.length > 0) {
      timeSinceLastMessage = Date.now() - messages[0].createdTimestamp
    }

    const hasInactiveWarned = botMessages.some(message => {
      return (
        message.content.includes('5 minutes') &&
        message.content.includes(inactivityReason)
      )
    })
    const hasEOLWarned = botMessages.some(
      message =>
        message.content.includes('5 minutes') &&
        message.content.includes(eolReason),
    )
    const isGettingDeleted = botMessages.some(message =>
      message.content.includes(
        'This channel is getting deleted for the following reason',
      ),
    )
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
      if (!isGettingDeleted) {
        await send(
          `
  This channel is getting deleted for the following reason: ${reason}
  
  Goodbye 👋
          `.trim(),
        )
        // Give just a while for the users to understand that the channel will be deleted soon
        sleep(10000).then(() => {
          channel.delete(reason)
        })
      }
      // After two minute from deletion we try to delate the channel again
      // Maybe the server was stopped and the previous sleep was not finished
      if (
        timeSinceChannelCreation - maxExistingTime > forceDelayTime ||
        timeSinceLastMessage - maxInactiveTime > forceDelayTime
      ) {
        await channel.delete(reason)
      }
    } else if (
      (timeSinceChannelCreation > maxExistingTime - warningStep ||
        timeSinceLastMessage > maxInactiveTime - warningStep) &&
      !hasInactiveWarned &&
      !hasEOLWarned
    ) {
      let reason
      if (
        timeSinceChannelCreation > maxExistingTime - warningStep &&
        !hasEOLWarned
      ) {
        reason = eolReason
      } else if (
        timeSinceLastMessage > maxInactiveTime - warningStep &&
        !hasInactiveWarned
      ) {
        reason = inactivityReason
      }
      if (reason) {
        await send(
          `
This channel will be deleted in 5 minutes for the following reason: ${reason}
        `.trim(),
        )
      }
    }
  }
}

module.exports = {cleanup}
