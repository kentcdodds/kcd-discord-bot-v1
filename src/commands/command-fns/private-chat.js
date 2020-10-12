const Discord = require('discord.js')
const {MessageMentions} = require('discord.js')
const {
  privateChannelPrefix,
  listify,
  sendBotMessageReply,
  getCategory,
  getMember,
  getCommandArgs,
  timeToMs,
} = require('../utils')
const {
  defaultLifeTimeMinute,
  warningStepMinute,
  maxInactiveTimeMinute,
  eolReason,
} = require('../../private-chat')

async function createChat(message) {
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
      topic: `self-destruct in ${defaultLifeTimeMinute} minutes`,
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
  return Promise.all([
    channel.send(
      `
Hello ${listify(mentionedMembers, {stringify: member => member})} 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
    `.trim(),
    ),
    message.channel.send(
      `I've created ${channel} for you folks to talk privately. Cheers!`,
    ),
  ])
}

async function extendTime(message, extendedTime) {
  const parsedTime = parseInt(extendedTime, 10)
  if (parsedTime > 0) {
    const privateChannel = message.channel
    const match = privateChannel.topic.match(
      /self-destruct in (?<time>\d+) minutes/i,
    )
    let currentTime = defaultLifeTimeMinute
    if (match) currentTime = parseInt(match.groups.time, 10)

    const newLifetime = currentTime + parsedTime
    await privateChannel.setTopic(
      `self-destruct in ${newLifetime} minutes`,
      'extend lifetime',
    )
    const channelCreateDate = privateChannel.createdAt
    const timeSinceChannelCreation = Date.now() - channelCreateDate

    if (
      timeSinceChannelCreation <
      timeToMs.minutes(newLifetime) - timeToMs.minutes(warningStepMinute)
    ) {
      const allMessages = Array.from(
        (await message.channel.messages.fetch()).values(),
      )
      const botMessages = allMessages.filter(
        channelMessage => channelMessage.author?.bot,
      )

      const eolWarningMessage = botMessages.find(
        botMessage =>
          botMessage.content.includes(`${warningStepMinute} minutes`) &&
          botMessage.content.includes(eolReason),
      )
      if (eolWarningMessage) {
        await eolWarningMessage.delete({reason: 'extend lifetime'})
      }
    }
    return message.channel.send(
      `The lifetime of the channel has been extended of ${parsedTime} minutes more ⏱`,
    )
  }

  return message.channel.send(
    'You have to pass an extended time in minutes. Example: `?private-chat extend 10`',
  )
}

function privateChat(message) {
  const privateChatSubcommand = {extend: extendTime}
  const args = getCommandArgs(message.content).trim()
  const privateChatArg = args
    .replace(MessageMentions.USERS_PATTERN, '')
    .trim()
    .toLowerCase()
  const [command, ...rest] = privateChatArg.split(' ')
  if (command) {
    if (command in privateChatSubcommand) {
      const categoryPrivateChat = getCategory(message.guild, {
        name: 'private chat',
      })
      if (message.channel.parent?.id === categoryPrivateChat.id) {
        return privateChatSubcommand[command](message, ...rest)
      } else {
        return message.channel.send(
          `The command ${command} can be used only in private chat`,
        )
      }
    } else {
      return message.channel.send(
        'The command is not available. use `?private-chat help` to know more about the available commands',
      )
    }
  } else {
    return createChat(message)
  }
}

privateChat.description =
  'Create a private channel with who you want. This channel is temporary.'
privateChat.help = message =>
  sendBotMessageReply(
    message,
    `
Use this command to create a private chat with members of the server 🤫. 
The chat will be deleted after ${defaultLifeTimeMinute} minutes 👻 or if there is at least ${maxInactiveTimeMinute} minutes of inactivity 🚶‍♂️.
The following commands are available:
1. \`?private-chat @User1 @User2\`. This will create a private chat room for you and User1 and User2.
2. \`?private-chat extend 10\`. This will extend the lifetime of the chat of 10 minutes. The command is available only in private chat.
    `.trim(),
  )

module.exports = privateChat
