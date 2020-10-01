const Discord = require('discord.js')
const {privateChannelPrefix} = require('../utils')

async function privateChat(message) {
  const mentionedMembers = Array.from(message.mentions.members.values())
  const mentionedMembersNicknames = Array.from(
    message.mentions.members.values(),
  ).map(m => m.nickname ?? m.user.username)
  if (mentionedMembers.length < 2) {
    return message.channel.send(`You should mention at least two members.`)
  }

  const allPermissions = Object.keys(Discord.Permissions.FLAGS)
  const membersPermissions = mentionedMembers.map(member => {
    return {
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
    }
  })

  let channelSuffix
  if (mentionedMembersNicknames.length === 2) {
    channelSuffix = mentionedMembersNicknames.join('-')
  } else {
    channelSuffix = `${mentionedMembersNicknames
      .slice(0, 2)
      .join('-')}-and-others`
  }

  const everyoneRole = message.guild.roles.cache.find(
    ({name}) => name === '@everyone',
  )

  const categoryPrivateChat = message.guild.channels.cache.find(
    ({name, type}) =>
      type === 'category' && name.toLowerCase().includes('private chat'),
  )

  const allActivePrivateChannels = message.guild.channels.cache.filter(
    channel =>
      channel.type === 'text' &&
      channel.parentID === categoryPrivateChat.id &&
      channel.name.includes('-private-') &&
      !channel.deleted,
  )

  const existingChat = allActivePrivateChannels.find(channel => {
    const chatMembers = channel.members
      .filter(member => !member.user.bot)
      .map(member => member.id)

    return (
      chatMembers.length === mentionedMembers.length &&
      mentionedMembers.every(member => chatMembers.indexOf(member.id) !== -1)
    )
  })

  if (existingChat) {
    return message.channel.send(
      `There is already a chat for the same members ${existingChat}`,
    )
  }

  const channel = await message.guild.channels.create(
    `${privateChannelPrefix}${channelSuffix}`,
    {
      topic: `Private Chat`,
      parent: categoryPrivateChat,
      permissionOverwrites: [
        {
          type: 'role',
          id: everyoneRole.id,
          deny: allPermissions,
        },
        ...membersPermissions,
      ],
    },
  )

  await channel.send(
    `
Hello ${mentionedMembers.map(member => member.user).join(' ')} 👋

I'm a bot I have created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣 
    `.trim(),
  )
}
privateChat.description =
  'Create a private channel with you want. This channel will be de'
privateChat.help = message =>
  message.channel.send(
    `Use this command to create a private chat with members of the server 🤫. 
The chat will be deleted after 1 hour 👻 or if there is at least 10 minutes of inactivity 🚶‍♂️.
Example of usage: ?private-chat @Exual1982 @Prours58
    `,
  )

module.exports = privateChat
