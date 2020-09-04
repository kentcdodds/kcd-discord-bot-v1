const {
  newClubChannelPrefix,
  getMemberIdFromChannel,
  getSend,
  finalMessage,
} = require('./utils')
const {deleteClubChannel} = require('./delete-club-channel')
const {handleNewMessage} = require('./handle-new-message')

async function cleanup(guild) {
  return Promise.all([deleteChannels(guild), deleteActiveClubMessages(guild)])
}

async function deleteActiveClubMessages(guild) {
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

function deleteChannels(guild) {
  const maxWaitingTime = 1000 * 60 * 12
  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted after a while. Don't worry though, you can always try again later when you have time to finish.`
  const spamWarningMessageContent = `you're sending a lot of messages, this channel will get deleted automatically if you send too many.`

  const newClubChannels = Array.from(
    guild.channels.cache
      .filter(({name}) => name.startsWith(newClubChannelPrefix))
      .values(),
  )

  const channelDeletes = newClubChannels
    .map(channel => {
      const send = getSend(channel)
      return async () => {
        // load all the messages so we can get the last message
        await Promise.all([channel.messages.fetch(), channel.fetch()])

        const {lastMessage} = channel

        const memberId = getMemberIdFromChannel(channel)
        const member = guild.members.cache.find(
          ({user}) => user.id === memberId,
        )

        // somehow the member is gone (maybe they left the server?)
        // delete the channel
        if (!member || !lastMessage) {
          await deleteClubChannel(
            channel,
            'Member is not in the server anymore. May have left the server.',
          )
          return
        }

        // if they're getting close to too many messages, give them a warning
        if (channel.messages.cache.size > tooManyMessages * 0.7) {
          const hasWarned = channel.messages.cache.find(({content}) =>
            content.includes(spamWarningMessageContent),
          )
          if (!hasWarned) {
            await send(`Whoa ${member?.user}, ${spamWarningMessageContent}`)
          }
        }

        if (channel.messages.cache.size > tooManyMessages) {
          // they sent way too many messages... Spam probably...
          return deleteClubChannel(channel, 'Too many messages')
        }

        if (lastMessage.author.id === member.id) {
          // they sent us something and we haven't responded yet
          // this happens if the bot goes down for some reason (normally when we redeploy)
          const timeSinceLastMessage = new Date() - lastMessage.createdAt
          if (timeSinceLastMessage > 2 * 1000) {
            // if it's been a while and we haven't handled the last message
            // then let's handle it now.
            await handleNewMessage(lastMessage)
          }
        } else {
          // check whether we've heard from them in a while...
          const timeSinceLastMessage = new Date() - lastMessage.createdAt
          if (timeSinceLastMessage > maxWaitingTime) {
            return deleteClubChannel(
              channel,
              lastMessage.content.includes(finalMessage)
                ? 'New club creation finished'
                : 'New club creation timed out',
            )
          } else if (
            timeSinceLastMessage > maxWaitingTime * 0.7 &&
            !lastMessage.content.includes(timeoutWarningMessageContent) &&
            !lastMessage.content.includes(finalMessage)
          ) {
            return send(`Hi ${member.user}, ${timeoutWarningMessageContent}`)
          }
        }
      }
    })
    .map(fn => fn())

  return Promise.all(channelDeletes)
}

module.exports = {cleanup}
