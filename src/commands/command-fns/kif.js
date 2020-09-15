// Command purpose:
// this command is just to make sure the bot is running
const leven = require('leven')
const {default: matchSorter} = require('match-sorter')
const {getCommandArgs, listify} = require('../utils')

const kifsBase = {
  sweet: 'https://giphy.com/gifs/sweet-flip-roller-blades-MDxjbPCg6DGf8JclbR',
  thanks: 'https://giphy.com/gifs/thank-you-kentcdodds-hV7Vz9VwUaedWJZIxp',
  agree: 'https://giphy.com/gifs/agreed-kentcdodds-IcudIFZssABGjEeceT',
  'mind blown':
    'https://giphy.com/gifs/mind-blown-amazed-kentcdodds-fYB7BTqxTvBIvNeS5l',
  applause: 'https://giphy.com/gifs/applause-kentcdodds-hU8sgywxcUkYad9O6D',
  "you're awesome":
    'https://giphy.com/gifs/youre-awesome-kentcdodds-SXlgWqXyqddHfGCc8n',
  'aw, thanks':
    'https://giphy.com/gifs/thanks-aw-kentcdodds-W6QJfAyl7hFezUcXvd',
  'aw, shucks':
    'https://giphy.com/gifs/koala-bear-kody-kentcdodds-kC3NfswHHg0AXtsywr',
  celebration:
    'https://giphy.com/gifs/yes-celebration-kentcdodds-ZczZ5nkk2Cj5CRfea3',
  'just do it':
    'https://giphy.com/gifs/just-do-it-kentcdodds-H3Ga5LUGmDv6Fs87ZJ',
  'just do it 2':
    'https://giphy.com/gifs/just-do-it-kentcdodds-KAGuvir2lVZGkfjRgJ',
  'just do it 3':
    'https://giphy.com/gifs/just-do-it-kentcdodds-Y3wtkcaQHITp0Mj8oB',
  'just do it 4':
    'https://giphy.com/gifs/just-do-it-kentcdodds-lqLude9QGxiaNfy8gZ',
  laugh: 'https://giphy.com/gifs/laughing-kentcdodds-dAu6gql3xTuhDz9oHE',
  idea: 'https://giphy.com/gifs/idea-kentcdodds-dstfj1vQEvgTVzbTu9',
  sleepy: 'https://giphy.com/gifs/sleepy-kentcdodds-QZnjmY73FndhhjcAVe',
  nono: 'https://giphy.com/gifs/no-kentcdodds-VdPN7kzA25Fi45D2we',
  'kody no': 'https://giphy.com/gifs/no-kody-kentcdodds-LNrtJbKxfANBRO1mDk',
  speechless:
    'https://giphy.com/gifs/speechless-loss-for-words-kentcdodds-lSD7CQN1clJXOsrPNU',
  spinning: 'https://giphy.com/gifs/space-react-kentcdodds-S6fwymvLr3hfFCEIU9',
  rar: 'https://giphy.com/gifs/jumping-react-kentcdodds-iHt6BBLEFNqS2HWoi7',
  excited: 'https://giphy.com/gifs/excited-kentcdodds-cjPz6B53w0VvI0Oi4G',
  'chefs kiss':
    'https://giphy.com/gifs/chefs-kiss-kentcdodds-JtH6Z1hYsrdnAWEdtZ',
  adorable: 'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
  oh: 'https://giphy.com/gifs/oh-huh-duh-jOzQAhuT3WUp19JldV',
  hm: 'https://giphy.com/gifs/hmmm-eyebrow-kentcdodds-J2yDtNrNFsNDBJk2rR',
  gotcha: 'https://giphy.com/gifs/gotcha-kentcdodds-XeGeQIzpqfL7GtcTMH',
  heehee: 'https://giphy.com/gifs/heehee-kentcdodds-kFHbtKZjQgU7VN46N2',
  hi: 'https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V',
  huh: 'https://giphy.com/gifs/huh-kentcdodds-RkLARRPJk0dVDU8jfe',
  'laugh cry': 'https://giphy.com/gifs/laugh-cry-sob-XHw7m2zy93EAjBLTZS',
  'laugh huh': 'https://giphy.com/gifs/what-laughing-wait-W23NVmwsjQ1xaXVomI',
  no: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  peek: 'https://giphy.com/gifs/sliding-in-kentcdodds-mBYW2Fl1euZQXppJWN',
  this: 'https://giphy.com/gifs/kentcdodds-Lq6JZYxWUFdabFfwGF',
  waiting: 'https://giphy.com/gifs/waiting-Y2yKmMembXGbQLb0ne',
  yes: 'https://giphy.com/gifs/yes-kentcdodds-mBwNA1bBnbHcZqhaLI',
  peace: 'https://giphy.com/gifs/peace-kentcdodds-j1ygW1a3xnc7UNtj6g',
  'peace fall':
    'https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n',
}

const aliases = {
  agree: ['agreed'],
  celebration: ['hooray', 'wahoo'],
  no: ['🙅', 'noo', 'nooo'],
  sweet: ['🍬'],
  thanks: ['🙏'],
  'mind blown': ['🤯', 'wow'],
  applause: ['👏', 'bravo'],
  excited: ['🤩'],
  'chefs kiss': ['🧑‍🍳', 'beautiful'],
  adorable: ['🥺', 'cute', 'aw'],
  oh: ['😮', 'duh'],
  heehee: ['😈'],
  'aw, shucks': ['🐨', '😊'],
  'kody no': ['🐨🙅‍♂️'],
  hi: ['👋'],
  speechless: ['🤔', '😐', '😒'],
  'laugh huh': ['😕'],
  laugh: ['😆', '🤣', '😂'],
  nono: ['trouble', '😠'],
  sleepy: ['😩', '🛌', '😴', '💤', '😪', 'sleep', 'tired'],
  peak: ['slide'],
  this: ['☝️'],
  hurry: ['🏃', 'waiting'],
  idea: ['💡'],
  hm: ['hmm', 'hmmm'],
  yes: ['👍', 'awesome'],
  peace: ['☮️', 'goodbye'],
}

const kifs = {...kifsBase}
for (const kifAlias of Object.keys(aliases)) {
  const base = kifsBase[kifAlias]
  for (const alias of aliases[kifAlias]) {
    kifs[alias] = base
  }
}

const kifKeys = Object.keys(kifs).sort()

function getCloseMatches(search) {
  return Array.from(
    new Set([
      // levenshtein distance matters most, but we want it sorted
      ...matchSorter(
        kifKeys.filter(k => leven(k, search) < 2),
        search,
        // sometimes match sorter doesn't consider things to match
        // but the levenshtein distance is close, so we'll allow NO_MATCH here
        {threshold: matchSorter.rankings.NO_MATCH},
      ),
      // let's add whatever else isn't close in levenshtein distance, but
      // does still match with match sorter.
      ...matchSorter(kifKeys, search),
    ]),
  ).slice(0, 6)
}

function kif(message) {
  const args = getCommandArgs(message.content)
  if (kifs[args]) {
    return message.channel.send(kifs[args])
  }
  const closeMatches = getCloseMatches(args)
  return message.channel.send(
    `
Couldn't find a kif for: "${args}"

${closeMatches.length ? `Did you mean ${listify(closeMatches, 'or')}?` : ''}
  `.trim(),
  )
}
kif.description = 'Send a KCD gif'
kif.help = message =>
  message.channel.send(`Available kifs are: ${listify(kifKeys, 'and')}`)

module.exports = kif
