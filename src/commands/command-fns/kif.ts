// Command purpose:
// this command is just to make sure the bot is running
import type * as TDiscord from 'discord.js'
import {MessageMentions} from 'discord.js'
import leven from 'leven'
import got from 'got'
import {matchSorter} from 'match-sorter'
import {
  getCommandArgs,
  listify,
  getMember,
  rollbar,
  sendBotMessageReply,
  sendSelfDestructMessage,
  getErrorMessage,
  botLog,
  colors,
} from '../utils'

type KifData = {
  aliases?: Array<string>
  emojiAliases?: Array<string>
  gif: string
}
const kifCache: {
  initialized: boolean
  kifs: Record<string, KifData>
  kifMap: Record<string, string>
  kifKeysWithoutEmoji: Array<string>
} = {
  initialized: false,
  kifs: {},
  kifMap: {},
  kifKeysWithoutEmoji: [],
}

type KifsRawData = {content: string; encoding: 'utf8'}

async function getKifInfo(message: TDiscord.Message, {force = false} = {}) {
  if (kifCache.initialized && !force) return kifCache
  const {guild} = message

  const kifs = (await got(
    'https://api.github.com/repos/kentcdodds/kifs/contents/kifs.json',
  )
    .json()
    .then(
      data => {
        const kifsData = data as KifsRawData
        return JSON.parse(
          Buffer.from(kifsData.content, kifsData.encoding).toString(),
        )
      },
      (e: unknown) => {
        const errorMessage = getErrorMessage(e)
        rollbar.error(
          `There was a problem getting kifs info from GitHub:`,
          errorMessage,
        )
        if (guild) {
          botLog(guild, () => {
            return {
              title: '❌ Kif failure',
              color: colors.base08,
              description: `Trouble getting kifs from GitHub`,
              fields: [{name: 'Error Message', value: errorMessage}],
            }
          })
        }
        return {}
      },
    )) as Record<string, KifData>
  const kifKeysWithoutEmoji = []
  const kifMap: typeof kifCache['kifMap'] = {}
  for (const kifKey of Object.keys(kifs)) {
    const {gif, aliases = [], emojiAliases = []} = kifs[kifKey] ?? {}
    if (!gif) continue

    kifMap[kifKey.toLowerCase()] = gif
    kifKeysWithoutEmoji.push(kifKey, ...aliases)
    for (const alias of [...aliases, ...emojiAliases]) {
      if (kifMap[alias]) {
        rollbar.error(`Cannot have two kifs with the same alias: ${alias}`)
        if (guild) {
          botLog(guild, () => {
            return {
              title: '❌ Kif failure',
              color: colors.base08,
              description: `Two kifs have the same alias!`,
              url: 'https://github.com/kentcdodds/kifs/edit/main/kifs.json',
              fields: [
                {name: 'Duplicate alias', value: alias, inline: true},
                {name: 'First kif', value: kifMap[alias]},
                {name: 'Second kif', value: gif},
              ],
            }
          })
        }
      }
      kifMap[alias] = gif
    }
  }
  kifKeysWithoutEmoji.sort()

  Object.assign(kifCache, {
    initialized: true,
    kifs,
    kifMap,
    kifKeysWithoutEmoji,
  })
  return kifCache
}

async function getCloseMatches(message: TDiscord.Message, search: string) {
  const {kifKeysWithoutEmoji} = await getKifInfo(message)
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

function getKifReply(message: TDiscord.Message, kif: string) {
  const mentionedMembersNicknames = Array.from(
    message.mentions.members?.values() ?? {length: 0},
  ).map(m => m.displayName)
  const from = `From: ${
    getMember(message.guild, message.author.id)?.displayName ?? 'Unknown'
  }`
  const to = mentionedMembersNicknames.length
    ? `To: ${listify(mentionedMembersNicknames)}`
    : ''
  return [from, to, kif].filter(Boolean).join('\n')
}

async function handleKifCommand(message: TDiscord.Message) {
  const args = getCommandArgs(message.content)

  const kifArg = args
    .replace(MessageMentions.USERS_PATTERN, '')
    .trim()
    .toLowerCase()
  let cache = await getKifInfo(message)
  if (!cache.kifMap[kifArg]) {
    cache = await getKifInfo(message, {force: true})
  }

  const kif = cache.kifMap[kifArg]
  if (kif) {
    return message.channel.send(getKifReply(message, kif))
  }

  const closeMatches = await getCloseMatches(message, kifArg)
  if (closeMatches.length === 1 && closeMatches[0]) {
    const closestMatch = closeMatches[0]
    const matchingKif = cache.kifMap[closestMatch]
    if (matchingKif) {
      return message.channel.send(
        `Did you mean "${closestMatch}"?\n${getKifReply(message, matchingKif)}`,
      )
    }
  }
  const didYouMean = closeMatches.length
    ? `Did you mean ${listify(closeMatches, {
        type: 'disjunction',
        stringify: JSON.stringify,
      })}?`
    : ''
  return sendSelfDestructMessage(
    message.channel as TDiscord.TextChannel,
    `
Couldn't find a kif for: "${kifArg}"

${didYouMean}
    `.trim(),
    {time: 10, units: 'seconds'},
  )
}
handleKifCommand.description = `Send a KCD gif (send \`?help kif\` for more info)`
async function help(message: TDiscord.Message) {
  return sendBotMessageReply(
    message,
    `
"kifs" are "Kent C. Dodds Gifs" and you can find a full list of available kifs here: <https://kcd.im/kifs>

\`?kif amazed\` - Sends the "amazed" kif
\`?kif 👊 @kentcdodds\` - Sends the "fist bump" kif to \`@kentcdodds\`
    `.trim(),
  )
}
handleKifCommand.help = help

export {handleKifCommand as kif}
