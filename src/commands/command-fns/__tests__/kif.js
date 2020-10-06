const Discord = require('discord.js')
const {rest} = require('msw')
const {setupServer} = require('msw/node')
const {makeFakeClient} = require('test-utils')
const kif = require('../kif')

const server = setupServer(
  rest.get(
    'https://api.github.com/repos/kentcdodds/kifs/contents/kifs.json',
    (req, res, ctx) => {
      return res(
        ctx.json({
          encoding: 'base64',
          content: Buffer.from(
            JSON.stringify({
              hi: {
                gif: 'https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V',
                emojiAliases: ['👋'],
              },
              'aw shucks': {
                gif:
                  'https://giphy.com/gifs/koala-bear-kody-kentcdodds-kC3NfswHHg0AXtsywr',
                emojiAliases: ['🐨', '😊'],
              },
              sweet: {
                gif:
                  'https://giphy.com/gifs/sweet-flip-roller-blades-MDxjbPCg6DGf8JclbR',
                emojiAliases: ['🍬', '🍭'],
              },
              thanks: {
                gif:
                  'https://giphy.com/gifs/thank-you-kentcdodds-hV7Vz9VwUaedWJZIxp',
                emojiAliases: ['🙏'],
              },
              agree: {
                gif:
                  'https://giphy.com/gifs/agreed-kentcdodds-IcudIFZssABGjEeceT',
                aliases: ['agreed'],
              },
              peace: {
                gif:
                  'https://giphy.com/gifs/peace-kentcdodds-j1ygW1a3xnc7UNtj6g',
                aliases: ['goodbye'],
                emojiAliases: ['☮️'],
              },
              'peace fall': {
                gif:
                  'https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n',
              },
              adorable: {
                gif:
                  'https://giphy.com/gifs/awwwww-kentcdodds-H1qlGJ78yOaePRcUBy',
                aliases: ['cute', 'aw'],
                emojiAliases: ['🥺'],
              },
            }),
          ).toString('base64'),
        }),
      )
    },
  ),
)

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

function getMessage(content) {
  const {client, talkToBotsChannel, kody} = makeFakeClient()
  const message = new Discord.Message(
    client,
    {
      id: 'help_test',
      content,
      author: kody.user,
    },
    talkToBotsChannel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, [], [], false),
  })
  return message
}

test('sends a gif', async () => {
  const message = getMessage('?kif hi')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "From: kody
    https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests similar item', async () => {
  const message = getMessage('?kif peace fail')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peace fail\\"

    Did you mean \\"peace fall\\"?

    _This message will self-destruct in about 10 seconds_"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests two items', async () => {
  const message = getMessage('?kif peac')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peac\\"

    Did you mean \\"peace\\" or \\"peace fall\\"?

    _This message will self-destruct in about 10 seconds_"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests several items (but no more than 6)', async () => {
  const message = getMessage('?kif a')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"a\\"

    Did you mean \\"aw\\", \\"adorable\\", \\"agree\\", \\"agreed\\", \\"aw shucks\\", or \\"peace\\"?

    _This message will self-destruct in about 10 seconds_"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test(`says it can't find something if it can't`, async () => {
  const message = getMessage('?kif djskfjdlakfjewoifdjd')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"djskfjdlakfjewoifdjd\\"

    _This message will self-destruct in about 10 seconds_"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})
