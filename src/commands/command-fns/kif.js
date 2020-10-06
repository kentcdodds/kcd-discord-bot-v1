// Command purpose:
// this command is just to make sure the bot is running
const {MessageMentions} = require('discord.js')
const leven = require('leven')
const got = require('got')
const {default: matchSorter} = require('match-sorter')
const {
  getCommandArgs,
  listify,
  getMember,
  rollbar,
  sendBotMessageReply,
} = require('../utils')

const cache = {
  kifs: null,
  kifsWithAliases: null,
  kifMap: null,
  kifKeysWithoutEmoji: null,
}

async function getKifInfo({force = false} = {}) {
  if (cache.kifs && !force) return cache

  const kifs = await got(
    'https://api.github.com/repos/kentcdodds/kifs/contents/kifs.json',
  )
    .json()
    .then(
      data => JSON.parse(Buffer.from(data.content, data.encoding).toString()),
      e =>
        rollbar.error(
          `There was a problem getting kifs info from GitHub:`,
          e.message,
        ),
    )
  const kifKeysWithoutEmoji = []
  const kifMap = {}
  for (const kifKey of Object.keys(kifs)) {
    const {gif, aliases = [], emojiAliases = []} = kifs[kifKey]
    kifMap[kifKey] = gif
    kifKeysWithoutEmoji.push(kifKey, ...aliases)
    for (const alias of [...aliases, ...emojiAliases]) {
      if (kifMap[alias]) {
        console.error(`Cannot have two kifs with the same alias: ${alias}`)
      }
      kifMap[alias] = gif
    }
  }
  kifKeysWithoutEmoji.sort()

  const kifsWithAliases = Object.keys(kifs).map(kifKey => {
    const {aliases = [], emojiAliases = []} = kifs[kifKey]
    const allAliases = [...aliases, ...emojiAliases]
    if (allAliases.length) {
      return `${kifKey} (${listify([...aliases, ...emojiAliases], {
        stringify: i => i,
        conjunction: 'or ',
      })})`
    } else {
      return kifKey
    }
  })
  Object.assign(cache, {kifs, kifMap, kifKeysWithoutEmoji, kifsWithAliases})
  return cache
}

async function getCloseMatches(search) {
  const {kifKeysWithoutEmoji} = await getKifInfo()
  return Array.from(
    new Set([
      // levenshtein distance matters most, but we want it sorted
      ...matchSorter(
        kifKeysWithoutEmoji.filter(k => leven(k, search) < 2),
        search,
        // sometimes match sorter doesn't consider things to match
        // but the levenshtein distance is close, so we'll allow NO_MATCH here
        {threshold: matchSorter.rankings.NO_MATCH},
      ),
      // let's add whatever else isn't close in levenshtein distance, but
      // does still match with match sorter.
      ...matchSorter(kifKeysWithoutEmoji, search),
    ]),
  ).slice(0, 6)
}

async function sendKif(message, kif) {
  const mentionedMembersNicknames = Array.from(
    message.mentions.members.values(),
  ).map(m => m.nickname ?? m.user.username)
  const from = `From: ${getMember(message.guild, message.author.id).nickname}`
  const to = mentionedMembersNicknames.length
    ? `To: ${listify(mentionedMembersNicknames, {stringify: i => i})}`
    : ''
  return message.channel.send([from, to, kif].filter(Boolean).join('\n'))
}

async function handleKifCommand(message) {
  const args = getCommandArgs(message.content)

  const kifArg = args.replace(MessageMentions.USERS_PATTERN, '').trim()
  const {kifMap} = await getKifInfo()

  if (kifMap[kifArg]) {
    return sendKif(message, kifMap[kifArg])
  } else {
    const updatedCache = await getKifInfo({force: true})
    if (updatedCache.kifMap[kifArg]) {
      return sendKif(message, updatedCache.kifMap[kifArg])
    }
  }

  const closeMatches = await getCloseMatches(kifArg)
  const didYouMean = closeMatches.length
    ? `Did you mean ${listify(closeMatches, {conjunction: 'or '})}?`
    : ''
  return message.channel.send(
    `
Couldn't find a kif for: "${kifArg}"

${didYouMean}
    `.trim(),
    {time: 10, units: 'seconds'},
  )
}
handleKifCommand.description = 'Send a KCD gif'
async function help(message) {
  const {kifsWithAliases} = await getKifInfo()
  const kifList = `- ${kifsWithAliases.join('\n- ')}`
  return sendBotMessageReply(message, `Available kifs are:\n${kifList}`)
}
handleKifCommand.help = help

module.exports = handleKifCommand
