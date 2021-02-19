const {
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
  getFollowMeMessages,
  getMessageLink,
  getChannel,
  getMeetupSubject,
  getFollowers,
  listify,
} = require('./utils')

// we'd just use the message.mentions here, but sometimes the mentions aren't there for some reason 🤷‍♂️
// so we parse it out ourselves
function getMentionedUser(message) {
  const mentionId = message.content.match(/<@!?(\d+)>/)?.[1]
  if (!mentionId) {
    throw new Error(
      `This message (${getMessageLink(message)}) has no mentions: ${
        message.content
      }`,
    )
  }
  return message.guild.members.cache.get(mentionId)
}

async function maybeDeleteMessage(message, member) {
  const deleteMessageReaction = message.reactions.cache.get('❌')
  if (!deleteMessageReaction) return
  const deleteReactions = await deleteMessageReaction.users.fetch()
  if (deleteReactions.some(user => user.id === member.id)) {
    await message.delete()
  }
}

/*
  - 🏁 to start the meetup and notify everyone it's begun.
  - ❌ to cancel the meetup and notify everyone it's been canceled.
  - 🛑 to cancel the meetup and NOT notify everyone it's been canceled.
  */

async function hasHostReaction(message, host, emoji) {
  const reaction = message.reactions.cache.get(emoji)
  if (!reaction) return false
  const usersWhoReacted = await reaction.users.fetch()
  return usersWhoReacted.some(user => user.id === host.id)
}

async function getNotificationUsers(message) {
  const notificationReactionMessage = message.reactions.cache.get('✋')
  return Array.from(
    (await notificationReactionMessage.users.fetch()).values(),
  ).filter(user => !user.bot)
}

async function handleHostReactions(message) {
  const host = getMentionedUser(message)
  const hasReaction = hasHostReaction.bind(null, message, host)
  const subject = getMeetupSubject(message)
  if (await hasReaction('🏁')) {
    await startMeetup({
      host,
      subject,
      notificationUsers: await getNotificationUsers(message),
    })

    if (message.content.includes('recurring')) {
      await message.reactions.cache.get('🏁').remove()
    } else {
      await message.delete()
    }
  } else if (await hasReaction('❌')) {
    await message.delete()
    const meetupInfoChannel = getChannel(message.guild, {
      name: 'meetup-starting',
    })

    const followers = await getFollowers(host)
    const usersToNotify = Array.from(
      new Set([...followers, ...(await getNotificationUsers(message))]),
    )
    const cc = usersToNotify.length ? `CC: ${listify(usersToNotify)}` : ''
    await meetupInfoChannel.send(
      `${host} has canceled the meetup: ${subject}. ${cc}`.trim(),
    )
  } else if (await hasReaction('🛑')) {
    await message.delete()
  }
}

async function cleanup(guild) {
  const meetupChannels = getMeetupChannels(guild)

  const now = Date.now()

  const deletingMeetups = []
  const cutoffAge = now - 1000 * 60 * 15
  for (const meetupChannel of meetupChannels.values()) {
    if (
      meetupChannel.createdAt.getTime() < cutoffAge &&
      meetupChannel.members.size === 0
    ) {
      deletingMeetups.push(meetupChannel.delete())
    }
  }

  const deletingFollowMeMessages = Array.from(
    (await getFollowMeMessages(guild)).values(),
  ).map(msg => maybeDeleteMessage(msg, getMentionedUser(msg)))

  const scheduledMeetupsChannel = getScheduledMeetupsChannel(guild)
  const deletingScheduledMeetupMessages = Array.from(
    (await scheduledMeetupsChannel.messages.fetch()).values(),
  ).map(msg => maybeDeleteMessage(msg, getMentionedUser(msg)))

  const handleReactions = scheduledMeetupsChannel.messages.cache.map(
    async message => {
      const subject = getMeetupSubject(message)

      if (!subject) {
        console.error(
          `Cannot find subject from ${message.content}. This should never happen... Deleting message so it never happens again.`,
        )
        return message.delete()
      }

      return handleHostReactions(message)
    },
  )

  await Promise.all([
    ...handleReactions,
    ...deletingMeetups,
    ...deletingFollowMeMessages,
    ...deletingScheduledMeetupMessages,
  ])
}

module.exports = {
  cleanup,
}
