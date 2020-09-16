const {rest} = require('msw')
const {setupServer} = require('msw/node')
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

test('sends a gif', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif hi', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V"`,
  )
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests similar item', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif peace fail', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peace fail\\"

    Did you mean \\"peace fall\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests two items', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif peac', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peac\\"

    Did you mean \\"peace\\" or \\"peace fall\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests several items (but no more than 6)', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif a', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"a\\"

    Did you mean \\"aw\\", \\"adorable\\", \\"agree\\", \\"agreed\\", \\"aw shucks\\", or \\"peace\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test(`says it can't find something if it can't`, async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif djskfjdlakfjewoifdjd', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Couldn't find a kif for: \\"djskfjdlakfjewoifdjd\\""`,
  )
  expect(send).toHaveBeenCalledTimes(1)
})
