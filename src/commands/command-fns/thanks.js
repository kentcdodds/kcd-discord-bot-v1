// Command purpose:
// this command is just to make sure the bot is running
const {MessageMentions} = require('discord.js')
const {
  getCommandArgs,
  listify,
  getMember,
  getChannel,
  getMessageLink,
} = require('../utils')

async function thanks(message) {
  const args = getCommandArgs(message.content)
  const member = getMember(message.guild, message.author.id)
  const thankedMembers = Array.from(message.mentions.members.values())
  if (!thankedMembers.length) {
    return message.channel.send(
      `You have to mention someone specific you want to thank.`,
    )
  }
  const thankedMembersListString = listify(thankedMembers, {
    stringify: m => `@${m.nickname ?? m.user.username}`,
  })
  const example = `For example: \`?thanks ${thankedMembersListString} for being so nice and answering my questions\``
  if (!args.includes(' for ')) {
    return message.channel.send(
      `You have to use the word "for" when thanking someone. ${example}`,
    )
  }
  const thanksMessage = args
    .replace(MessageMentions.USERS_PATTERN, '')
    .replace(/^.*?for/, '')
    .trim()
  if (!thanksMessage) {
    return message.channel.send(
      `You have to thank them for something specific. ${example}`,
    )
  }

  const thanksChannel = getChannel(message.guild, {name: 'thank-you'})
  const messageLink = getMessageLink(message)
  const thankedMembersList = listify(thankedMembers, {
    stringify: m => m.user.toString(),
  })
  const result = await thanksChannel.send(
    `
Hey ${thankedMembersList}! You got thanked! 🎉

${member.user} appreciated you for:

> ${thanksMessage}

Link: <${messageLink}>
    `.trim(),
  )
  return result
}
thanks.description = `A special way to show your appreciation for someone who's helped you out a bit`
thanks.help = async message => {
  const thanksChannel = getChannel(message.guild, {name: 'thank-you'})
  await message.channel.send(
    `Send \`?thanks @UserName for answering my question about which socks I should wear and being so polite.\` (for example), and your thanks will appear in the ${thanksChannel}`,
  )
}

module.exports = thanks
