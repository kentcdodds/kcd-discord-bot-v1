// Command purpose:
// provide information about the bot itself
import type * as TDiscord from 'discord.js'
import redent from 'redent'
import {
  sendBotMessageReply,
  getBuildTimeInfo,
  getStartTimeInfo,
  getCommitInfo,
} from '../utils'

async function info(message: TDiscord.Message) {
  const commitInfo = getCommitInfo()
  const commitLine = commitInfo
    ? `
Commit:
  author: ${commitInfo.author}
  date: ${commitInfo.date}
  message: ${commitInfo.message}
  link: <${commitInfo.link}>
`.trim()
    : 'Commit: info unavailable'
  const result = await sendBotMessageReply(
    message,
    `
Here's some info about the currently running bot:

${redent(
  [
    `Started at: ${getStartTimeInfo()}`,
    `Built at: ${getBuildTimeInfo()}`,
    commitLine,
  ].join('\n'),
  2,
)}
  `.trim(),
  )
  return result
}
info.description = 'Gives information about the bot (deploy date etc.)'

export {info}
