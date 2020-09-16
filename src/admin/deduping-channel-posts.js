const {
  commandPrefix,
  isWelcomeChannel,
  getChannel,
  getMember,
  getMessageLink,
} = require('./utils')

const sixHours = 1000 * 60 * 60 * 6

async function dedupeMessages(message) {
  if (message.author.id === message.client.user.id) return // ignore the bot
  if (isWelcomeChannel(message.channel)) return // ignore onboarding channels
  if (message.content.startsWith(commandPrefix)) return // ignore commands
  if (message.content.length < 50) return // ignore short messages

  const {guild} = message
  const member = getMember(guild, message.author.id)

  const channels = message.guild.channels.cache.filter(
    ch => !isWelcomeChannel(ch) && ch.type === 'text',
  )

  function msgFilter(msg) {
    return (
      msg.id !== message.id && // not the EXACT same message
      msg.author.id !== msg.client.user.id && // not from the bot
      msg.author.id === message.author.id && // from the same user
      !msg.content.startsWith(commandPrefix) && // not a command
      new Date() - msg.createdAt < sixHours && // within the last six hours
      msg.content.length > 50 && // longer than 50 characters
      msg.content.toLowerCase() === message.content.toLowerCase() // same content
    )
  }

  let duplicateMessage
  for (const channel of Array.from(channels.values())) {
    duplicateMessage = Array.from(channel.messages.cache.values()).find(
      msgFilter,
    )
    if (duplicateMessage) break
  }

  if (duplicateMessage) {
    await message.delete({reason: `Duplicate message: ${duplicateMessage.id}`})
    const botsChannel = getChannel(message.guild, {name: 'talk-to-bots'})
    const duplicateMessageLink = getMessageLink(duplicateMessage)
    botsChannel.send(
      `
Hi ${member.user}, I deleted a message you just posted because it's a duplicate of this one: <${duplicateMessageLink}>. Please give it time for users to respond to your first post.

If you think your message is better suited in another channel please delete the first one then repost. Thank you.
      `.trim(),
    )
  }
}

module.exports = {dedupeMessages}
