const {
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getWelcomeChannels,
  getMemberIdFromChannel,
  getSend,
} = require('./utils')
const {deleteWelcomeChannel} = require('./delete-welcome-channel')
const {handleNewMessage} = require('./handle-new-message')

async function cleanup(guild) {
  const welcomeChannels = getWelcomeChannels(guild)
  // the more channels we have running, the shorter the waiting time should be
  // because we can only have 50 channels in the welcome category
  // and two of those are already spoken for...
  const minMinutes = 3
  const maxMinutes = 6
  const maxChannelsAlteration =
    (welcomeChannels.size / 48) * (maxMinutes - minMinutes)
  const maxWaitingTime = 1000 * 60 * maxMinutes - maxChannelsAlteration

  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted and you'll be removed from the server after a while. Don't worry though, you can always try again later when you have time to finish: https://kcd.im/discord`
  const spamWarningMessageContent = `you're sending a lot of messages, this channel will get deleted automatically if you send too many.`
  // prime the cache
  await guild.members.fetch()

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

      const memberId = getMemberIdFromChannel(channel)
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
      if (channel.messages.cache.size > tooManyMessages * 0.5) {
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
        if (timeSinceLastMessage > 2 * 1000) {
          // if it's been a while and we haven't handled the last message
          // then let's handle it now.
          await handleNewMessage(lastMessage)
        }
      } else {
        // we haven't heard from them in a while...
        const timeSinceLastMessage = new Date() - lastMessage.createdAt
        const hasBeenWarned = lastMessage.content.includes(
          timeoutWarningMessageContent,
        )
        const confirmed = !isMemberUnconfirmed(member)
        if (
          timeSinceLastMessage > maxWaitingTime &&
          ((!confirmed && hasBeenWarned) || confirmed)
        ) {
          return deleteWelcomeChannel(channel, 'Onboarding timed out')
        } else if (
          timeSinceLastMessage > maxWaitingTime * 0.7 &&
          !hasBeenWarned &&
          !confirmed
        ) {
          return send(`Hi ${member.user}, ${timeoutWarningMessageContent}`)
        } else if (timeSinceLastMessage > maxWaitingTime * 10) {
          // somehow this channel has stuck around for a long time
          // not sure how this should be possible, but we should delete it
          return deleteWelcomeChannel(channel, 'Onboarding timed out')
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
