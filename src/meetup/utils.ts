import type * as TDiscord from 'discord.js'
import * as Discord from 'discord.js'
import * as Sentry from '@sentry/node'
import {
  getTextChannel,
  meetupChannelPrefix,
  listify,
  typedBoolean,
  getCategoryChannel,
  isVoiceChannel,
} from '../utils'

function getScheduledMeetupsChannel(guild: TDiscord.Guild | null) {
  return getTextChannel(guild, 'upcoming-meetups')
}

function getFollowMeChannel(guild: TDiscord.Guild | null) {
  return getTextChannel(guild, 'follow-me')
}

const isMeetupChannel = (ch: TDiscord.Channel) =>
  isVoiceChannel(ch) && ch.name.startsWith(meetupChannelPrefix)

async function getFollowMeMessages(guild: TDiscord.Guild) {
  const followMeChannel = getFollowMeChannel(guild)
  if (!followMeChannel) {
    return new Discord.Collection<string, TDiscord.Message>()
  }
  return followMeChannel.messages.fetch()
}

const getMeetupSubject = (content: string) =>
  content.match(/"(?<subject>.+)"/i)?.groups?.subject ?? null

async function getFollowers(
  member: TDiscord.GuildMember,
): Promise<Array<TDiscord.GuildMember>> {
  const followMeMessage = (await getFollowMeMessages(member.guild)).find(msg =>
    msg.content.includes(member.id),
  )
  if (!followMeMessage) {
    return []
  }
  const followMeMessageReactions = followMeMessage.reactions.cache.get('✋')
  if (!followMeMessageReactions) return []
  return Array.from((await followMeMessageReactions.users.fetch()).values())
    .filter(user => !user.bot)
    .map(user => member.guild.members.cache.get(user.id))
    .filter(typedBoolean)
}

type StartMeetupOptions = {
  host: TDiscord.GuildMember | null
  meetupDetails: string
  notificationUsers?: Array<TDiscord.GuildMember>
}

const noVoiceChannelRegex = /(zoom\.us|twitch\.tv)/i

async function startMeetup({
  host,
  meetupDetails,
  notificationUsers = [],
}: StartMeetupOptions) {
  if (!host) {
    Sentry.captureMessage('Trying to start a meetup without a host')
    return
  }
  const subject = getMeetupSubject(meetupDetails) ?? 'Unknown'
  if (subject === 'Unknown') {
    console.error(`Could not get a subject from ${meetupDetails}`)
  }
  const forceVoiceChannel = meetupDetails.includes('voice channel')
  if (forceVoiceChannel || !noVoiceChannelRegex.test(meetupDetails)) {
    const meetupCategory = getCategoryChannel(host.guild, 'meetups')

    await host.guild.channels.create(
      `${meetupChannelPrefix}${host.nickname} "${subject}"`.slice(0, 100),
      {
        type: 'GUILD_VOICE',
        topic: `A meetup hosted by ${host.nickname} about "${subject}"`,
        reason: `Meetup started`,
        parent: meetupCategory ?? undefined,
        permissionOverwrites: [
          {
            type: 'member',
            id: host.id,
            allow: ['MANAGE_CHANNELS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS'],
          },
        ],
      },
    )
  }
  const meetupNotifications = getTextChannel(host.guild, 'meetup-notifications')
  if (!meetupNotifications) return

  const testing = meetupDetails.includes('TESTING')
  const followers = await getFollowers(host)
  const usersToNotify = Array.from(
    new Set([...followers, ...notificationUsers]),
  ).map(notifee => (testing ? notifee.displayName : notifee.toString()))

  const notifyList = listify(usersToNotify)
  const cc = usersToNotify.length ? `CC: ` : ''

  const mainMessage = `
🏁 ${host} has started the meetup:

${meetupDetails}

${cc}
      `.trim()
  await meetupNotifications.send(`${mainMessage} ${notifyList}`, {
    split: {
      prepend: `${mainMessage} `,
      char: ', ',
    },
  })
}

const getMeetupChannels = (guild: TDiscord.Guild | null) =>
  guild?.channels.cache.filter(isMeetupChannel) ??
  new Discord.Collection<string, TDiscord.GuildChannel>()

export * from '../utils'
export {
  getScheduledMeetupsChannel,
  getFollowMeChannel,
  getFollowMeMessages,
  getFollowers,
  startMeetup,
  getMeetupChannels,
  getMeetupSubject,
}
