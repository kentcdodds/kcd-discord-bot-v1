import type * as TDiscord from 'discord.js'
import * as Sentry from '@sentry/node'
import {getTextChannel} from '../utils'

async function cleanup(guild: TDiscord.Guild) {
  const channel = getTextChannel(guild, 'open-clubs')
  if (!channel) return

  const messages = Array.from((await channel.messages.fetch()).values())

  const oneWeek = 1000 * 60 * 60 * 24 * 7

  async function cleanupMessage(message: TDiscord.Message) {
    // we only want messages we sent
    if (!guild.client.user || message.author.id !== guild.client.user.id) return

    const clubCaptain = message.mentions.users.first()
    if (!clubCaptain) {
      Sentry.captureMessage(
        `An open club message is missing a club captain. Deleting the message.`,
      )
      await message.delete()
      return
    }

    // messages older than a week are deleted automatically
    const timeSinceMessage = new Date().getTime() - message.createdAt.getTime()
    if (timeSinceMessage > oneWeek) return message.delete()

    // when the club captain gives a 🏁 reaction, then delete the message
    if (message.reactions.cache.size < 1) return

    await Promise.all(
      message.reactions.cache.mapValues(reaction => reaction.fetch()),
    )

    const flagReaction = message.reactions.cache.find(
      ({emoji}) => emoji.name === '🏁',
    )

    if (!flagReaction) return

    await flagReaction.users.fetch()
    const captainWantsToDelete = flagReaction.users.cache.some(
      user => clubCaptain.id === user.id,
    )
    if (captainWantsToDelete) return message.delete()
  }

  return Promise.all(messages.map(cleanupMessage))
}

export {cleanup}
