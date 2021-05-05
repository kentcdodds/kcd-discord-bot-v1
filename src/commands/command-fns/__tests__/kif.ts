import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {makeFakeClient} from 'test-utils'
import {kif} from '../kif'

async function setup(content: string) {
  const {
    client,
    defaultChannels: {talkToBotsChannel},
    kody,
  } = await makeFakeClient()
  return sendCommand({
    content,
    author: kody.user,
    client,
    channel: talkToBotsChannel,
    talkToBotsChannel,
  })
}

async function sendCommand({
  client,
  content,
  author,
  talkToBotsChannel,
  channel = talkToBotsChannel,
}: {
  author?: TDiscord.User
  content: string
  client: TDiscord.Client
  talkToBotsChannel: TDiscord.TextChannel
  channel?: TDiscord.TextChannel
}) {
  const message = new Discord.Message(
    client,
    {id: SnowflakeUtil.generate(), content, author},
    channel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, [], [], false),
  })
  await kif(message)

  const reply = talkToBotsChannel.lastMessage
  if (!reply || talkToBotsChannel.messages.cache.size !== 1) {
    throw new Error(`The bot didn't send only a single reply`)
  }

  return {reply}
}

test('sends a gif', async () => {
  const {reply} = await setup('?kif hi')

  expect(reply.content).toMatchInlineSnapshot(`
    From: kody
    https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V
  `)
})

test('suggests similar item', async () => {
  const {reply} = await setup('?kif peace fail')

  expect(reply.content).toMatchInlineSnapshot(`
    Did you mean "peace fall"?
    From: kody
    https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n
  `)
})

test('should use username in the from if nickname is not defined', async () => {
  const {
    client,
    defaultChannels: {talkToBotsChannel},
    createUser,
  } = await makeFakeClient()
  const userWithOnlyUsername = await createUser('', {
    username: 'userWithOnlyUsername',
  })
  const {reply} = await sendCommand({
    content: '?kif peace fail',
    author: userWithOnlyUsername.user,
    client,
    channel: talkToBotsChannel,
    talkToBotsChannel,
  })

  expect(reply.content).toMatchInlineSnapshot(`
    Did you mean "peace fall"?
    From: userWithOnlyUsername
    https://giphy.com/gifs/fall-peace-kentcdodds-U3nGECxxmHugNeAm6n
  `)
})

test('suggests two items', async () => {
  const {reply} = await setup('?kif peac')

  expect(reply.content).toMatchInlineSnapshot(`
    Couldn't find a kif for: "peac"

    Did you mean "peace" or "peace fall"?

    _This message will self-destruct in about 10 seconds_
  `)
})

test('suggests several items (but no more than 6)', async () => {
  const {reply} = await setup('?kif a')

  expect(reply.content).toMatchInlineSnapshot(`
    Couldn't find a kif for: "a"

    Did you mean "aw", "adorable", "agree", "agreed", "aw shucks", or "peace"?

    _This message will self-destruct in about 10 seconds_
  `)
})

test(`says it can't find something if it can't`, async () => {
  const {reply} = await setup('?kif djskfjdlakfjewoifdjd')

  expect(reply.content).toMatchInlineSnapshot(`
    Couldn't find a kif for: "djskfjdlakfjewoifdjd"

    _This message will self-destruct in about 10 seconds_
  `)
})
