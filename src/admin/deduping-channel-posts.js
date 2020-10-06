const {
  commandPrefix,
  isWelcomeChannel,
  getMember,
  getMessageLink,
  sendBotMessageReply,
} = require('./utils')

const sixHours = 1000 * 60 * 60 * 6

function isLink(text) {
  try {
    // eslint-disable-next-line no-new
    new URL(text.trim())
    return true
  } catch {
    return false
  }
}

async function dedupeMessages(message) {
  if (message.author.id === message.client.user.id) return // ignore the bot
  if (isWelcomeChannel(message.channel)) return // ignore onboarding channels
  if (message.content.startsWith(commandPrefix)) return // ignore commands
  if (message.content.length < 50) return // ignore short messages
  if (isLink(message.content)) return // ignore links, gifs/blog posts/etc.

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
    const duplicateMessageLink = getMessageLink(duplicateMessage)
    sendBotMessageReply(
      message,
      `
Hi ${member.user}, I deleted a message you just posted because it's a duplicate of this one: <${duplicateMessageLink}>. Please give it time for users to respond to your first post.

If you think your message is better suited in another channel please delete the first one then repost. Thank you.
      `.trim(),
    )
  }
}

function setup(client) {
  // prime the message cache for relevant channels
  const guild = client.guilds.cache.find(({name}) => name === 'KCD')
  const channels = guild.channels.cache.filter(
    ch => !isWelcomeChannel(ch) && ch.type === 'text',
  )
  for (const channel of Array.from(channels.values())) {
    // ignore the returned promise. Fire and forget.
    channel.messages.fetch({limit: 30})
  }
}

module.exports = {handleNewMessage: dedupeMessages, setup}
