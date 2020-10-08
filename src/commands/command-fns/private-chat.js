const Discord = require('discord.js')
const {
  privateChannelPrefix,
  listify,
  sendBotMessageReply,
  getCategory,
  getMember,
} = require('../utils')

async function privateChat(message) {
  const mentionedMembers = Array.from(message.mentions.members.values()).filter(
    user => user.user.id !== message.member.id,
  )
  const mentionedMembersNicknames = Array.from(
    message.mentions.members.values(),
  ).map(user => user.displayName)
  mentionedMembers.push(message.author)
  mentionedMembersNicknames.push(
    getMember(message.guild, message.author.id).displayName,
  )
  if (mentionedMembers.length < 2) {
    return message.channel.send(`You should mention at least one other member.`)
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

  const categoryPrivateChat = getCategory(message.guild, {name: 'private chat'})

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
Hello ${listify(mentionedMembers, {stringify: member => member})} 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
    `.trim(),
  )
  await message.channel.send(
    `I've created ${channel} for you folks to talk privately. Cheers!`,
  )
}
privateChat.description =
  'Create a private channel with who you want. This channel is temporary.'
privateChat.help = message =>
  sendBotMessageReply(
    message,
    `
Use this command to create a private chat with members of the server 🤫. 
The chat will be deleted after 1 hour 👻 or if there is at least 10 minutes of inactivity 🚶‍♂️.

Example of usage: \`?private-chat @User1 @User2\`

This will create a private chat room for you and User1 and User2.
    `.trim(),
  )

module.exports = privateChat
