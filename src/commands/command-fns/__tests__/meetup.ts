import assert from 'assert'
import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {makeFakeClient} from 'test-utils'
import {
  getMessageLink,
  getMeetupChannels,
  getFollowMeChannel,
} from '../../../meetup/utils'
import {meetup} from '../meetup'
import {cleanup} from '../../../meetup/cleanup'

async function setup(date?: Date) {
  if (date) {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(date))
  }
  const utils = await makeFakeClient()
  const {client, defaultChannels} = utils

  const createMessage = (
    content: string,
    user: TDiscord.User | TDiscord.GuildMember,
  ) => {
    return new Discord.Message(
      client,
      {id: SnowflakeUtil.generate(), content, author: user},
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

  const meetupDetails = `"Migrating to Tailwind" on January 20th from 3:00 PM - 8:00 PM UTC`

  await meetup(createMessage(`?meetup schedule ${meetupDetails}`, kody.user))

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMeetupMessage.content).toBe(
    `
📣 <@!${kody.id}> is hosting a meetup:

${meetupDetails}

React with ✋ to be notified when it starts.
    `.trim(),
  )

  const scheduledLink = getMessageLink(scheduledMeetupMessage)

  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toBe(
    `
Your meetup has been scheduled: <${scheduledLink}>. You can control the meetup by reacting to that message with the following emoji:

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

  // run cleanup to get things started
  await cleanup(guild)

  // the message is deleted
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(0)

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup:

${meetupDetails}

CC: ${hannah}
    `.trim(),
  )
})

test('there is a limit on the length of the meetup details', async () => {
  const {
    kody,
    createMessage,
    scheduledMeetupsChannel,
    botChannel,
  } = await setup()

  const meetupDetails = `"Migrating to Tailwind" ${'-'.repeat(850)}`

  await meetup(createMessage(`?meetup schedule ${meetupDetails}`, kody.user))

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(0)
  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toMatchInlineSnapshot(
    `Meetup details are limited to 800 characters and your details are 874 characters. If you need to, put extra details somewhere online and link to it.`,
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
  const meetupDetails = `"${meetupSubject}" on January 20th from 3:00 PM - 8:00 PM UTC`

  await meetup(
    createMessage(`?meetup schedule recurring ${meetupDetails}`, kody.user),
  )

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMeetupMessage.content).toBe(
    `
📣 <@!${kody.id}> is hosting a recurring meetup:

${meetupDetails}

React with ✋ to be notified when it starts.
    `.trim(),
  )

  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toEqual(
    `
Your recurring meetup has been scheduled: <${getMessageLink(
      scheduledMeetupMessage,
    )}>. You can control the meetup by reacting to that message with the following emoji:

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

  // run cleanup to get things started
  await cleanup(guild)

  // the message is not deleted
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  assert(
    scheduledMeetupsChannel.lastMessage,
    'Bot removed the schedule message',
  )
  // the 🏁 reaction is removed
  expect(
    scheduledMeetupsChannel.lastMessage.reactions.cache.get('🏁'),
  ).toBeFalsy()

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup:

${meetupDetails}

CC: ${hannah}
    `.trim(),
  )
})

test('should give an error if no subject is specified', async () => {
  const {botChannel, createMessage, kody} = await setup()

  await meetup(createMessage(`?meetup schedule No quotes here`, kody.user))

  expect(botChannel.messages.cache.size).toBe(1)
  assert(botChannel.lastMessage, 'Bot did not reply')
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
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '❌'},
  })

  await cleanup(guild)

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(0)

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
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
  assert(scheduledMessage, 'No scheduled meetup message was sent')

  const josh = await createUser('Josh')
  reactFromUser({user: josh, message: scheduledMessage, emoji: {name: '❌'}})

  await cleanup(guild)

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
})

test('can start a meetup right away with the start subcommand', async () => {
  const {guild, kody, createMessage} = await setup()

  await meetup(createMessage(`?meetup start Migrating to Tailwind`, kody.user))
  const meetupChannels = Array.from(getMeetupChannels(guild).values())
  expect(meetupChannels).toHaveLength(1)
  expect(meetupChannels[0]?.name).toMatchInlineSnapshot(
    `🤪 Meetup: kody "Migrating to Tailwind"`,
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
  assert(meetupChannel, 'Meetup channel does not exist')
  // we have to override the members because it's read-only and only a getter
  Object.defineProperty(meetupChannel, 'members', {
    // writeable: false,
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
    botChannel,
    guild,
    reactFromUser,
  } = await setup()
  let followMeUserMessage = `I am a neat person who likes to schedule meetups`
  await meetup(
    createMessage(`?meetup follow-me ${followMeUserMessage}`, kody.user),
  )
  assert(followMeChannel.lastMessage, 'Bot did not add follow me message')
  expect(followMeChannel.lastMessage.content).toEqual(
    `
Raise your hand ✋ to be notified whenever ${kody.user} schedules and starts meetups. Here's a bit about ${kody.user}:

> ${followMeUserMessage}
  `.trim(),
  )

  expect(botChannel.messages.cache.size).toBe(1)
  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toContain(`I've posted a message in`)

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

  expect(botChannel.messages.cache.size).toBe(2)
  expect(botChannel.lastMessage.content).toContain(
    `I've updated your message in`,
  )

  // kody wants to delete the follow-me message so kody reacts with ❌
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
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
    reactFromUser,
  } = await setup()
  await meetup(createMessage(`?meetup follow-me I am Kody`, kody.user))
  const followMeChannel = getFollowMeChannel(guild)
  assert(followMeChannel, 'Cannot get follow-me channel from the guild')
  const followMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(kody.id),
  )

  // hannah is a follower and will be notified when it's scheduled *and* when it starts
  reactFromUser({
    user: hannah,
    message: followMeMessage,
    emoji: {name: '✋'},
  })

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" https://example.com/url`,
      kody.user,
    ),
  )

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  // marty signs up to be notified about this event
  reactFromUser({
    user: marty,
    message: scheduledMeetupMessage,
    emoji: {name: '✋'},
  })

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
📣 ${kody} has scheduled a meetup:

"Migrating to Tailwind" https://example.com/url

I will notify you when ${kody} starts the meetup.

CC: ${hannah}
    `.trim(),
  )

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })

  await cleanup(guild)

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup:

"Migrating to Tailwind" https://example.com/url

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

test('can use "TESTING" in the subject to test things out and not notify anyone', async () => {
  const {
    guild,
    kody,
    hannah,
    marty,
    createMessage,
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
    reactFromUser,
  } = await setup()
  await meetup(createMessage(`?meetup follow-me I am Kody`, kody.user))
  const followMeChannel = getFollowMeChannel(guild)
  assert(followMeChannel, 'Cannot get follow-me channel from the guild')
  const followMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(kody.id),
  )

  // hannah is a follower and will be notified when it's scheduled *and* when it starts
  reactFromUser({
    user: hannah,
    message: followMeMessage,
    emoji: {name: '✋'},
  })

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind TESTING" https://example.com/url`,
      kody.user,
    ),
  )

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  // marty signs up to be notified about this event
  reactFromUser({
    user: marty,
    message: scheduledMeetupMessage,
    emoji: {name: '✋'},
  })

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
📣 ${kody} has scheduled a meetup:

"Migrating to Tailwind TESTING" https://example.com/url

I will notify you when ${kody} starts the meetup.

CC: ${hannah.displayName}
    `.trim(),
  )

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })

  await cleanup(guild)

  assert(meetupNotificationsChannel.lastMessage, 'Bot did not notify')
  expect(meetupNotificationsChannel.lastMessage.content).toBe(
    `
🏁 ${kody} has started the meetup:

"Migrating to Tailwind TESTING" https://example.com/url

CC: ${hannah.displayName} and ${marty.displayName}
    `.trim(),
  )
})

test('users can update scheduled meetups', async () => {
  const {scheduledMeetupsChannel, kody, createMessage} = await setup()

  await meetup(
    createMessage(`?meetup schedule "Migrating to Tailwind"`, kody.user),
  )
  const scheduledMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMessage, 'No scheduled meetup message was sent')

  await meetup(
    createMessage(
      `?meetup update <${getMessageLink(
        scheduledMessage,
      )}> "Migrating to Tailwind" more useful info`,
      kody.user,
    ),
  )
  // did not create a new message, just updated the old one
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMessage).toBe(scheduledMeetupsChannel.lastMessage)
  expect(scheduledMessage.content).toBe(
    `
📣 ${kody} is hosting a meetup:

"Migrating to Tailwind" more useful info

React with ✋ to be notified when it starts.
    `.trim(),
  )
})

test('users can update scheduled recurring meetups', async () => {
  const {scheduledMeetupsChannel, kody, createMessage} = await setup()

  await meetup(
    createMessage(
      `?meetup schedule recurring "Migrating to Tailwind"`,
      kody.user,
    ),
  )
  const scheduledMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMessage, 'No scheduled meetup message was sent')

  await meetup(
    createMessage(
      `?meetup update <${getMessageLink(
        scheduledMessage,
      )}> recurring "Migrating to Tailwind" more useful info`,
      kody.user,
    ),
  )

  // did not create a new message, just updated the old one
  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(scheduledMessage).toBe(scheduledMeetupsChannel.lastMessage)
  expect(scheduledMessage.content).toBe(
    `
📣 ${kody} is hosting a recurring meetup:

"Migrating to Tailwind" more useful info

React with ✋ to be notified when it starts.
    `.trim(),
  )
})

test(`users can't update a recurring meetup to a one-time meetup without force-update`, async () => {
  const {
    scheduledMeetupsChannel,
    kody,
    createMessage,
    botChannel,
  } = await setup()

  const isRecurring = (msg: string) => msg.includes('recurring')

  await meetup(
    createMessage(
      `?meetup schedule recurring "Migrating to Tailwind"`,
      kody.user,
    ),
  )
  const scheduledMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMessage, 'No scheduled meetup message was sent')
  let lastContent = scheduledMessage.content
  expect(isRecurring(lastContent)).toBe(true)

  await meetup(
    createMessage(
      `?meetup update <${getMessageLink(
        scheduledMessage,
      )}> "Migrating to Tailwind"`,
      kody.user,
    ),
  )

  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toMatchInlineSnapshot(
    `The original meetup was recurring, but you're updating it to not be recurring. This is a common mistake. If you're sure this is the change you want, use \`?meetup force-update\` rather than \`?meetup update\``,
  )
  // no change to the scheduled meetup message
  assert(scheduledMeetupsChannel.lastMessage, 'No schedule meetup lastMessage')
  expect(scheduledMeetupsChannel.lastMessage.content).toBe(lastContent)
  expect(isRecurring(lastContent)).toBe(true)

  // force the update
  await meetup(
    createMessage(
      `?meetup force-update <${getMessageLink(
        scheduledMessage,
      )}> "Migrating to Tailwind"`,
      kody.user,
    ),
  )
  // update happened
  expect(scheduledMeetupsChannel.lastMessage.content).not.toBe(lastContent)
  lastContent = scheduledMeetupsChannel.lastMessage.content
  expect(isRecurring(lastContent)).toBe(false)

  // try to change to recurring without force
  await meetup(
    createMessage(
      `?meetup update <${getMessageLink(
        scheduledMessage,
      )}> recurring "Migrating to Tailwind"`,
      kody.user,
    ),
  )
  // no change to the scheduled meetup message
  expect(scheduledMeetupsChannel.lastMessage.content).toBe(lastContent)
  expect(isRecurring(lastContent)).toBe(false)

  assert(botChannel.lastMessage, 'Bot did not reply')
  expect(botChannel.lastMessage.content).toMatchInlineSnapshot(
    `The original meetup was not recurring, but you're updating it to be recurring. This is a common mistake. If you're sure this is the change you want, use \`?meetup force-update\` rather than \`?meetup update\``,
  )
  // try to change to recurring with force
  await meetup(
    createMessage(
      `?meetup force-update <${getMessageLink(
        scheduledMessage,
      )}> recurring "Migrating to Tailwind"`,
      kody.user,
    ),
  )
  // update happened
  expect(scheduledMeetupsChannel.lastMessage.content).not.toBe(lastContent)
  lastContent = scheduledMeetupsChannel.lastMessage.content
  expect(isRecurring(lastContent)).toBe(true)
})

test('long messages are split automatically so every user sees the notification', async () => {
  const {
    guild,
    kody,
    createMessage,
    createUser,
    scheduledMeetupsChannel,
    meetupNotificationsChannel,
    reactFromUser,
  } = await setup()
  await meetup(createMessage(`?meetup follow-me I am Kody`, kody.user))
  const followMeChannel = getFollowMeChannel(guild)
  assert(followMeChannel, 'Cannot get follow-me channel from the guild')
  const followMeMessage = followMeChannel.messages.cache.find(msg =>
    msg.content.includes(kody.id),
  )

  const users = await Promise.all(
    Array.from({length: 100}, index => createUser(`test-user-${index}`)),
  )
  for (const user of users) {
    reactFromUser({user, message: followMeMessage, emoji: {name: '✋'}})
  }

  await meetup(
    createMessage(
      `?meetup schedule "Migrating to Tailwind" https://example.com/url\n${'-'.repeat(
        400,
      )}`,
      kody.user,
    ),
  )

  const scheduledMeetupMessage = scheduledMeetupsChannel.lastMessage
  assert(scheduledMeetupMessage, 'Bot did not post a scheduled meetup message')

  expect(scheduledMeetupsChannel.messages.cache.size).toBe(1)
  expect(meetupNotificationsChannel.messages.cache.size).toBe(2)

  reactFromUser({
    user: kody,
    message: scheduledMeetupMessage,
    emoji: {name: '🏁'},
  })

  await cleanup(guild)
  expect(meetupNotificationsChannel.messages.cache.size).toBe(4)
})
