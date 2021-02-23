import type * as TDiscord from 'discord.js'
import * as Discord from 'discord.js'
import {
  getChannel,
  getTextChannel,
  meetupChannelPrefix,
  listify,
  typedBoolean,
} from '../utils'

function getScheduledMeetupsChannel(guild: TDiscord.Guild | null) {
  return getTextChannel(guild, 'upcoming-meetups')
}

function getFollowMeChannel(guild: TDiscord.Guild | null) {
  return getTextChannel(guild, 'follow-me')
}

const isVoiceChannel = (ch: TDiscord.Channel): ch is TDiscord.VoiceChannel =>
  ch.type === 'voice'

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
  host: TDiscord.GuildMember
  meetupDetails: string
  createVoiceChannel: boolean
  notificationUsers: Array<TDiscord.GuildMember>
}

async function startMeetup({
  host,
  meetupDetails,
  createVoiceChannel,
  notificationUsers = [],
}: StartMeetupOptions) {
  const subject = getMeetupSubject(meetupDetails) ?? 'Unknown'
  if (subject === 'Unknown') {
    console.error(`Could not get a subject from ${meetupDetails}`)
  }
  if (createVoiceChannel) {
    const meetupCategory = getChannel(host.guild, {
      name: 'meetups',
      type: 'category',
    })

    await host.guild.channels.create(
      `${meetupChannelPrefix}${host.nickname} "${subject}"`.slice(0, 100),
      {
        type: 'voice',
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
  const meetupNotifications = getChannel(host.guild, {
    name: 'meetup-notifications',
  })
  if (!meetupNotifications) return

  const testing = meetupDetails.includes('TESTING')
  const followers = await getFollowers(host)
  const usersToNotify = Array.from(
    new Set([...followers, ...notificationUsers]),
  ).map(notifee => (testing ? notifee.displayName : notifee.toString()))

  const cc = usersToNotify.length ? `CC: ${listify(usersToNotify)}` : ''

  await meetupNotifications.send(
    `
🏁 ${host} has started the meetup:

${meetupDetails}

${cc}
    `.trim(),
  )
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
