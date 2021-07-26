import type * as TDiscord from 'discord.js'
import {
  cleanupGuildOnInterval,
  getMentionedUser,
  getTextChannel,
} from '../utils'

async function removeNonMentionedUsersReactions(guild: TDiscord.Guild) {
  const botId = guild.client.user?.id
  const botMessagesChannel = getTextChannel(guild, 'bot-messages')
  if (!botMessagesChannel || !botId) return
  const allMessages = Array.from(botMessagesChannel.messages.cache.values())
  const cleanupReactionsPromises = allMessages.map(async message => {
    const mentionedUser = await getMentionedUser(message)
    if (!mentionedUser) {
      console.warn(`There's a bot message with no mentioned user.`)
      return
    }
    await Promise.all(
      message.reactions.cache.mapValues(async reaction => {
        const users = await reaction.users.fetch()
        const removes = users.filter(
          user => user.id !== mentionedUser.id && user.id !== botId,
        )
        await Promise.all(
          removes.map(r => {
            return reaction.users.remove(r)
          }),
        )
      }),
    )
  })
  await Promise.all(cleanupReactionsPromises)
}

async function cleanup(guild: TDiscord.Guild) {
  await removeNonMentionedUsersReactions(guild)
}

async function setup(client: TDiscord.Client) {
  cleanupGuildOnInterval(client, guild => cleanup(guild), 5000)
}

export {setup}
