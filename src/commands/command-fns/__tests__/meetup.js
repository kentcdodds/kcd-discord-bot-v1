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
  const utils = await makeFakeClient()
  const {client, defaultChannels} = utils

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
    ...utils,
    getBotMessages,
    getScheduledMeetupMessages,
    botChannel: defaultChannels.talkToBotsChannel,
    scheduledMeetupsChannel: defaultChannels.scheduledMeetupsChannel,
    followMeChannel: defaultChannels.followMeChannel,
    meetupNotificationsChannel: defaultChannels.meetupNotificationsChannel,
    createMessage,
  }
}

test('users should be able to schedule and start meetups', async () => {
  const {
    guild,
    kody,
    hannah,
    createMessage,
    reactFromUser,
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
    botChannel,
  } = await setup()

  const meetupSubject = 'Migrating to Tailwind'
  const meetupTitle = `"${meetupSubject}" on January 20th from 3:00 PM - 8:00 PM UTC`

  await meetup(createMessage(`?meetup schedule ${meetupTitle}`, kody.user))

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMeetupMessage.content).toEqual(
    `📣 <@!${kody.id}> is hosting a meetup: ${meetupTitle}. React with ✋ to be notified when it starts.`,
  )

  expect(botChannel.lastMessage.content).toEqual(
    `
Your meetup has been scheduled: ${getMessageLink(
      scheduledMeetupMessage,
    )}. You can control the meetup by reacting to that message with the following emoji:

- 🏁 to start the meetup and notify everyone it's begun.
- ❌ to cancel the meetup and notify everyone it's been canceled.
- 🛑 to cancel the meetup and NOT notify everyone it's been canceled.

If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )

  // add some reactions
  reactFromUser({
    user: hannah,
    message: scheduledMeetupMessage,
    emoji: {name: '✋'},
  })
  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })

  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        const emoji = Util.parseEmoji(req.params.reaction).name
        if (req.params.messageId === scheduledMeetupMessage.id) {
          if (emoji === '🏁') {
            return res(ctx.json([kody.user]))
          }
          if (emoji === '✋') {
            return res(ctx.json([hannah.user]))
          }
        }
        return res(ctx.json([]))
      },
    ),
  )

  // run cleanup to get things started
  await cleanup(guild)

  // the message is deleted
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(0)
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup: ${meetupSubject}.

CC: ${hannah}
    `.trim(),
  )
})

test('users can schedule recurring meetups', async () => {
  const {
    guild,
    kody,
    hannah,
    createMessage,
    reactFromUser,
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
    botChannel,
  } = await setup()

  const meetupSubject = 'Migrating to Tailwind'
  const meetupTitle = `"${meetupSubject}" on January 20th from 3:00 PM - 8:00 PM UTC`

  await meetup(
    createMessage(`?meetup schedule recurring ${meetupTitle}`, kody.user),
  )

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMeetupMessage.content).toEqual(
    `📣 <@!${kody.id}> is hosting a recurring meetup: ${meetupTitle}. React with ✋ to be notified when it starts.`,
  )

  expect(botChannel.lastMessage.content).toEqual(
    `
Your recurring meetup has been scheduled: ${getMessageLink(
      scheduledMeetupMessage,
    )}. You can control the meetup by reacting to that message with the following emoji:

- 🏁 to start the meetup and notify everyone it's begun.
- ❌ to cancel the meetup and notify everyone it's been canceled.
- 🛑 to cancel the meetup and NOT notify everyone it's been canceled.

If you want to reschedule, then cancel the old one and schedule a new meetup.
`.trim(),
  )

  // add some reactions
  reactFromUser({
    user: hannah,
    message: scheduledMeetupMessage,
    emoji: {name: '✋'},
  })
  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })

  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        const emoji = Util.parseEmoji(req.params.reaction).name
        if (req.params.messageId === scheduledMeetupMessage.id) {
          if (emoji === '🏁') {
            return res(ctx.json([kody.user]))
          }
          if (emoji === '✋') {
            return res(ctx.json([hannah.user]))
          }
        }
        return res(ctx.json([]))
      },
    ),
  )

  // run cleanup to get things started
  await cleanup(guild)

  // the message is not deleted
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  // the 🏁 reaction is removed
  // TODO: need to improve our mocking of emoji reactions...
  // expect(
  //   scheduledMeetupsChannel.lastMessage.reactions.cache.get('🏁'),
  // ).toBeNull()
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup: ${meetupSubject}.

CC: ${hannah}
    `.trim(),
  )
})

test('should give an error if no subject is specified', async () => {
  const {botChannel, createMessage, kody} = await setup()

  await meetup(createMessage(`?meetup schedule No quotes here`, kody.user))

  expect(botChannel.messages.cache.size).toBe(1)
  expect(botChannel.lastMessage.content).toEqual(
    'Make sure to include the subject of your meetup in quotes. Send `?meetup help` for more info.',
  )
})

test('should delete the scheduled meetup if the host react to it with ❌', async () => {
  const {
    guild,
    kody,
    createMessage,
    reactFromUser,
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
  } = await setup()

  await meetup(createMessage(`?meetup schedule "Test meetup"`, kody.user))

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '❌'},
  })

  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        const emoji = Util.parseEmoji(req.params.reaction).name
        if (
          req.params.messageId === scheduledMeetupMessage.id &&
          emoji === '❌'
        ) {
          return res(ctx.json([kody.user]))
        }
        return res(ctx.json([]))
      },
    ),
  )

  await cleanup(guild)

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(0)
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `${kody} has canceled the meetup: Test meetup.`,
  )
})

test('should not delete the scheduled meetup if the some user react with ❌', async () => {
  const {
    guild,
    kody,
    createMessage,
    scheduledMeetupsChannel,
    createUser,
    reactFromUser,
  } = await setup()

  await meetup(createMessage(`?meetup schedule "Test meetup"`, kody.user))
  const scheduledMessage = scheduledMeetupsChannel.lastMessage

  const josh = await createUser('Josh')
  reactFromUser({user: josh, message: scheduledMessage, emoji: {name: '❌'}})
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

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
})

test('can start a meetup right away with the start subcommand', async () => {
  const {guild, kody, createMessage} = await setup()

  await meetup(createMessage(`?meetup start Migrating to Tailwind`, kody.user))
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

  await meetup(createMessage(`?meetup start Migrating to Tailwind`, kody.user))

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
  const {
    kody,
    createMessage,
    followMeChannel,
    getBotMessages,
    guild,
    reactFromUser,
  } = await setup()
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
  const botFollowMeMessage = followMeChannel.lastMessage
  expect(botFollowMeMessage.content).toEqual(
    `
Raise your hand ✋ to be notified whenever ${kody.user} schedules and starts meetups. Here's a bit about ${kody.user}:

> ${followMeUserMessage}
  `.trim(),
  )
  expect(followMeChannel.messages.cache.size).toBe(1)

  botMessages = getBotMessages()
  expect(botMessages).toHaveLength(2)
  expect(botMessages[1].content).toContain(`I've updated your message in`)

  // kody wants to delete the follow-me message so kody reacts with ❌
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        const emoji = Util.parseEmoji(req.params.reaction).name
        if (req.params.messageId === botFollowMeMessage.id && emoji === '❌') {
          return res(ctx.json([kody.user]))
        }
        return res(ctx.json([]))
      },
    ),
  )
  reactFromUser({user: kody, message: botFollowMeMessage, emoji: {name: '❌'}})
  await cleanup(guild)
  expect(followMeChannel.messages.cache.size).toBe(0)
})

test('followers are notified when you schedule and start a meetup', async () => {
  const {
    guild,
    kody,
    hannah,
    marty,
    createMessage,
    getScheduledMeetupMessages,
    meetupNotificationsChannel,
    reactFromUser,
  } = await setup()
  await meetup(createMessage(`?meetup follow-me I am Kody`, kody.user))
  const followMeChannel = getFollowMeChannel(guild)
  const followMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(kody.id),
  )

  let scheduledMeetupMessage = null

  reactFromUser({
    user: hannah,
    message: followMeMessage,
    emoji: {name: '✋'},
  })

  let started = false

  // marty signs up to be notified about this event
  // hannah is a follower and will be notified when it's scheduled *and* when it starts
  server.use(
    rest.get(
      '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
      (req, res, ctx) => {
        const emoji = Util.parseEmoji(req.params.reaction).name
        if (emoji === '✋') {
          if (req.params.messageId === scheduledMeetupMessage?.id) {
            return res(ctx.json([marty.user]))
          } else if (req.params.messageId === followMeMessage.id) {
            return res(ctx.json([hannah.user]))
          }
        } else if (emoji === '🏁' && started) {
          return res(ctx.json([kody.user]))
        }
        return res(ctx.json([]))
      },
    ),
  )

  await meetup(
    createMessage(`?meetup schedule "Migrating to Tailwind"`, kody.user),
  )

  scheduledMeetupMessage = getScheduledMeetupMessages()[0]

  reactFromUser({
    user: marty,
    message: scheduledMeetupMessage,
    emoji: {name: '✋'},
  })

  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
${kody} has scheduled a meetup: "Migrating to Tailwind"!

CC: ${hannah}

I will notify you when ${kody} starts the meetup.
    `.trim(),
  )

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })
  started = true

  await cleanup(guild)
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup: Migrating to Tailwind.

CC: ${hannah} and ${marty}
    `.trim(),
  )
})

test('if the meetup command includes a zoom link, that is shared instead of creating a voice channel', async () => {
  const {guild, kody, createMessage} = await setup()

  await meetup(
    createMessage(
      `?meetup start Migrating to Tailwind https://egghead.zoom.us/j/97341329204?pwd=MTRPc1p4Uit4K2ZpVjNDSWFxNTRlUT09`,
      kody.user,
    ),
  )
  const meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(0)
})
