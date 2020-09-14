// Command purpose:
// this command is just to make sure the bot is running
const leven = require('leven')
const {default: matchSorter} = require('match-sorter')
const {getArgs} = require('../command-regex')

const kifs = {
  sweet: 'https://giphy.com/gifs/sweet-flip-roller-blades-MDxjbPCg6DGf8JclbR',
  thanks: 'https://giphy.com/gifs/thank-you-kentcdodds-hV7Vz9VwUaedWJZIxp',
  agreed: 'https://giphy.com/gifs/agreed-kentcdodds-IcudIFZssABGjEeceT',
  agree: 'https://giphy.com/gifs/agreed-kentcdodds-IcudIFZssABGjEeceT',
  'mind blown':
    'https://giphy.com/gifs/mind-blown-amazed-kentcdodds-fYB7BTqxTvBIvNeS5l',
  bravo: 'https://giphy.com/gifs/applause-kentcdodds-hU8sgywxcUkYad9O6D',
  applause: 'https://giphy.com/gifs/applause-kentcdodds-hU8sgywxcUkYad9O6D',
  "you're awesome":
    'https://giphy.com/gifs/youre-awesome-kentcdodds-SXlgWqXyqddHfGCc8n',
  'aw, thanks':
    'https://giphy.com/gifs/thanks-aw-kentcdodds-W6QJfAyl7hFezUcXvd',
  spinning: 'https://giphy.com/gifs/space-react-kentcdodds-S6fwymvLr3hfFCEIU9',
  rar: 'https://giphy.com/gifs/jumping-react-kentcdodds-iHt6BBLEFNqS2HWoi7',
  excited: 'https://giphy.com/gifs/excited-kentcdodds-cjPz6B53w0VvI0Oi4G',
  beautiful: 'https://giphy.com/gifs/chefs-kiss-kentcdodds-JtH6Z1hYsrdnAWEdtZ',
  'chefs kiss':
    'https://giphy.com/gifs/chefs-kiss-kentcdodds-JtH6Z1hYsrdnAWEdtZ',
  cute: 'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
  adorable: 'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
  aw: 'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
  duh: 'https://giphy.com/gifs/oh-huh-duh-jOzQAhuT3WUp19JldV',
  oh: 'https://giphy.com/gifs/oh-huh-duh-jOzQAhuT3WUp19JldV',
  hmm: 'https://giphy.com/gifs/hmmm-eyebrow-kentcdodds-J2yDtNrNFsNDBJk2rR',
  gotcha: 'https://giphy.com/gifs/gotcha-kentcdodds-XeGeQIzpqfL7GtcTMH',
  heehee: 'https://giphy.com/gifs/heehee-kentcdodds-kFHbtKZjQgU7VN46N2',
  hi: 'https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V',
  huh: 'https://giphy.com/gifs/huh-kentcdodds-RkLARRPJk0dVDU8jfe',
  'laugh cry': 'https://giphy.com/gifs/laugh-cry-sob-XHw7m2zy93EAjBLTZS',
  'laugh huh': 'https://giphy.com/gifs/what-laughing-wait-W23NVmwsjQ1xaXVomI',
  no: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  noo: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  nooo: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  noooo: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  nooooo: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  noooooo: 'https://giphy.com/gifs/nooooo-kentcdodds-VzfU9S4UsFW0PeISZJ',
  slide: 'https://giphy.com/gifs/sliding-in-kentcdodds-mBYW2Fl1euZQXppJWN',
  peak: 'https://giphy.com/gifs/sliding-in-kentcdodds-mBYW2Fl1euZQXppJWN',
  this: 'https://giphy.com/gifs/kentcdodds-Lq6JZYxWUFdabFfwGF',
  waiting: 'https://giphy.com/gifs/waiting-Y2yKmMembXGbQLb0ne',
  hurry: 'https://giphy.com/gifs/waiting-Y2yKmMembXGbQLb0ne',
  yes: 'https://giphy.com/gifs/yes-kentcdodds-mBwNA1bBnbHcZqhaLI',
  awesome: 'https://giphy.com/gifs/yes-kentcdodds-mBwNA1bBnbHcZqhaLI',
  peace: 'https://giphy.com/gifs/peace-kentcdodds-j1ygW1a3xnc7UNtj6g',
  'peace fall':
    'https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n',
}
const kifsEmojis = {
  '🍬': 'sweet',
  '🙏': 'thanks',
  '🤯': 'mind blown',
  '👏': 'applause',
  '🤩': 'excited',
  '🧑‍🍳': 'chefs kiss',
  '🥺': 'adorable',
  '😮': 'oh',
  '😈': 'heehee',
  '👋': 'hi',
  '😕': 'laugh huh',
  '🙅': 'no',
  '⛰️': 'peak',
  '☝️': 'this',
  '🏃': 'hurry',
  '👍': 'yes',
  '☮️': 'peace',
}
const emojiRegEx = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gim
const kifKeys = Object.keys(kifs)

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

const listify = (array, joiner) =>
  array.reduce((list, item, index) => {
    if (index === 0) return `"${item}"`
    if (index === array.length - 1) {
      if (index === 1) return `${list} ${joiner} "${item}"`
      else return `${list}, ${joiner} "${item}"`
    }
    return `${list}, "${item}"`
  }, '')

function kif(message) {
  const args = getArgs(message.content)
  if (args.match(emojiRegEx) && kifsEmojis[args]) {
    // convert emoji into relevant key kif string then compute kif object
    return message.channel.send(kifs[kifsEmojis[args]])
  }
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
