import type * as TDiscord from 'discord.js'
import Discord, {MessageMentions} from 'discord.js'
import {
  privateChannelPrefix,
  listify,
  sendBotMessageReply,
  getCategoryChannel,
  getCommandArgs,
  timeToMs,
  getRole,
  botLog,
} from '../utils'
import {
  defaultLifeTimeMinute,
  warningStepMinute,
  maxInactiveTimeMinute,
  eolReason,
} from '../../private-chat'

async function createChat(message: TDiscord.Message) {
  const {member, guild} = message

  if (!guild || !member || !message.mentions.members) return

  const everyoneRole = getRole(guild, '@everyone')
  const categoryPrivateChat = getCategoryChannel(guild, 'private chat')
  if (!categoryPrivateChat || !everyoneRole) return

  const mentionedMembers = Array.from(message.mentions.members.values()).filter(
    user => user.user.id !== member.id,
  )
  const mentionedMembersNicknames = Array.from(
    message.mentions.members.values(),
  ).map(user => user.displayName)
  mentionedMembers.push(member)
  mentionedMembersNicknames.push(member.displayName)
  if (mentionedMembers.length < 2) {
    return message.channel.send(`You should mention at least one other member.`)
  }

  const allPermissions = Object.keys(Discord.Permissions.FLAGS) as Array<
    keyof typeof Discord.Permissions.FLAGS
  >
  const membersPermissions = mentionedMembers.map(mentionedMember => {
    return {
      type: 'member',
      id: mentionedMember.id,
      allow: [
        'ADD_REACTIONS',
        'VIEW_CHANNEL',
        'SEND_MESSAGES',
        'SEND_TTS_MESSAGES',
        'READ_MESSAGE_HISTORY',
        'CHANGE_NICKNAME',
      ],
    } as const
  })

  let channelSuffix
  if (mentionedMembersNicknames.length === 2) {
    channelSuffix = mentionedMembersNicknames.join('-')
  } else {
    channelSuffix = `${mentionedMembersNicknames
      .slice(0, 2)
      .join('-')}-and-others`
  }

  const allActivePrivateChannels = guild.channels.cache.filter(
    channel =>
      channel.type === 'text' &&
      channel.parentID === categoryPrivateChat.id &&
      channel.name.includes('-private-') &&
      !channel.deleted,
  )

  const existingChat = allActivePrivateChannels.find(channel => {
    const chatMembers = channel.members
      .filter(channelMember => !channelMember.user.bot)
      .map(({id}) => id)

    return (
      chatMembers.length === mentionedMembers.length &&
      mentionedMembers.every(mem => chatMembers.includes(mem.id))
    )
  })

  if (existingChat) {
    return message.channel.send(
      `There is already a chat for the same members ${existingChat}`,
    )
  }

  const expirationDate = new Date(
    Date.now() + timeToMs.minutes(defaultLifeTimeMinute),
  )

  const channel = await guild.channels.create(
    `${privateChannelPrefix}${channelSuffix}`,
    {
      topic: `Private chat for ${listify(
        mentionedMembersNicknames,
      )} self-destruct at ${expirationDate.toUTCString()}`,
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

  botLog(
    guild,
    () =>
      `Private chat created by ${member} for ${listify(
        mentionedMembersNicknames,
      )}: ${channel}`,
  )

  return Promise.all([
    channel.send(
      `
Hello ${listify(mentionedMembers)} 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
    `.trim(),
    ),
    message.channel.send(
      `I've created ${channel} for you folks to talk privately. Cheers!`,
    ),
  ])
}

async function extendTime(message: TDiscord.Message, extendedTime: string) {
  const parsedTime = parseInt(extendedTime, 10)
  if (parsedTime > 0) {
    const privateChannel = message.channel as TDiscord.TextChannel
    const topicRegex = /self-destruct at (?<utcDate>.*)$/i
    const match = (privateChannel.topic ?? '').match(topicRegex)
    let currentExpirationDate = new Date(
      privateChannel.createdAt.getTime() +
        timeToMs.minutes(defaultLifeTimeMinute),
    )
    if (match) {
      const specifiedDate = new Date(match.groups?.utcDate ?? 'invalid')
      if (!Number.isNaN(specifiedDate.getTime())) {
        currentExpirationDate = specifiedDate
      }
    }

    const newExpirationDate = new Date(
      currentExpirationDate.getTime() + timeToMs.minutes(parsedTime),
    )

    const membersNicknames = privateChannel.members.map(
      guildMember => guildMember.displayName,
    )

    await privateChannel.setTopic(
      `Private chat for ${listify(
        membersNicknames,
      )} self-destruct at ${newExpirationDate.toUTCString()}`,
    )
    const channelCreateDate = privateChannel.createdAt
    const timeSinceChannelCreation = Date.now() - channelCreateDate.getTime()
    const newLifetime =
      newExpirationDate.getTime() - channelCreateDate.getTime()

    if (
      timeSinceChannelCreation <
      timeToMs.minutes(newLifetime) - timeToMs.minutes(warningStepMinute)
    ) {
      const allMessages = Array.from(
        (await message.channel.messages.fetch()).values(),
      )
      const botMessages = allMessages.filter(
        channelMessage => channelMessage.author.bot,
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

async function privateChat(message: TDiscord.Message) {
  const channel = message.channel as TDiscord.TextChannel
  const guild = message.guild
  if (!guild) return
  const categoryPrivateChat = getCategoryChannel(guild, 'private chat')
  if (!categoryPrivateChat) return

  const args = getCommandArgs(message.content).trim()
  const privateChatArg = args
    .replace(MessageMentions.USERS_PATTERN, '')
    .trim()
    .toLowerCase()

  const [subcommand, ...rest] = privateChatArg.split(' ')

  if (subcommand) {
    if (channel.parent?.id !== categoryPrivateChat.id) {
      return channel.send(
        `The command ${subcommand} can be used only in private chat`,
      )
    }
    switch (subcommand) {
      case 'extend': {
        return extendTime(message, rest[0] ?? '')
      }
      default: {
        return channel.send(
          'The command is not available. use `?private-chat help` to know more about the available commands',
        )
      }
    }
  } else {
    return createChat(message)
  }
}

privateChat.description =
  'Create a private channel with who you want. This channel is temporary.'
privateChat.help = (message: TDiscord.Message) =>
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

export {privateChat}
