const {
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
  getFollowMeMessages,
  getMentionedUser,
  getChannel,
  getMeetupSubject,
  getFollowers,
  listify,
} = require('./utils')

async function maybeDeleteMessage(message, member) {
  const deleteMessageReaction = message.reactions.cache.get('❌')
  if (!deleteMessageReaction) return
  const deleteReactions = await deleteMessageReaction.users.fetch()
  if (deleteReactions.some(user => user.id === member.id)) {
    await message.delete()
  }
}

async function hasHostReaction(message, host, emoji) {
  const reaction = message.reactions.cache.get(emoji)
  if (!reaction) return false
  const usersWhoReacted = await reaction.users.fetch()
  return usersWhoReacted.some(user => user.id === host.id)
}

async function getNotificationUsers(message) {
  const notificationReactionMessage = message.reactions.cache.get('✋')
  return Array.from((await notificationReactionMessage.users.fetch()).values())
    .filter(user => !user.bot)
    .map(user => message.guild.members.cache.get(user.id))
}

function getMeetupDetailsFromScheduledMessage(content) {
  const match = content.match(
    /is hosting a (recurring )?meetup:(?<meetupDetails>(.|\n)+)React with ✋ to be notified/,
  )
  return match?.groups?.meetupDetails?.trim()
}

async function handleHostReactions(message) {
  const host = getMentionedUser(message)
  if (!host) return
  const hasReaction = hasHostReaction.bind(null, message, host)
  if (await hasReaction('🏁')) {
    await startMeetup({
      host,
      meetupDetails: getMeetupDetailsFromScheduledMessage(message.content),
      createVoiceChannel: !message.content.toLowerCase().includes('zoom.us'),
      notificationUsers: await getNotificationUsers(message),
    })

    if (message.content.includes('recurring')) {
      await message.reactions.cache.get('🏁').remove()
    } else {
      await message.delete()
    }
  } else if (await hasReaction('❌')) {
    await message.delete()
    const meetupNotifications = getChannel(message.guild, {
      name: 'meetup-notifications',
    })

    const testing = message.content.includes('TESTING')
    const followers = await getFollowers(host)
    const usersToNotify = Array.from(
      new Set([...followers, ...(await getNotificationUsers(message))]),
    ).map(notifee => (testing ? notifee.displayName : notifee.toString()))
    const cc = usersToNotify.length ? `CC: ${listify(usersToNotify)}` : ''
    await meetupNotifications.send(
      `${host} has canceled the meetup: ${getMeetupSubject(
        message.content,
      )}. ${cc}`.trim(),
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
      const subject = getMeetupDetailsFromScheduledMessage(message.content)

      if (!subject) {
        console.error(
          `Cannot find meetup details from ${message.content}. This should never happen... Deleting message so it never happens again.`,
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
