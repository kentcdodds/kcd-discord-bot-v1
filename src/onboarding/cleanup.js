const {
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getWelcomeChannels,
  deleteWelcomeChannel,
  getMemberId,
  getSend,
} = require('./utils')
const {handleNewMessage} = require('./handle-new-message')

async function cleanup(guild) {
  const maxWaitingTime = 1000 * 60 * 6
  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted and you'll be removed from the server after a while. Don't worry though, you can always try again later when you have time to finish: https://kcd.im/discord`
  const spamWarningMessageContent = `you're sending a lot of messages, this channel will get deleted automatically if you send too many.`
  // prime the cache
  await guild.members.fetch()

  const welcomeChannels = getWelcomeChannels(guild)
  const homelessUnconfirmedMembersKicks = guild.members.cache
    .filter(isMemberUnconfirmed)
    .filter(member => !getMemberWelcomeChannel(member))
    .mapValues(member =>
      member.kick(`Unconfirmed member with no welcome channel`),
    )
  const oldMembersKicks = guild.members.cache
    .filter(
      // no roles and joined over a minute ago
      ({roles, joinedAt}) =>
        !roles.cache.size && joinedAt < Date.now() - 1000 * 60,
    )
    .mapValues(member => member.kick(`Old member with no roles`))

  const channelDeletes = welcomeChannels.mapValues(channel => {
    const send = getSend(channel)
    return (async () => {
      // load all the messages so we can get the last message
      await Promise.all([channel.messages.fetch(), channel.fetch()])

      const {lastMessage} = channel

      const memberId = getMemberId(channel)
      const member = guild.members.cache.find(({user}) => user.id === memberId)

      // somehow the member is gone (maybe they left the server?)
      // delete the channel
      if (!member || !lastMessage) {
        await deleteWelcomeChannel(
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
        return deleteWelcomeChannel(channel, 'Too many messages')
      }

      if (lastMessage.author.id === member.id) {
        // they sent us something and we haven't responded yet
        // this happens if the bot goes down for some reason (normally when we redeploy)
        const timeSinceLastMessage = new Date() - lastMessage.createdAt
        if (timeSinceLastMessage > 6 * 1000) {
          // if it's been six seconds and we haven't handled the last message
          // then let's handle it now.
          await handleNewMessage(lastMessage)
        }
      } else {
        // we haven't heard from them in a while...
        const timeSinceLastMessage = new Date() - lastMessage.createdAt
        if (timeSinceLastMessage > maxWaitingTime) {
          return deleteWelcomeChannel(channel, 'Onboarding timed out')
        } else if (timeSinceLastMessage > maxWaitingTime * 0.7) {
          if (
            !lastMessage.content.includes(timeoutWarningMessageContent) &&
            isMemberUnconfirmed(member)
          ) {
            return send(`Hi ${member.user}, ${timeoutWarningMessageContent}`)
          }
        }
      }
    })()
  })

  await Promise.all([
    ...channelDeletes,
    ...homelessUnconfirmedMembersKicks,
    ...oldMembersKicks,
  ])
}

module.exports = {cleanup}
