// Command purpose:
// this command is just to make sure the bot is running
import type * as TDiscord from 'discord.js'
import got from 'got'
import {MessageMentions} from 'discord.js'
import {
  getCommandArgs,
  listify,
  getMember,
  getMessageLink,
  getTextChannel,
} from '../utils'

/**
 * Each tuple in this array represents:
 *
 * `[recipientId, senderId, messageLink]`
 */
type ThanksHistory = Array<[string, string, string]>
type GitHubRequestBody = {
  public: 'false'
  files: {
    'thanks.json': {
      content: string
    }
  }
}
type GitHubResponseBody = {files: {['thanks.json']?: {content: string}}}

async function getThanksHistory(): Promise<ThanksHistory> {
  const response = (await got.get(
    `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
    {
      headers: {
        Authorization: `token ${process.env.GIST_BOT_TOKEN}`,
      },
      responseType: 'json',
    },
  )) as {body: GitHubResponseBody}
  try {
    return JSON.parse(response.body.files['thanks.json']?.content ?? '{}')
  } catch {
    return []
  }
}

async function saveThanksHistory(history: ThanksHistory) {
  const body: GitHubRequestBody = {
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

async function sayThankYou(
  args: string,
  message: TDiscord.Message,
  thanksHistory: ThanksHistory,
) {
  const member = getMember(message.guild, message.author.id)
  const thanksChannel = getTextChannel(message.guild, 'thank-you')

  if (!member || !message.mentions.members || !thanksChannel) return

  const thankedMembers = Array.from(message.mentions.members.values())
  if (!thankedMembers.length) {
    return message.channel.send(
      `You have to mention someone specific you want to thank.`,
    )
  }

  const thanksMessage = args
    .replace(MessageMentions.USERS_PATTERN, '')
    .replace(/^ *(?:for *)?/, '')
    .trim()

  const messageLink = getMessageLink(message)

  thanksHistory = thanksHistory.concat(
    thankedMembers.map(thankedMember => [
      thankedMember.id,
      member.user.id,
      messageLink,
    ]),
  )

  try {
    await saveThanksHistory(thanksHistory)
  } catch {
    return message.channel.send(
      `There is an issue saving the history. Please try again later`,
    )
  }

  const thankedMembersList = listify(thankedMembers)

  const textOfNewThanksMessage = thanksMessage
    ? `
Hey ${thankedMembersList}! You got thanked! 🎉

${member} appreciated you for:

> ${thanksMessage}

Link: <${messageLink}>`
    : `
Hey ${thankedMembersList}! You got thanked! 🎉

${member.user} appreciated you.

Link: <${messageLink}>`

  const newThanksMessage = await thanksChannel.send(
    textOfNewThanksMessage.trim(),
  )

  return message.channel.send(
    `Aw! Thanks! ${getMessageLink(newThanksMessage)} 😍`,
  )
}

async function thanks(message: TDiscord.Message) {
  const guild = message.guild
  if (!guild) return
  const args = getCommandArgs(message.content)
  const rankArgs = args.replace(MessageMentions.USERS_PATTERN, '').trim()

  let thanksHistory: ThanksHistory
  try {
    thanksHistory = await getThanksHistory()
  } catch {
    return message.channel.send(
      `There is an issue retrieving the history. Please try again later 🙏`,
    )
  }

  function listThanks(users: Array<TDiscord.User>) {
    return users
      .map(usr => {
        return {
          username: usr.username,
          count: thanksHistory.filter(([receiver]) => receiver === usr.id)
            .length,
        }
      })
      .sort((a, z) => z.count - a.count)
      .map(({username, count}) => {
        const times = `time${count === 1 ? '' : 's'}`
        return count > 0
          ? `- ${username} has been thanked ${count} ${times} 👏`
          : `- ${username} hasn't been thanked yet 🙁`
      })
      .join('\n')
  }

  const rankArgumentList = rankArgs.split(' ')
  if (
    rankArgumentList.length === 2 &&
    rankArgumentList[0] === 'rank' &&
    rankArgumentList[1] === 'top'
  ) {
    const uniqueUsers = new Set(thanksHistory.map(([receiver]) => receiver))
    const userThankCounts: Array<[string, number]> = Array.from(
      uniqueUsers,
    ).map(user => [
      user,
      thanksHistory.filter(([receiver]) => receiver === user).length,
    ])
    const topUsers = userThankCounts
      .sort(([, aCount], [, bCount]) => bCount - aCount)
      .flatMap(([memberId]) => getMember(guild, memberId) ?? [])
      .map(({user}) => user)
      .slice(0, 10)

    return message.channel.send(
      `
This is the list of the top thanked members 💪:
${listThanks(topUsers)}
      `.trim(),
    )
  } else if (rankArgumentList.length === 1 && rankArgumentList[0] === 'rank') {
    const mentionedMembers = Array.from(
      message.mentions.members?.values() ?? {length: 0},
    )
    let searchedMembers = [message.author]
    if (mentionedMembers.length > 0) {
      searchedMembers = mentionedMembers.map(member => member.user)
    }

    const members = `member${searchedMembers.length === 1 ? '' : 's'}`
    return message.channel.send(
      `
This is the rank of the requested ${members}:
${listThanks(searchedMembers)}
      `.trim(),
    )
  } else {
    return sayThankYou(args, message, thanksHistory)
  }
}

thanks.description = `A special way to show your appreciation for someone who's helped you out a bit`
thanks.help = async (message: TDiscord.Message) => {
  if (!message.guild) return
  const thanksChannel = getTextChannel(message.guild, 'thank-you')

  const commandsList = [
    `- Send \`?thanks @UserName for answering my question about which socks I should wear and being so polite.\` (for example), and your thanks will appear in the ${thanksChannel}.`,
    `- Send \`?thanks rank\` to show the number of times you have been thanked.`,
    `- Send \`?thanks rank top\` to show the top 10 most thanked users.`,
    `- Send \`?thanks rank @Username\` to show the number of times @Username has been thanked.`,
    `- Send \`?thanks gratitude rank\` to show the number of times you have thanked someone else.`,
    `- Send \`?thanks gratitude top\` to show the top 10 users who have thanked others the most times.`,
    `- Send \`?thanks gratitude @UserName\` to show the number of times @Username has thanked someone else.`,
  ]
  await message.channel.send(
    `
This is the list of the available commands:
${commandsList.join('\n')}
    `.trim(),
  )
}

export {thanks}
export type {ThanksHistory, GitHubResponseBody, GitHubRequestBody}
