// Command purpose:
// to automate management of learning clubs https://kcd.im/clubs
const Discord = require('discord.js')
const {getSend, newClubChannelPrefix} = require('./utils')

async function createClub(message) {
  const {guild} = message
  const member = guild.members.cache.find(
    ({user}) => user.id === message.author.id,
  )
  const {
    user,
    user: {username, discriminator},
  } = member

  const clubCategory = guild.channels.cache.find(
    ({type, name}) =>
      type === 'category' && name.toLowerCase().includes('clubs'),
  )

  const everyoneRole = member.guild.roles.cache.find(
    ({name}) => name === '@everyone',
  )
  const allPermissions = Object.keys(Discord.Permissions.FLAGS)

  const channel = await guild.channels.create(
    `${newClubChannelPrefix}${username}_${discriminator}`,
    {
      topic: `
New KCD Learning Club application for ${username}#${discriminator}

Club Captain: ${username}_${discriminator} (Member ID: "${member.id}")
      `.trim(),
      reason: `To create a new learning club`,
      parent: clubCategory,
      permissionOverwrites: [
        {
          type: 'role',
          id: everyoneRole.id,
          deny: allPermissions,
        },
        {
          type: 'member',
          id: member.id,
          allow: [
            'ADD_REACTIONS',
            'VIEW_CHANNEL',
            'MENTION_EVERYONE',
            'SEND_MESSAGES',
            'SEND_TTS_MESSAGES',
            'READ_MESSAGE_HISTORY',
            'CHANGE_NICKNAME',
          ],
        },
        {
          type: 'member',
          id: member.client.user.id,
          allow: allPermissions,
        },
      ],
    },
  )
  const send = getSend(channel)

  await send(
    `
Hello ${user} 👋

Let's get this learning club going! I need to ask you a few questions before we can get rolling.

(If you created this by mistake, type "delete" at any time to remove this channel)
    `.trim(),
  )

  await message.channel.send(
    `Hi ${user}! I created ${channel} for us to get this club going! Join me there please.`,
  )
}

module.exports = {createClub}
