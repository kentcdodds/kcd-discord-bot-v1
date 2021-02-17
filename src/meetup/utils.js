const {getChannel, meetupChannelPrefix} = require('../utils')

function getScheduledMeetupsChannel(guild) {
  return getChannel(guild, {name: 'upcoming-meetups'})
}

const isMeetupChannel = ch =>
  ch.name?.startsWith(meetupChannelPrefix) && ch.type === 'voice'

async function startMeetup({guild, host, subject}) {
  const meetupCategory = getChannel(guild, {name: 'meetups', type: 'category'})

  const channel = await guild.channels.create(
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
  const botsChannel = getChannel(guild, {name: 'talk-to-bots'})
  await botsChannel.send(
    `Hey ${host.user}, your "${channel.name}" meetup channel is ready!`,
  )
}

const getMeetupChannels = guild => guild.channels.cache.filter(isMeetupChannel)

module.exports = {
  ...require('../utils'),
  getScheduledMeetupsChannel,
  startMeetup,
  getMeetupChannels,
}
