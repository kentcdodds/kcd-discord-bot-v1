// Command purpose:
// this command is just to make sure the bot is running
const leven = require('leven')
const {default: matchSorter} = require('match-sorter')
const {
  getCommandArgs,
  listify,
  getChannel,
  getMember,
  getMessageLink,
} = require('../utils')

// Here we separate aliases and emojiAliases
// The reason for this is because when we don't have a kif for the given argument
// we want to suggest something, but our suggestion function doesn't work well
// for emoji (really random suggestions).
const kifs = {
  sweet: {
    gif: 'https://giphy.com/gifs/sweet-flip-roller-blades-MDxjbPCg6DGf8JclbR',
    emojiAliases: ['🍬'],
  },
  thanks: {
    gif: 'https://giphy.com/gifs/thank-you-kentcdodds-hV7Vz9VwUaedWJZIxp',
    emojiAliases: ['🙏'],
  },
  agree: {
    gif: 'https://giphy.com/gifs/agreed-kentcdodds-IcudIFZssABGjEeceT',
    aliases: ['agreed'],
  },
  'mind blown': {
    gif:
      'https://giphy.com/gifs/mind-blown-amazed-kentcdodds-fYB7BTqxTvBIvNeS5l',
    aliases: ['wow'],
    emojiAliases: ['🤯'],
  },
  applause: {
    gif: 'https://giphy.com/gifs/applause-kentcdodds-hU8sgywxcUkYad9O6D',
    aliases: ['bravo'],
    emojiAliases: ['👏'],
  },
  "you're awesome": {
    gif: 'https://giphy.com/gifs/youre-awesome-kentcdodds-SXlgWqXyqddHfGCc8n',
  },
  'aw thanks': {
    gif: 'https://giphy.com/gifs/thanks-aw-kentcdodds-W6QJfAyl7hFezUcXvd',
  },
  'aw shucks': {
    gif: 'https://giphy.com/gifs/koala-bear-kody-kentcdodds-kC3NfswHHg0AXtsywr',
    emojiAliases: ['🐨', '😊'],
  },
  celebration: {
    gif: 'https://giphy.com/gifs/yes-celebration-kentcdodds-ZczZ5nkk2Cj5CRfea3',
    aliases: ['hooray', 'wahoo'],
  },
  'just do it': {
    gif: 'https://giphy.com/gifs/just-do-it-kentcdodds-H3Ga5LUGmDv6Fs87ZJ',
  },
  'just do it 2': {
    gif: 'https://giphy.com/gifs/just-do-it-kentcdodds-KAGuvir2lVZGkfjRgJ',
  },
  'just do it 3': {
    gif: 'https://giphy.com/gifs/just-do-it-kentcdodds-Y3wtkcaQHITp0Mj8oB',
  },
  'just do it 4': {
    gif: 'https://giphy.com/gifs/just-do-it-kentcdodds-lqLude9QGxiaNfy8gZ',
  },
  laugh: {
    gif: 'https://giphy.com/gifs/laughing-kentcdodds-dAu6gql3xTuhDz9oHE',
    emojiAliases: ['😆', '🤣', '😂'],
  },
  idea: {
    gif: 'https://giphy.com/gifs/idea-kentcdodds-dstfj1vQEvgTVzbTu9',
    emojiAliases: ['💡'],
  },
  sleepy: {
    gif: 'https://giphy.com/gifs/sleepy-kentcdodds-QZnjmY73FndhhjcAVe',
    aliases: ['sleep', 'tired'],
    emojiAliases: ['😩', '🛌', '😴', '💤', '😪'],
  },
  nono: {
    gif: 'https://giphy.com/gifs/no-kentcdodds-VdPN7kzA25Fi45D2we',
    aliases: ['trouble'],
    emojiAliases: ['😠'],
  },
  'kody no': {
    gif: 'https://giphy.com/gifs/no-kody-kentcdodds-LNrtJbKxfANBRO1mDk',
    emojiAliases: ['🐨🙅‍♂️', '🐨🙅', '🐨🙅‍♀️'],
  },
  speechless: {
    gif:
      'https://giphy.com/gifs/speechless-loss-for-words-kentcdodds-lSD7CQN1clJXOsrPNU',
    emojiAliases: ['🤔', '😐', '😒'],
  },
  spinning: {
    gif: 'https://giphy.com/gifs/space-react-kentcdodds-S6fwymvLr3hfFCEIU9',
  },
  rar: {
    gif: 'https://giphy.com/gifs/jumping-react-kentcdodds-iHt6BBLEFNqS2HWoi7',
  },
  excited: {
    gif: 'https://giphy.com/gifs/excited-kentcdodds-cjPz6B53w0VvI0Oi4G',
    emojiAliases: ['🤩'],
  },
  "chef's kiss": {
    gif: 'https://giphy.com/gifs/chefs-kiss-kentcdodds-JtH6Z1hYsrdnAWEdtZ',
    aliases: ['beautiful'],
    emojiAliases: ['🧑‍🍳', '👩‍🍳', '👨‍🍳'],
  },
  adorable: {
    gif: 'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
    aliases: ['cute', 'aw'],
    emojiAliases: ['🥺'],
  },
  oh: {
    gif: 'https://giphy.com/gifs/oh-huh-duh-jOzQAhuT3WUp19JldV',
    aliases: ['duh'],
    emojiAliases: ['😮'],
  },
  hm: {
    gif: 'https://giphy.com/gifs/hmmm-eyebrow-kentcdodds-J2yDtNrNFsNDBJk2rR',
    aliases: ['hmm', 'hmmm'],
  },
  gotcha: {
    gif: 'https://giphy.com/gifs/gotcha-kentcdodds-XeGeQIzpqfL7GtcTMH',
  },
  heehee: {
    gif: 'https://giphy.com/gifs/heehee-kentcdodds-kFHbtKZjQgU7VN46N2',
    emojiAliases: ['😈'],
  },
  hi: {
    gif: 'https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V',
    emojiAliases: ['👋'],
  },
  huh: {
    gif: 'https://giphy.com/gifs/huh-kentcdodds-RkLARRPJk0dVDU8jfe',
  },
  'laugh cry': {
    gif: 'https://giphy.com/gifs/laugh-cry-sob-XHw7m2zy93EAjBLTZS',
  },
  'laugh huh': {
    gif: 'https://giphy.com/gifs/what-laughing-wait-W23NVmwsjQ1xaXVomI',
    emojiAliases: ['😕'],
  },
  no: {
    gif: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
    aliases: ['noo', 'nooo'],
    emojiAliases: ['🙅', '🙅‍♂️', '🙅‍♀️'],
  },
  peek: {
    gif: 'https://giphy.com/gifs/sliding-in-kentcdodds-mBYW2Fl1euZQXppJWN',
  },
  this: {
    gif: 'https://giphy.com/gifs/kentcdodds-Lq6JZYxWUFdabFfwGF',
    emojiAliases: ['☝️'],
  },
  waiting: {
    gif: 'https://giphy.com/gifs/waiting-Y2yKmMembXGbQLb0ne',
    aliases: ['hurry'],
    emojiAliases: ['🏃', '🏃‍♀️', '🏃‍♂️', '⌚', '⏱'],
  },
  yes: {
    gif: 'https://giphy.com/gifs/yes-kentcdodds-mBwNA1bBnbHcZqhaLI',
    aliases: ['awesome'],
    emojiAliases: ['👍'],
  },
  peace: {
    gif: 'https://giphy.com/gifs/peace-kentcdodds-j1ygW1a3xnc7UNtj6g',
    aliases: ['goodbye'],
    emojiAliases: ['☮️'],
  },
  'peace fall': {
    gif: 'https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n',
  },
}

const kifKeysWithoutEmoji = []
const kifMap = {}
for (const kifKey of Object.keys(kifs)) {
  const {gif, aliases = [], emojiAliases = []} = kifs[kifKey]
  kifMap[kifKey] = gif
  kifKeysWithoutEmoji.push(kifKey, ...aliases)
  for (const alias of [...aliases, ...emojiAliases]) {
    if (kifMap[alias]) {
      throw new Error(`Cannot have two kifs with the same alias: ${alias}`)
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

function getCloseMatches(search) {
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

function kif(message) {
  const args = getCommandArgs(message.content)
  if (kifMap[args]) {
    return message.channel.send(kifMap[args])
  }
  const closeMatches = getCloseMatches(args)
  const didYouMean = closeMatches.length
    ? `Did you mean ${listify(closeMatches, {conjunction: 'or '})}?`
    : ''
  return message.channel.send(
    `
Couldn't find a kif for: "${args}"

${didYouMean}
  `.trim(),
  )
}
kif.description = 'Send a KCD gif'
async function help(message) {
  const botsChannel = getChannel(message.guild, {name: 'talk-to-bots'})
  const {user} = getMember(message.guild, message.author.id)
  const kifList = `- ${kifsWithAliases.join('\n- ')}`
  if (message.channel.id === botsChannel.id) {
    return botsChannel.send(`Available kifs are:\n${kifList}`)
  }
  const requestLink = getMessageLink(message)
  const botMessage = await botsChannel.send(
    `Hi ${user}. You asked for help with kifs (<${requestLink}>). Available kifs are:\n${kifList}`,
  )
  const botMessageLink = getMessageLink(botMessage)
  await message.channel.send(
    `${user}, I sent you the list of available kifs in ${botsChannel}: <${botMessageLink}>`,
  )
}
kif.help = help

module.exports = kif
