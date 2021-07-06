import type * as TDiscord from 'discord.js'
import * as Sentry from '@sentry/node'
import {getSend, sleep, getCategoryChannel, timeToMs} from '../utils'

const warningStepMinute = 5
const defaultLifeTimeMinute = 60
const maxInactiveTimeMinute = 10
const forceDelayTimeTimute = 2
const eolReason = 'deleted for end of life 👻'
const inactivityReason = 'deleted for inactivity 🚶‍♀️'

async function cleanup(guild: TDiscord.Guild) {
  const categoryPrivateChat = getCategoryChannel(guild, 'private chat')
  if (!categoryPrivateChat) return

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
  ) as Array<TDiscord.TextChannel>

  // eslint-disable-next-line complexity
  async function cleanupPrivateChannel(channel: TDiscord.TextChannel) {
    const channelCreateDate = channel.createdAt
    const match = (channel.topic ?? '').match(
      /self-destruct at (?<utcDate>.*)$/i,
    )
    let currentExpirationDate = new Date(
      channel.createdAt.getTime() + timeToMs.minutes(defaultLifeTimeMinute),
    )
    if (match) {
      currentExpirationDate = new Date(match.groups?.utcDate ?? 'invalid')
      if (Number.isNaN(currentExpirationDate.getTime())) {
        Sentry.captureMessage(
          'Private chat with invalid expiration date. Deleting...',
        )
        return channel.delete()
      }
    }

    const timeSinceChannelCreation = Date.now() - channelCreateDate.getTime()
    const currentExpiration =
      currentExpirationDate.getTime() - channelCreateDate.getTime()

    const allMessages = Array.from((await channel.messages.fetch()).values())
    const botMessages = allMessages.filter(message => message.author.bot)
    const messages = allMessages
      .filter(message => !message.author.bot)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    let timeSinceLastMessage = timeSinceChannelCreation

    if (messages[0]) {
      timeSinceLastMessage = Date.now() - messages[0].createdTimestamp
    }

    const hasInactiveWarned = allMessages
      .reverse()
      .reduce((hasWarned, message) => {
        const isInactiveWarning =
          message.content.includes(`${warningStepMinute} minutes`) &&
          message.content.includes(inactivityReason) &&
          message.author.bot
        if (isInactiveWarning) return true

        if (!message.author.bot) return false

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
      let reason: string
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
        void sleep(10000).then(() => channel.delete(reason))
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
        currentExpiration - timeToMs.minutes(warningStepMinute)
      ) {
        reason = eolReason
      } else if (
        timeSinceLastMessage >
        timeToMs.minutes(maxInactiveTimeMinute) -
          timeToMs.minutes(warningStepMinute)
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

  await Promise.all(allActivePrivateChannels.map(cleanupPrivateChannel))
}

export {
  cleanup,
  warningStepMinute,
  defaultLifeTimeMinute,
  eolReason,
  inactivityReason,
  maxInactiveTimeMinute,
}

/*
eslint
  no-await-in-loop: "off",
*/
