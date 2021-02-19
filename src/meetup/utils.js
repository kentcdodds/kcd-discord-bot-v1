const {getChannel, meetupChannelPrefix, listify} = require('../utils')

function getScheduledMeetupsChannel(guild) {
  return getChannel(guild, {name: 'upcoming-meetups'})
}

function getFollowMeChannel(guild) {
  return getChannel(guild, {name: 'follow-me'})
}

const isMeetupChannel = ch =>
  ch.name?.startsWith(meetupChannelPrefix) && ch.type === 'voice'

async function getFollowMeMessages(guild) {
  const followMeChannel = getFollowMeChannel(guild)
  return followMeChannel.messages.fetch()
}

const getMeetupSubject = message =>
  message.content.match(/"(?<subject>.+)"/i)?.groups?.subject ?? null

async function getFollowers(member) {
  const followMeMessage = (await getFollowMeMessages(member.guild)).find(msg =>
    msg.content.includes(member.id),
  )
  if (!followMeMessage) {
    return []
  }
  const followMeMessageReactions = followMeMessage.reactions.cache.get('✋')
  return Array.from(
    (await followMeMessageReactions.users.fetch()).values(),
  ).filter(user => !user.bot)
}

async function startMeetup({host, subject, notificationUsers = []}) {
  if (!subject.includes('zoom.us')) {
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
        parent: meetupCategory,
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
  const meetupStartingChannel = getChannel(host.guild, {
    name: 'meetup-starting',
  })

  const followers = await getFollowers(host)
  const usersToNotify = Array.from(
    new Set([...followers, ...notificationUsers]),
  )

  await meetupStartingChannel.send(
    `
🏁 ${host} has started ${subject}.

${usersToNotify.length ? `CC: ${listify(usersToNotify)}` : ''}
    `.trim(),
  )
}

const getMeetupChannels = guild => guild.channels.cache.filter(isMeetupChannel)

module.exports = {
  ...require('../utils'),
  getScheduledMeetupsChannel,
  getFollowMeChannel,
  getFollowMeMessages,
  getFollowers,
  startMeetup,
  getMeetupChannels,
  getMeetupSubject,
}
