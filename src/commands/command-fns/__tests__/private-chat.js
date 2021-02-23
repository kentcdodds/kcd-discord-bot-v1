const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const {makeFakeClient} = require('test-utils')
const privateChat = require('../private-chat')
const {getCategoryChannel, timeToMs} = require('../../utils')
const {cleanup} = require('../../../private-chat/cleanup')

async function createPrivateChat(mentionedUsernames = []) {
  const {
    client,
    defaultChannels,
    guild,
    sendFromUser,
    createUser,
  } = await makeFakeClient()
  const categoryPrivateChat = getCategoryChannel(guild, 'private chat')
  const sentMessageUser = await createUser('sentMessageUser')

  const mentionedUsers = (
    await Promise.all(mentionedUsernames.map(username => createUser(username)))
  ).map(guildMember => guildMember.user)

  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content: `?private-chat ${mentionedUsers
        .map(user => `<@!${user.id}>`)
        .join(' ')}`,
      author: sentMessageUser.user,
    },
    defaultChannels.talkToBotsChannel,
  )

  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, mentionedUsers, [], false),
  })

  await privateChat(message)
  const getBotsMessages = () =>
    Array.from(
      defaultChannels.talkToBotsChannel.messages.cache.values(),
    ).filter(talkToBotsChannelMessage => talkToBotsChannelMessage.author.bot)

  const privateChannels = Array.from(
    guild.channels.cache
      .filter(channel => channel.parent?.id === categoryPrivateChat.id)
      .values(),
  )

  function executeCommand(author, command, ...rest) {
    const commandMessage = sendFromUser({
      user: author,
      content: `?private-chat ${command} ${rest.join(' ')}`,
      channel: privateChannels[0],
    })
    return privateChat(commandMessage)
  }

  return {
    client,
    message,
    guild,
    getBotsMessages,
    channelMembers: [sentMessageUser, ...mentionedUsers],
    sendFromUser,
    privateChannels,
    executeCommand,
  }
}

test('should create a private chat for two users', async () => {
  const {
    channelMembers,
    getBotsMessages,
    privateChannels,
  } = await createPrivateChat(['mentionedUser'])

  expect(privateChannels).toHaveLength(1)
  const privateChannel = privateChannels[0]
  expect(privateChannel.name).toEqual(
    `😎-private-mentionedUser-sentMessageUser`,
  )
  expect(privateChannel.lastMessage).toBeDefined()
  expect(privateChannel.lastMessage.content).toEqual(
    `
Hello <@!${channelMembers[1].id}> and <@${channelMembers[0].id}> 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
`.trim(),
  )

  const botsMessages = getBotsMessages()
  expect(botsMessages).toHaveLength(1)
  expect(botsMessages[0].content).toEqual(
    `I've created <#${privateChannel.id}> for you folks to talk privately. Cheers!`,
  )
})

test('should create a private chat for more than two users', async () => {
  const {privateChannels} = await createPrivateChat([
    'mentionedUser',
    'mentionedUser2',
    'mentionedUser3',
  ])

  expect(privateChannels).toHaveLength(1)
  const privateChannel = privateChannels[0]
  expect(privateChannel.name).toEqual(
    `😎-private-mentionedUser-mentionedUser2-and-others`,
  )
})

test('should delete the private chat after 10 minutes of inactivity', async () => {
  jest.useFakeTimers('modern')
  const {
    guild,
    privateChannels,
    sendFromUser,
    channelMembers,
  } = await createPrivateChat(['mentionedUser'])
  const privateChannel = privateChannels[0]

  jest.advanceTimersByTime(1000 * 60 * 3)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(1)

  jest.advanceTimersByTime(1000 * 60 * 3)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(2)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for inactivity 🚶‍♀️`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)

  sendFromUser({user: channelMembers[0].user, channel: privateChannel})

  jest.advanceTimersByTime(1000 * 60 * 6)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for inactivity 🚶‍♀️`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for inactivity 🚶‍♀️

Goodbye 👋
    `.trim(),
  )

  expect(privateChannel.deleted).toBeTruthy()
})

test('should delete the private chat after 60 minutes', async () => {
  jest.useFakeTimers('modern')
  const {
    guild,
    channelMembers,
    sendFromUser,
    privateChannels,
  } = await createPrivateChat(['mentionedUser'])
  const privateChannel = privateChannels[0]

  jest.advanceTimersByTime(1000 * 60 * 15)
  sendFromUser({user: channelMembers[0].user, channel: privateChannel})
  jest.advanceTimersByTime(1000 * 60 * 40)
  sendFromUser({user: channelMembers[0].user, channel: privateChannel})

  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)
  jest.advanceTimersByTime(1000 * 60 * 5)

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻

Goodbye 👋
    `.trim(),
  )

  expect(privateChannel.deleted).toBeTruthy()
})

test('should not create a chat without mentioned member', async () => {
  const {getBotsMessages} = await createPrivateChat()

  const botsMessages = getBotsMessages()
  expect(botsMessages).toHaveLength(1)
  expect(botsMessages[0].content).toEqual(
    'You should mention at least one other member.',
  )
})

test('should give an error if the command not exist', async () => {
  const {
    channelMembers,
    executeCommand,
    privateChannels,
  } = await createPrivateChat(['mentionedUser'])
  const privateChannel = privateChannels[0]

  await executeCommand(channelMembers[0].user, 'not-exist')
  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage.content).toEqual(
    'The command is not available. use `?private-chat help` to know more about the available commands',
  )
})

test('should give an error trying to create a chat for the same members', async () => {
  const {message, privateChannels, getBotsMessages} = await createPrivateChat([
    'mentionedUser',
  ])
  const privateChannel = privateChannels[0]
  await privateChat(message)

  const botsMessages = getBotsMessages()
  expect(botsMessages).toHaveLength(2)
  expect(botsMessages[1].content).toEqual(
    `There is already a chat for the same members <#${privateChannel.id}>`,
  )
})

test('should give an error trying to send a command not in a private chat', async () => {
  const {
    channelMembers,
    sendFromUser,
    getBotsMessages,
  } = await createPrivateChat(['mentionedUser'])

  const userMessage = await sendFromUser({
    user: channelMembers[0].user,
    content: '?private-chat extend 10',
  })
  await privateChat(userMessage)

  const botsMessages = getBotsMessages()
  expect(botsMessages).toHaveLength(2)
  expect(botsMessages[1].content).toEqual(
    `The command extend can be used only in private chat`,
  )
})

test('should not create a private-chat with yourself', async () => {
  const {client, defaultChannels, createUser} = await makeFakeClient()
  const sentMessageUser = await createUser('sentMessageUser')
  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content: '?private-chat',
      author: sentMessageUser,
    },
    defaultChannels.talkToBotsChannel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(
      message,
      [sentMessageUser],
      [],
      false,
    ),
  })

  await privateChat(message)

  const botsMessages = Array.from(
    defaultChannels.talkToBotsChannel.messages.cache.values(),
  ).filter(talkToBotsChannelMessage => talkToBotsChannelMessage.author.bot)
  expect(botsMessages).toHaveLength(1)
  expect(botsMessages[0].content).toEqual(
    `You should mention at least one other member.`,
  )
})

test('should not extend the liftime if has been passed an invalid time', async () => {
  const {
    channelMembers,
    privateChannels,
    executeCommand,
  } = await createPrivateChat(['mentionedUser'])
  const privateChannel = privateChannels[0]

  const attempts = [
    {
      expectedCountMessages: 3,
      extendTime: 0,
    },
    {
      expectedCountMessages: 5,
      extendTime: null,
    },
    {
      expectedCountMessages: 7,
      extendTime: 'invalid',
    },
  ]

  for (const attempt of attempts) {
    // eslint-disable-next-line no-await-in-loop
    await executeCommand(channelMembers[0].user, 'extend', attempt.extendTime)

    expect(privateChannel.messages.cache.size).toEqual(
      attempt.expectedCountMessages,
    )
    expect(privateChannel.lastMessage.content).toEqual(
      'You have to pass an extended time in minutes. Example: `?private-chat extend 10`',
    )
  }
})

test('should extend the time of the private-chat', async () => {
  jest.useFakeTimers('modern')
  const {
    guild,
    channelMembers,
    sendFromUser,
    privateChannels,
    executeCommand,
  } = await createPrivateChat(['mentionedUser'])
  const privateChannel = privateChannels[0]

  const expirationDate = new Date(
    Date.now() + timeToMs.minutes(60),
  ).toUTCString()
  expect(privateChannel.topic).toEqual(
    `Private chat for mentionedUser and sentMessageUser self-destruct at ${expirationDate}`,
  )

  jest.advanceTimersByTime(1000 * 60 * 55)
  sendFromUser({user: channelMembers[0].user, channel: privateChannel})
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )

  await executeCommand(channelMembers[0].user, 'extend', '10')
  jest.advanceTimersByTime(1000 * 60 * 5)
  const extendedExpirantionDate = new Date(
    Date.now() + timeToMs.minutes(10),
  ).toUTCString()
  expect(privateChannel.topic).toEqual(
    `Private chat for sentMessageUser and mentionedUser self-destruct at ${extendedExpirantionDate}`,
  )
  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage.content).toEqual(
    `The lifetime of the channel has been extended of 10 minutes more ⏱`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(6)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻

Goodbye 👋
    `.trim(),
  )

  expect(privateChannel.deleted).toBeTruthy()
})
