async function cleanup(guild) {
  const channel = guild.channels.cache.find(
    ({name, type}) =>
      name.toLowerCase().includes('active-clubs') && type === 'text',
  )

  const messages = Array.from((await channel.messages.fetch()).values())

  const oneWeek = 1000 * 60 * 60 * 24 * 7
  const messageDeletes = messages
    .map(message => {
      return async () => {
        // we only want messages we sent
        if (message.author.id !== guild.client.user.id) return

        // messages older than a week are deleted automatically
        const timeSinceMessage = new Date() - message.createdAt
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
        const clubCaptain = message.mentions.users.first()
        const captainWantsToDelete = flagReaction.users.cache.some(
          user => clubCaptain.id === user.id,
        )
        if (captainWantsToDelete) return message.delete()
      }
    })
    .map(fn => fn())

  return Promise.all(messageDeletes)
}

module.exports = {cleanup}
