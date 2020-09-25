const Discord = require('discord.js')
const {getSend, welcomeChannelPrefix} = require('./utils')
const {getSteps} = require('./steps')

async function handleNewMember(member) {
  const {
    user,
    user: {username, discriminator},
  } = member

  const everyoneRole = member.guild.roles.cache.find(
    ({name}) => name === '@everyone',
  )
  const unconfirmedMemberRole = member.guild.roles.cache.find(
    ({name}) => name === 'Unconfirmed Member',
  )

  await member.roles.add(unconfirmedMemberRole, 'New member')

  const allPermissions = Object.keys(Discord.Permissions.FLAGS)

  const categoryWithFewest = member.guild.channels.cache
    .filter(
      ({name, type}) =>
        type === 'category' && name.toLowerCase().includes('onboarding'),
    )
    .sort((cat1, cat2) => (cat1.children?.size > cat2.children?.size ? 1 : -1))
    .first()

  const channel = await member.guild.channels.create(
    `${welcomeChannelPrefix}${username}_${discriminator}`,
    {
      topic: `Membership application for ${username}#${discriminator} (Member ID: "${member.id}")`,
      reason: `To allow ${username}#${discriminator} to apply to join the community.`,
      parent: categoryWithFewest,
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

I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`${username}#${discriminator}\`) and an explanation of the trouble and a screenshot of the conversation. And we'll get things fixed up for you.

(Note, if you make a mistake, you can edit your responses).

In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    `.trim(),
  )

  await send(getSteps(member)[0].question)
}

module.exports = {handleNewMember}
