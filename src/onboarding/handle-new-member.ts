import type * as TDiscord from 'discord.js'
import Discord from 'discord.js'
import {firstStep} from './steps'
import {
  botLog,
  getBotLogEmbed,
  getMessageContents,
  getSend,
  isCategoryChannel,
  updateOnboardingBotLog,
  welcomeChannelPrefix,
} from './utils'

async function handleNewMember(member: TDiscord.GuildMember) {
  const {
    guild,
    user,
    user: {username, discriminator},
  } = member

  void botLog(guild, () => {
    return getBotLogEmbed(member, {
      fields: [{name: 'Status', value: 'Creating welcome channel.'}],
    })
  })

  const everyoneRole = member.guild.roles.cache.find(
    ({name}) => name === '@everyone',
  )
  const unconfirmedMemberRole = member.guild.roles.cache.find(
    ({name}) => name === 'Unconfirmed Member',
  )

  const clientUser = member.client.user

  if (!unconfirmedMemberRole || !everyoneRole || !clientUser) return

  await member.roles.add(unconfirmedMemberRole, 'New member')

  const allPermissions = Object.keys(Discord.Permissions.FLAGS) as Array<
    keyof typeof Discord.Permissions.FLAGS
  >

  const onboardingCategories = Array.from(member.guild.channels.cache.values())
    .filter(isCategoryChannel)
    .filter(ch => ch.name.toLowerCase().includes('onboarding'))
  const [categoryWithFewest] = onboardingCategories.sort((cat1, cat2) =>
    cat1.children.size > cat2.children.size ? 1 : -1,
  )

  const newChannelName = `${welcomeChannelPrefix}${username}_${discriminator}`

  const channel = await member.guild.channels.create(newChannelName, {
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
        id: clientUser.id,
        allow: allPermissions,
      },
    ],
  })
  const send = getSend(channel)

  await send(
    `
Hello ${user} 👋

I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`${username}#${discriminator}\`), an explanation of the trouble, and a screenshot of the conversation. And we'll get things fixed up for you.

(Note, if you make a mistake, you can edit your responses).

In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    `.trim(),
  )

  const answers = {}
  await send(await getMessageContents(firstStep.question, answers, member))

  void updateOnboardingBotLog(member, () =>
    getBotLogEmbed(member, {
      fields: [{name: 'Status', value: `Onboarding in: ${newChannelName}`}],
    }),
  )
}

export {handleNewMember}
