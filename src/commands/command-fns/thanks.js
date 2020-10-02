// Command purpose:
// this command is just to make sure the bot is running
const got = require('got')
const {MessageMentions} = require('discord.js')
const {
  getCommandArgs,
  listify,
  getMember,
  getChannel,
  getMessageLink,
} = require('../utils')

async function getThanksHistory() {
  const response = await got.get(
    `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
    {
      headers: {
        Authorization: `token ${process.env.GIST_BOT_TOKEN}`,
      },
      responseType: 'json',
    },
  )
  if (response.body.files['thanks.json'].content === '') {
    return {}
  }
  return JSON.parse(response.body.files['thanks.json'].content)
}

async function saveThanksHistory(history) {
  const body = {
    public: 'false',
    files: {
      'thanks.json': {
        content: JSON.stringify(history),
      },
    },
  }
  await got.patch(
    `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
    {
      json: body,
      headers: {
        Authorization: `token ${process.env.GIST_BOT_TOKEN}`,
      },
      responseType: 'json',
    },
  )
}

async function sayThankYou(args, message, thanksHistory) {
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

  const messageLink = getMessageLink(message)

  thankedMembers.forEach(thankedMember => {
    thanksHistory[thankedMember.id] = thanksHistory[thankedMember.id] ?? []
    thanksHistory[thankedMember.id].push(messageLink)
  })

  try {
    await saveThanksHistory(thanksHistory)
  } catch (_) {
    return message.channel.send(
      `There is an issue saving the history. Please try again later`,
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

async function thanks(message) {
  const args = getCommandArgs(message.content)
  const rankArgs = args.replace(MessageMentions.USERS_PATTERN, '').trim()

  let thanksHistory
  try {
    thanksHistory = await getThanksHistory()
  } catch {
    return message.channel.send(
      `There is an issue retrieving the history. Please try again later 🙏`,
    )
  }

  const rankArgumentList = rankArgs.split(' ')
  if (
    rankArgumentList.length === 2 &&
    rankArgumentList[0] === 'rank' &&
    rankArgumentList[1] === 'top'
  ) {
    const sortedUsers = Object.keys(thanksHistory).sort((a, b) => {
      return thanksHistory[b].length - thanksHistory[a].length
    })
    const topUsers = []
    await sortedUsers.forEach(async user => {
      const member = await message.guild.members.fetch(user)
      if (member) {
        topUsers.push(member.user)
      }
    })
    return message.channel.send(
      `This is the list of the top thanked members 💪🏼:
${topUsers
  .map(
    user =>
      `- ${user.username} has been thanked  ${
        thanksHistory[user.id].length
      } times 👏`,
  )
  .join('\n')}
`,
    )
  } else if (rankArgumentList.length === 1 && rankArgumentList[0] === 'rank') {
    const mentionedMembers = Array.from(message.mentions.members.values())
    let searchedMembers = [message.author]
    if (mentionedMembers.length > 0) {
      searchedMembers = mentionedMembers.map(member => member.user)
    }

const rankings = searchedMembers
  .map(member => {
    const thanks = thanksHistory[member.id]
    return thanks
      ? `- ${member.username} has been thanked ${thanks.length} time${
          thanks.length === 1 ? '' : 's'
        } 👏`
      : `- ${member.username} hasn't been thanked yet 🙁`
  })
  .join('\n')

message.channel.send(
  `
This is the rank of the requested member${
    searchedMembers.length === 1 ? '' : 's'
  }: 
${rankings}
  `.trim(),
)
  } else {
    return sayThankYou(args, message, thanksHistory)
  }
}

thanks.description = `A special way to show your appreciation for someone who's helped you out a bit`
thanks.help = async message => {
  const thanksChannel = getChannel(message.guild, {name: 'thank-you'})

  const commandsList = [
    `- Send \`?thanks @UserName for answering my question about which socks I should wear and being so polite.\` (for example), and your thanks will appear in the ${thanksChannel}.`,
    `- Send \`?thanks rank\` to show the number of times you have been thanked.`,
    `- Send \`?thanks rank top\` to show the top 10 users.`,
    `- Send \`?thanks rank @Username\` to show the number of times have been thanked the mentioned users.`,
  ]
  await message.channel.send(
    `This is the list of the available commands \n ${commandsList.join('\n')}`,
  )
}

module.exports = thanks
