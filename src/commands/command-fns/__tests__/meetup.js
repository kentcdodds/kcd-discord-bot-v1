const Discord = require('discord.js')
const {rest} = require('msw')
const {SnowflakeUtil, Util} = require('discord.js')
const {makeFakeClient} = require('test-utils')
const {server} = require('server')
const {
  getMessageLink,
  getMeetupChannels,
  getFollowMeChannel,
} = require('../../../meetup/utils')
const meetup = require('../meetup')
const {cleanup} = require('../../../meetup/cleanup')

async function setup(date) {
  if (date) {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(date))
  }
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
    followMeChannel: defaultChannels.followMeChannel,
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
    `The "Migrating to Tailwind" meetup by ${kody.user} has started! CC: ${hannah.user} and ${marty.user}`,
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

test('deletes meetup channels that are over 15 minutes old with nobody in them', async () => {
  const {guild, kody, hannah, createMessage} = await setup(
    new Date(Date.UTC(2021, 0, 20, 14)),
  )

  await meetup(
    createMessage(`?meetup start "Migrating to Tailwind"`, kody.user),
  )

  const mins = 1000 * 60
  // nobody has joined yet, and 10 minutes go by
  jest.advanceTimersByTime(mins * 10)
  await cleanup(guild)
  let meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(1)

  // people join
  const meetupChannel = meetupChannels[0]
  // we have to override the members because it's read-only and only a getter
  Object.defineProperty(meetupChannel, 'members', {
    writeable: false,
    enumerable: true,
    configurable: true,
    value: new Discord.Collection(),
  })
  meetupChannel.members.set(kody.id, kody)
  meetupChannel.members.set(hannah.id, hannah)

  // 6 minutes go by
  jest.advanceTimersByTime(mins * 6)
  await cleanup(guild)
  meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(1)

  // people leave
  meetupChannel.members.delete(kody.id)
  meetupChannel.members.delete(hannah.id)

  // cleanup should remove the channel now that it's empty and it's over 15 minutes old
  await cleanup(guild)
  meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(0)
})

test('can add yourself to the follow-me channel', async () => {
  const {kody, createMessage, followMeChannel, getBotMessages} = await setup()
  let followMeUserMessage = `I am a neat person who likes to schedule meetups`
  await meetup(
    createMessage(`?meetup follow-me ${followMeUserMessage}`, kody.user),
  )
  expect(followMeChannel.lastMessage.content).toEqual(
    `
Raise your hand ✋ to be notified whenever ${kody.user} schedules and starts meetups. Here's a bit about ${kody.user}:

> ${followMeUserMessage}
  `.trim(),
  )

  let botMessages = getBotMessages()
  expect(botMessages).toHaveLength(1)
  expect(botMessages[0].content).toContain(`I've posted a message in`)

  // can update the follow-me bio
  followMeUserMessage = `I am a super neat person who likes to schedule meetups`
  await meetup(
    createMessage(`?meetup follow-me ${followMeUserMessage}`, kody.user),
  )
  expect(followMeChannel.lastMessage.content).toEqual(
    `
Raise your hand ✋ to be notified whenever ${kody.user} schedules and starts meetups. Here's a bit about ${kody.user}:

> ${followMeUserMessage}
  `.trim(),
  )
  expect(followMeChannel.messages.cache.size).toBe(1)

  botMessages = getBotMessages()
  expect(botMessages).toHaveLength(2)
  expect(botMessages[1].content).toContain(`I've updated your message in`)
})

test('followers are notified when you schedule and start a meetup', async () => {
  const {
    guild,
    kody,
    hannah,
    marty,
    createMessage,
    getBotMessages,
    getScheduledMeetupMessages,
  } = await setup(new Date(Date.UTC(2021, 0, 20, 14)))
  await meetup(createMessage(`?meetup follow-me I am Kody`, kody.user))
  const followMeChannel = getFollowMeChannel(guild)
  const followMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(kody.id),
  )

  let scheduledMeetupMessage = null

  // marty signs up to be notified about this event
  // hannah is a follower and will be notified when it's scheduled *and* when it starts
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        if (req.params.messageId === scheduledMeetupMessage?.id) {
          return res(ctx.json([marty.user]))
        } else if (req.params.messageId === followMeMessage.id) {
          return res(ctx.json([hannah.user]))
        }
        return res(ctx.json([]))
      },
    ),
  )

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`,
      kody.user,
    ),
  )

  scheduledMeetupMessage = getScheduledMeetupMessages()[0]

  let botMessages = getBotMessages()
  expect(botMessages[botMessages.length - 1].content).toContain(
    `has scheduled a "Migrating to Tailwind" meetup for January 20th from 3:00 PM - 8:00 PM UTC! CC: ${hannah.user}`,
  )

  jest.advanceTimersByTime(1000 * 60 * 80)
  await cleanup(guild)
  botMessages = getBotMessages()
  expect(botMessages[botMessages.length - 1].content).toBe(
    `The "Migrating to Tailwind" meetup by ${kody.user} has started! CC: ${hannah.user} and ${marty.user}`,
  )
})
