// Command purpose:
// this command is just to make sure the bot is running
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
}

function kif(message) {
  const args = getArgs(message.content)
  if (kifs[args]) {
    return message.channel.send(kifs[args])
  }
  return message.channel.send(`Couldn't find a kif for: "${args}"`)
}
kif.description = 'Send a KCD gif'
kif.help = message =>
  message.channel.send(`Available kifs are: ${Object.keys(kifs).join(', ')}`)

module.exports = kif
