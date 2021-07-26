import type * as TDiscord from 'discord.js'
import reactions from './reactions'
import {botLog, colors, getMemberLink, getMessageLink} from './utils'

async function handleNewReaction(
  messageReaction: TDiscord.MessageReaction,
  reactingUser: TDiscord.User | TDiscord.PartialUser,
) {
  if (messageReaction.partial) {
    try {
      await messageReaction.fetch()
    } catch (error: unknown) {
      console.error(
        'Something went wrong when fetching the message reaction: ',
        error,
      )
      return
    }
  }
  if (reactingUser.partial) {
    try {
      await reactingUser.fetch()
    } catch (error: unknown) {
      console.error(
        'Something went wrong when fetching the reacting user: ',
        error,
      )
      return
    }
  }
  const guild = messageReaction.message.guild
  if (!guild) return
  // ignore reactions from the bot...
  if (reactingUser.id === guild.client.user?.id) return

  const emoji = messageReaction.emoji

  const reactionFn = reactions[emoji.name]
  if (!reactionFn) return

  await reactionFn(messageReaction)

  const {message} = messageReaction

  void botLog(guild, () => {
    const reactingMember = guild.members.cache.get(reactingUser.id)
    return {
      title: 'ℹ️ Someone added a bot reaction',
      color: colors.base0D,
      author: {
        name: reactingMember?.displayName ?? 'Unknown',
        iconURL:
          reactingMember?.user.avatarURL() ??
          reactingMember?.user.defaultAvatarURL,
        url: reactingMember
          ? getMemberLink(reactingMember)
          : 'https://example.com/unknown-reacting-member',
      },
      description: `${reactingMember ?? 'Unknown member'} added \`${
        emoji.name
      }\` to ${message.member ?? 'Unknown member'}'s message in ${
        message.channel
      }`,
      fields: [
        {name: 'Reacting Member ID', value: reactingMember?.id},
        {name: 'Message Member ID', value: message.member?.id},
        {name: 'Channel', value: message.channel},
        {name: 'Bot reaction', value: emoji.name},
        {name: 'Message link', value: getMessageLink(message)},
      ],
    }
  })

  const messageStillExists = message.channel.messages.cache.get(message.id)
  if (messageStillExists) {
    await messageReaction.remove()
  }
}

function setup(client: TDiscord.Client) {
  client.on('messageReactionAdd', (messageReaction, user) => {
    // eslint-disable-next-line no-void
    void handleNewReaction(messageReaction, user)
  })
}

export {handleNewReaction, setup}
