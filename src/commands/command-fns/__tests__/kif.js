const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const kif = require('../kif')

async function setup(content) {
  const {client, defaultChannels, kody} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {
      id: 'help_test',
      content,
      author: kody.user,
    },
    defaultChannels.talkToBotsChannel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, [], [], false),
  })
  await kif(message)

  const messages = Array.from(
    defaultChannels.talkToBotsChannel.messages.cache.values(),
  )
  return {messages}
}

test('sends a gif', async () => {
  const {messages} = await setup('?kif hi')

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "From: kody
    https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V"
  `)
})

test('suggests similar item', async () => {
  const {messages} = await setup('?kif peace fail')

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "Did you mean \\"peace fall\\"?
    From: kody
    https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n"
  `)
})

test('should use username in the from if nickname is not defined', async () => {
  const {client, defaultChannels, createUser} = await makeFakeClient()
  const userWithOnlyUsername = await createUser(null, {
    username: 'userWithOnlyUsername',
  })
  const message = new Discord.Message(
    client,
    {
      id: 'help_test',
      content: '?kif peace fail',
      author: userWithOnlyUsername.user,
    },
    defaultChannels.talkToBotsChannel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, [], [], false),
  })
  await kif(message)

  const messages = Array.from(
    defaultChannels.talkToBotsChannel.messages.cache.values(),
  )

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "Did you mean \\"peace fall\\"?
    From: userWithOnlyUsername
    https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n"
  `)
})

test('suggests two items', async () => {
  const {messages} = await setup('?kif peac')

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peac\\"

    Did you mean \\"peace\\" or \\"peace fall\\"?"
  `)
})

test('suggests several items (but no more than 6)', async () => {
  const {messages} = await setup('?kif a')

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"a\\"

    Did you mean \\"aw\\", \\"adorable\\", \\"agree\\", \\"agreed\\", \\"aw shucks\\", or \\"peace\\"?"
  `)
})

test(`says it can't find something if it can't`, async () => {
  const {messages} = await setup('?kif djskfjdlakfjewoifdjd')

  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(
    `"Couldn't find a kif for: \\"djskfjdlakfjewoifdjd\\""`,
  )
})
