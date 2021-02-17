const Discord = require('discord.js')
const {rest} = require('msw')
const {SnowflakeUtil, Util} = require('discord.js')
const {makeFakeClient} = require('test-utils')
const {server} = require('server')
const {getMessageLink, getMeetupChannels} = require('../../../meetup/utils')
const meetup = require('../meetup')
const {cleanup} = require('../../../meetup/cleanup')

async function setup(date) {
  jest.useFakeTimers('modern')
  jest.setSystemTime(new Date(date))
  const {
    client,
    defaultChannels,
    kody,
    marty,
    hannah,
    guild,
    createUser,
  } = await makeFakeClient()

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
  const getScheduledMeetupMessages = () =>
    Array.from(defaultChannels.scheduledMeetupsChannel.messages.cache.values())

  return {
    guild,
    getBotMessages,
    getScheduledMeetupMessages,
    kody,
    marty,
    hannah,
    botChannel: defaultChannels.talkToBotsChannel,
    scheduledMeetupsChannel: defaultChannels.scheduledMeetupsChannel,
    createMessage,
    createUser,
  }
}

test('should schedule a new meetup', async () => {
  const {
    kody,
    createMessage,
    getScheduledMeetupMessages,
    botChannel,
  } = await setup(new Date(Date.UTC(2021, 0, 20, 14)))

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  const scheduledMeetupMessages = getScheduledMeetupMessages()
  expect(scheduledMeetupMessages).toHaveLength(1)
  expect(scheduledMeetupMessages[0].content).toEqual(
    `📣 On January 20th from 3:00 PM - 8:00 PM UTC <@!${kody.id}> will be hosting a meetup about "Migrating to Tailwind". React with ✋ to be notified when the time arrives.`,
  )

  expect(botChannel.lastMessage.content).toEqual(
    `
Your meetup has been scheduled: ${getMessageLink(scheduledMeetupMessages[0])}.
To cancel, react to that message with ❌. If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )
})

test('should give an error if the message is malformed', async () => {
  const {getBotMessages, createMessage, kody} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(`?meetup schedule "Migrating to Tailwind"`, kody.user),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(
    'The command is not valid. use `?meetup help` to know more about the command.',
  )
})

test('should give an error if the message contains an invalid time', async () => {
  const {kody, createMessage, getBotMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 32th from 3:00 PM - 8:00 PM MDT`,
      kody.user,
    ),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(
    'The command is not valid. use `?meetup help` to know more about the command.',
  )
})

test('should give an error if the start time is in the past', async () => {
  const {kody, createMessage, getBotMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 19th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  const messages = getBotMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toEqual(`The scheduled time can't be in the past`)
})

test('should send a message to all users that reacted to the message and delete it then', async () => {
  const {
    guild,
    kody,
    hannah,
    marty,
    createMessage,
    getScheduledMeetupMessages,
    getBotMessages,
  } = await setup(new Date(Date.UTC(2021, 0, 20, 14)))

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 21th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )
  expect(getScheduledMeetupMessages()).toHaveLength(2)
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        return res(ctx.json([hannah.user, marty.user]))
      },
    ),
  )

  jest.advanceTimersByTime(1000 * 60 * 10)
  await cleanup(guild)
  expect(getScheduledMeetupMessages()).toHaveLength(2)

  jest.advanceTimersByTime(1000 * 60 * 70)
  await cleanup(guild)
  expect(getScheduledMeetupMessages()).toHaveLength(1)
  expect(getScheduledMeetupMessages()[0].content).toContain(
    'January 21th from 3:00 PM - 8:00 PM UTC',
  )
  const botMessages = getBotMessages()
  expect(botMessages[botMessages.length - 1].content).toBe(
    `${kody.user} is live! Notifying: ${hannah.user} and ${marty.user}`,
  )
})

test('should delete the scheduled meetup if the host react to it with ❌', async () => {
  const {guild, kody, createMessage, getScheduledMeetupMessages} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 21th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )
  const scheduledMeetupMessages = getScheduledMeetupMessages()
  expect(scheduledMeetupMessages).toHaveLength(1)

  // The meetup should start but the host deletes the message
  jest.advanceTimersByTime(1000 * 60 * 80)
  await scheduledMeetupMessages[0].react('❌')
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        if (Util.parseEmoji(req.params.reaction).name === '❌')
          return res(ctx.json([kody.user]))
        throw Error(
          'If this API is called with ✋ there is a problem because the message should be deleted.',
        )
      },
    ),
  )

  await cleanup(guild)

  expect(getScheduledMeetupMessages()).toHaveLength(0)
})

test('should not delete the scheduled meetup if the some user react with ❌', async () => {
  const {
    guild,
    kody,
    createMessage,
    getScheduledMeetupMessages,
    createUser,
  } = await setup(new Date(Date.UTC(2021, 0, 20, 14)))

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 21th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )
  const scheduledMeetupMessages = getScheduledMeetupMessages()
  expect(scheduledMeetupMessages).toHaveLength(1)

  await scheduledMeetupMessages[0].react('❌')
  const josh = await createUser('Josh')
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        if (Util.parseEmoji(req.params.reaction).name === '❌')
          return res(ctx.json([josh.user]))
      },
    ),
  )

  await cleanup(guild)

  expect(getScheduledMeetupMessages()).toHaveLength(1)
})

test('can start a meetup right away with the start subcommand', async () => {
  const {guild, kody, createMessage} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(`?meetup start "Migrating to Tailwind"`, kody.user),
  )
  const meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(1)
  expect(meetupChannels[0].name).toMatchInlineSnapshot(
    `"🤪 Meetup: kody \\"Migrating to Tailwind\\""`,
  )
})
