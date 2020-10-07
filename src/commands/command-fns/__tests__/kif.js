const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const kif = require('../kif')

async function getMessage(content) {
  const {client, talkToBotsChannel, kody} = await makeFakeClient()
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
  const message = await getMessage('?kif hi')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "From: kody
    https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests similar item', async () => {
  const message = await getMessage('?kif peace fail')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Did you mean \\"peace fall\\"?
    From: kody
    https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests two items', async () => {
  const message = await getMessage('?kif peac')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peac\\"

    Did you mean \\"peace\\" or \\"peace fall\\"?"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test('suggests several items (but no more than 6)', async () => {
  const message = await getMessage('?kif a')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"a\\"

    Did you mean \\"aw\\", \\"adorable\\", \\"agree\\", \\"agreed\\", \\"aw shucks\\", or \\"peace\\"?"
  `)
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})

test(`says it can't find something if it can't`, async () => {
  const message = await getMessage('?kif djskfjdlakfjewoifdjd')
  await kif(message)
  expect(message.channel.send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Couldn't find a kif for: \\"djskfjdlakfjewoifdjd\\""`,
  )
  expect(message.channel.send).toHaveBeenCalledTimes(1)
})
