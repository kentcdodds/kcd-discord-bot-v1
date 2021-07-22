import type * as TDiscord from 'discord.js'
import * as Sentry from '@sentry/node'
import {
  botLog,
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
  getFollowMeMessages,
  getMentionedUser,
  getMeetupSubject,
  getFollowers,
  listify,
  typedBoolean,
  getTextChannel,
  getMessageLink,
} from './utils'

async function maybeDeleteMessage(
  message: TDiscord.Message,
  member: TDiscord.GuildMember | null,
) {
  if (!member) {
    Sentry.captureMessage(
      `We want to delete a message that has no member who can delete it: ${getMessageLink(
        message,
      )}`,
    )
    return
  }
  const deleteMessageReaction = message.reactions.cache.get('❌')
  if (!deleteMessageReaction) return
  const deleteReactions = await deleteMessageReaction.users.fetch()
  if (deleteReactions.some(user => user.id === member.id)) {
    await message.delete()
  }
}

async function hasHostReaction(
  message: TDiscord.Message,
  host: TDiscord.GuildMember,
  emoji: string,
) {
  const reaction = message.reactions.cache.get(emoji)
  if (!reaction) return false
  const usersWhoReacted = await reaction.users.fetch()
  return usersWhoReacted.some(user => user.id === host.id)
}

async function getNotificationUsers(message: TDiscord.Message) {
  const notificationMessageReaction = message.reactions.cache.get('✋')
  const guild = message.guild
  if (!notificationMessageReaction || !guild) return []
  return Array.from((await notificationMessageReaction.users.fetch()).values())
    .filter(user => !user.bot)
    .map(user => guild.members.cache.get(user.id))
    .filter(typedBoolean)
}

function getMeetupDetailsFromScheduledMessage(content: string): string {
  const match = content.match(
    /is hosting a (recurring )?meetup:(?<meetupDetails>(.|\n)+)React with ✋ to be notified/,
  )
  // match.groups is incorrectly typed 😱
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return match?.groups?.meetupDetails?.trim() ?? ''
}

async function handleHostReactions(message: TDiscord.Message) {
  const host = await getMentionedUser(message)
  if (!host) return
  const hasReaction = hasHostReaction.bind(null, message, host)
  if (await hasReaction('🏁')) {
    await startMeetup({
      host,
      meetupDetails: getMeetupDetailsFromScheduledMessage(message.content),
      notificationUsers: await getNotificationUsers(message),
    })

    if (message.content.includes('recurring')) {
      await message.reactions.cache.get('🏁')?.remove()
    } else {
      await message.delete()
    }
  } else if (await hasReaction('❌')) {
    await message.delete()
    const meetupNotifications = getTextChannel(
      message.guild,
      'meetup-notifications',
    )

    if (!meetupNotifications) return

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

async function cleanup(guild: TDiscord.Guild) {
  const meetupChannels = getMeetupChannels(guild)

  const now = Date.now()

  const deletingMeetups: Array<Promise<unknown>> = []
  const cutoffAge = now - 1000 * 60 * 15
  for (const meetupChannel of meetupChannels.values()) {
    const createdAt = meetupChannel.createdAt.getTime()
    const memberCount = meetupChannel.members.size
    if (createdAt < cutoffAge && memberCount === 0) {
      void botLog(
        guild,
        () =>
          `Cleaning up channel ${meetupChannel.name} created at: ${createdAt}, now: ${now}`,
      )
      deletingMeetups.push(meetupChannel.delete())
    }
  }

  const deletingFollowMeMessages = Array.from(
    (await getFollowMeMessages(guild)).values(),
  ).map(async msg => maybeDeleteMessage(msg, await getMentionedUser(msg)))

  const scheduledMeetupsChannel = getScheduledMeetupsChannel(guild)
  let deletingScheduledMeetupMessages: Array<Promise<unknown>> = []
  let handleReactions: Array<Promise<unknown>> = []

  if (scheduledMeetupsChannel) {
    deletingScheduledMeetupMessages = Array.from(
      (await scheduledMeetupsChannel.messages.fetch()).values(),
    ).map(async msg => maybeDeleteMessage(msg, await getMentionedUser(msg)))

    handleReactions = scheduledMeetupsChannel.messages.cache.map(
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
  }

  await Promise.all([
    ...handleReactions,
    ...deletingMeetups,
    ...deletingFollowMeMessages,
    ...deletingScheduledMeetupMessages,
  ])
}

export {cleanup}
