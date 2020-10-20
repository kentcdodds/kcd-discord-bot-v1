/* eslint-disable no-await-in-loop */
const {getSend, sleep, getCategory, timeToMs} = require('../utils')

const warningStepMinute = 5
const defaultLifeTimeMinute = 60
const maxInactiveTimeMinute = 10
const forceDelayTimeTimute = 2
const eolReason = 'deleted for end of life 👻'
const inactivityReason = 'deleted for inactivity 🚶‍♀️'

async function cleanup(guild) {
  const categoryPrivateChat = getCategory(guild, {name: 'private chat'})

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

  async function cleanupPrivateChannel(channel) {
    const channelCreateDate = channel.createdAt
    const match = channel.topic.match(/self-destruct at (?<utcDate>.*)$/i)
    let currentExpirationDate = new Date(
      channel.createdAt + timeToMs.minutes(defaultLifeTimeMinute),
    )
    if (match && new Date(match.groups.utcDate))
      currentExpirationDate = new Date(match.groups.utcDate)

    const timeSinceChannelCreation = Date.now() - channelCreateDate
    const currentExpiration = currentExpirationDate - channelCreateDate

    const allMessages = Array.from((await channel.messages.fetch()).values())
    const botMessages = allMessages.filter(message => message.author?.bot)
    const messages = allMessages
      .filter(message => !message.author?.bot)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    let timeSinceLastMessage = timeSinceChannelCreation

    if (messages.length > 0) {
      timeSinceLastMessage = Date.now() - messages[0].createdTimestamp
    }

    const hasInactiveWarned = allMessages
      .reverse()
      .reduce((hasWarned, message) => {
        const isInactiveWarning =
          message.content.includes(`${warningStepMinute} minutes`) &&
          message.content.includes(inactivityReason) &&
          message.author?.bot
        if (isInactiveWarning) return true

        if (!message.author?.bot) return false

        return hasWarned
      }, false)

    const hasEOLWarned = botMessages.some(
      message =>
        message.content.includes(`${warningStepMinute} minutes`) &&
        message.content.includes(eolReason),
    )
    const isGettingDeleted = botMessages.some(message =>
      message.content.includes(
        'This channel is getting deleted for the following reason',
      ),
    )
    const send = getSend(channel)
    if (
      timeSinceChannelCreation > currentExpiration ||
      timeSinceLastMessage > timeToMs.minutes(maxInactiveTimeMinute)
    ) {
      let reason
      if (timeSinceChannelCreation > currentExpiration) {
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
        timeSinceChannelCreation - currentExpiration >
          timeToMs.minutes(forceDelayTimeTimute) ||
        timeSinceLastMessage - timeToMs.minutes(maxInactiveTimeMinute) >
          timeToMs.minutes(forceDelayTimeTimute)
      ) {
        await channel.delete(reason)
      }
    } else if (
      (timeSinceChannelCreation >
        currentExpiration - timeToMs.minutes(warningStepMinute) ||
        timeSinceLastMessage >
          timeToMs.minutes(maxInactiveTimeMinute) -
            timeToMs.minutes(warningStepMinute)) &&
      !hasInactiveWarned &&
      !hasEOLWarned
    ) {
      let reason
      if (
        timeSinceChannelCreation >
          currentExpiration - timeToMs.minutes(warningStepMinute) &&
        !hasEOLWarned
      ) {
        reason = eolReason
      } else if (
        timeSinceLastMessage >
          timeToMs.minutes(maxInactiveTimeMinute) -
            timeToMs.minutes(warningStepMinute) &&
        !hasInactiveWarned
      ) {
        reason = inactivityReason
      }
      if (reason) {
        await send(
          `
This channel will be deleted in ${warningStepMinute} minutes for the following reason: ${reason}
        `.trim(),
        )
      }
    }
  }

  return Promise.all(allActivePrivateChannels.map(cleanupPrivateChannel))
}

module.exports = {
  cleanup,
  warningStepMinute,
  defaultLifeTimeMinute,
  eolReason,
  inactivityReason,
}
