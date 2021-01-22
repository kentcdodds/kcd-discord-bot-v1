const Discord = require('discord.js')
const {rest} = require('msw')
const {SnowflakeUtil} = require('discord.js')
const {makeFakeClient} = require('test-utils')
const {server} = require('server')
const scheduleStream = require('../schedule-stream')
const {cleanup} = require('../../../schedule-stream/cleanup')

async function setup(date) {
  jest.useFakeTimers('modern')
  jest.setSystemTime(new Date(date))
  const {client, defaultChannels, kody, guild} = await makeFakeClient()

  const createMessage = (content, user) => {
    return new Discord.Message(
      client,
      {
        id: SnowflakeUtil.generate(),
        content,
        author: user,
      },
      defaultChannels.talkToBotsChannel,
    )
  }

  const getBotMessages = () =>
    Array.from(defaultChannels.talkToBotsChannel.messages.cache.values())
  const getStreamerMessages = () =>
    Array.from(defaultChannels.streamerChannel.messages.cache.values())

  return {
    guild,
    getBotMessages,
    getStreamerMessages,
    kody,
    botChannel: defaultChannels.talkToBotsChannel,
    streamerChannel: defaultChannels.streamerChannel,
    createMessage,
  }
}

test('should schedule a new stream', async () => {
  const {kody, createMessage, getStreamerMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await scheduleStream(
    createMessage(
      `?schedule-stream "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )
  const messages = getStreamerMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(
    `📣 On January 20th from 3:00 PM - 8:00 PM UTC <@!${kody.id}> will be live streaming "Migrating to Tailwind". React with ✋ to be notified when the time arrives.`,
  )
})

test('should give an error if the message is malformed', async () => {
  const {getBotMessages, createMessage, kody} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await scheduleStream(
    createMessage(`?schedule-stream "Migrating to Tailwind"`, kody.user),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(
    'The command is not valid. use `?schedule-stream help` to know more about the command.',
  )
})

test('should give an error if the message contains an invalid time', async () => {
  const {kody, createMessage, getBotMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await scheduleStream(
    createMessage(
      `?schedule-stream "Migrating to Tailwind" on January 32th from 3:00 PM - 8:00 PM MDT`,
      kody.user,
    ),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(
    'The command is not valid. use `?schedule-stream help` to know more about the command.',
  )
})

test('should give an error if the start time is in the past', async () => {
  const {kody, createMessage, getBotMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await scheduleStream(
    createMessage(
      `?schedule-stream "Migrating to Tailwind" on January 19th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(`The scheduled time can't be in the past`)
})

test('should send a message to all users that reacted to the message and delete it then', async () => {
  const {guild, kody, createMessage, getStreamerMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await scheduleStream(
    createMessage(
      `?schedule-stream "Migrating to Tailwind" on January 21th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  await scheduleStream(
    createMessage(
      `?schedule-stream "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )
  expect(getStreamerMessages()).toHaveLength(2)
  let dmMessage = ''
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        return res(ctx.json([kody.user]))
      },
    ),
    rest.post(
      '*/api/:apiVersion/channels/:channelId/messages',
      (req, res, ctx) => {
        dmMessage = req.body.content
        return res(ctx.status(201), ctx.json({}))
      },
    ),
  )

  jest.advanceTimersByTime(1000 * 60 * 10)
  await cleanup(guild)
  expect(getStreamerMessages()).toHaveLength(2)

  jest.advanceTimersByTime(1000 * 60 * 70)
  await cleanup(guild)
  expect(getStreamerMessages()).toHaveLength(1)
  expect(getStreamerMessages()[0].content).toContain(
    'January 21th from 3:00 PM - 8:00 PM UTC',
  )
  expect(dmMessage).toEqual(`Hey, <@${kody.id}> is going to stream!!`)
})
