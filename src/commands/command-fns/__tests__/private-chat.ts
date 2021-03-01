import assert from 'assert'
import type * as TDiscord from 'discord.js'
import Discord, {SnowflakeUtil} from 'discord.js'
import {makeFakeClient} from 'test-utils'
import {privateChat} from '../private-chat'
import {getCategoryChannel, timeToMs, typedBoolean} from '../../utils'
import {cleanup} from '../../../private-chat/cleanup'

async function createPrivateChat(mentionedUsernames: Array<string> = []) {
  const {
    client,
    defaultChannels,
    guild,
    sendFromUser,
    createUser,
  } = await makeFakeClient()
  const categoryPrivateChat = getCategoryChannel(guild, 'private chat')
  assert(categoryPrivateChat, 'Private chat category does not exist')
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

  const privateChannels = Array.from(
    guild.channels.cache
      .filter(channel => channel.parent?.id === categoryPrivateChat.id)
      .values(),
  ) as Array<TDiscord.TextChannel>

  assert.strictEqual(
    privateChannels.length,
    1,
    'There are too many private channels',
  )

  const [privateChannel] = privateChannels
  assert(privateChannel, 'no private channels exist')
  const lastMessage = privateChannel.lastMessage
  assert(lastMessage, 'The bot did not send a message in the private channel')
  const botReply = defaultChannels.talkToBotsChannel.lastMessage
  assert(botReply, 'No bot reply')

  function executeCommand(
    author: TDiscord.GuildMember,
    command: string,
    ...rest: Array<string>
  ) {
    const commandMessage = sendFromUser({
      user: author,
      content: `?private-chat ${command} ${rest.join(' ')}`,
      channel: privateChannel,
    })
    return privateChat(commandMessage)
  }

  return {
    client,
    message,
    guild,
    channelHost: sentMessageUser,
    channelGuests: mentionedUsers
      .map(({id}) => guild.members.cache.find(mem => mem.id === id))
      .filter(typedBoolean),
    sendFromUser,
    privateChannels,
    privateChannel,
    lastMessage,
    botReply,
    botChannel: defaultChannels.talkToBotsChannel,
    executeCommand,
  }
}

test('should create a private chat for two users', async () => {
  const {
    channelHost,
    channelGuests,
    privateChannel,
    lastMessage,
    botReply,
  } = await createPrivateChat(['mentionedUser'])

  expect(privateChannel.name).toEqual(
    `😎-private-mentionedUser-sentMessageUser`,
  )
  expect(lastMessage.content).toEqual(
    `
Hello <@!${channelGuests[0]?.id}> and <@!${channelHost.id}> 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
`.trim(),
  )

  expect(botReply.content).toEqual(
    `I've created <#${privateChannel.id}> for you folks to talk privately. Cheers!`,
  )
})

test('should create a private chat for more than two users', async () => {
  const {privateChannel} = await createPrivateChat([
    'mentionedUser',
    'mentionedUser2',
    'mentionedUser3',
  ])

  expect(privateChannel.name).toEqual(
    `😎-private-mentionedUser-mentionedUser2-and-others`,
  )
})

test('should delete the private chat after 10 minutes of inactivity', async () => {
  jest.useFakeTimers('modern')
  const {
    guild,
    privateChannel,
    sendFromUser,
    channelHost,
  } = await createPrivateChat(['mentionedUser'])

  jest.advanceTimersByTime(1000 * 60 * 3)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(1)

  jest.advanceTimersByTime(1000 * 60 * 3)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(2)
  expect(privateChannel.lastMessage?.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for inactivity 🚶‍♀️`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)

  sendFromUser({user: channelHost, channel: privateChannel})

  jest.advanceTimersByTime(1000 * 60 * 6)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage?.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for inactivity 🚶‍♀️`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage?.content).toEqual(
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
    channelHost,
    sendFromUser,
    privateChannel,
  } = await createPrivateChat(['mentionedUser'])

  jest.advanceTimersByTime(1000 * 60 * 15)
  sendFromUser({user: channelHost, channel: privateChannel})
  jest.advanceTimersByTime(1000 * 60 * 40)
  sendFromUser({user: channelHost, channel: privateChannel})

  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage?.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)
  jest.advanceTimersByTime(1000 * 60 * 5)

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage?.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻

Goodbye 👋
    `.trim(),
  )

  expect(privateChannel.deleted).toBeTruthy()
})

test('should not create a chat without mentioned member', async () => {
  const {client, defaultChannels, createUser} = await makeFakeClient()
  const sentMessageUser = await createUser('sentMessageUser')

  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content: `?private-chat`,
      author: sentMessageUser.user,
    },
    defaultChannels.talkToBotsChannel,
  )

  await privateChat(message)

  expect(defaultChannels.talkToBotsChannel.lastMessage?.content).toEqual(
    'You should mention at least one other member.',
  )
})

test('should give an error if the command not exist', async () => {
  const {
    channelHost,
    executeCommand,
    privateChannel,
  } = await createPrivateChat(['mentionedUser'])

  await executeCommand(channelHost, 'not-exist')
  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage?.content).toEqual(
    'The command is not available. use `?private-chat help` to know more about the available commands',
  )
})

test('should give an error trying to create a chat for the same members', async () => {
  const {message, privateChannel, botChannel} = await createPrivateChat([
    'mentionedUser',
  ])
  await privateChat(message)

  expect(botChannel.lastMessage?.content).toEqual(
    `There is already a chat for the same members <#${privateChannel.id}>`,
  )
})

test('should give an error trying to send a command not in a private chat', async () => {
  const {channelHost, sendFromUser, botChannel} = await createPrivateChat([
    'mentionedUser',
  ])

  const userMessage = sendFromUser({
    user: channelHost,
    content: '?private-chat extend 10',
  })
  await privateChat(userMessage)

  expect(botChannel.messages.cache.size).toBe(3)
  expect(botChannel.lastMessage?.content).toEqual(
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

  expect(defaultChannels.talkToBotsChannel.lastMessage?.content).toEqual(
    `You should mention at least one other member.`,
  )
})

test('should not extend the liftime if has been passed an invalid time', async () => {
  const {
    channelHost,
    privateChannel,
    executeCommand,
  } = await createPrivateChat(['mentionedUser'])

  const attempts = [
    {
      expectedCountMessages: 3,
      extendTime: '0',
    },
    {
      expectedCountMessages: 5,
      extendTime: '',
    },
    {
      expectedCountMessages: 7,
      extendTime: 'invalid',
    },
  ]

  for (const attempt of attempts) {
    // eslint-disable-next-line no-await-in-loop
    await executeCommand(channelHost, 'extend', attempt.extendTime)

    expect(privateChannel.messages.cache.size).toEqual(
      attempt.expectedCountMessages,
    )
    expect(privateChannel.lastMessage?.content).toEqual(
      'You have to pass an extended time in minutes. Example: `?private-chat extend 10`',
    )
  }
})

test('should extend the time of the private-chat', async () => {
  jest.useFakeTimers('modern')
  const {
    guild,
    channelHost,
    sendFromUser,
    privateChannel,
    executeCommand,
  } = await createPrivateChat(['mentionedUser'])

  const expirationDate = new Date(
    Date.now() + timeToMs.minutes(60),
  ).toUTCString()
  expect(privateChannel.topic).toEqual(
    `Private chat for mentionedUser and sentMessageUser self-destruct at ${expirationDate}`,
  )

  jest.advanceTimersByTime(1000 * 60 * 55)
  sendFromUser({user: channelHost, channel: privateChannel})
  await cleanup(guild)

  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage?.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )

  await executeCommand(channelHost, 'extend', '10')
  jest.advanceTimersByTime(1000 * 60 * 5)
  const extendedExpirantionDate = new Date(
    Date.now() + timeToMs.minutes(10),
  ).toUTCString()
  expect(privateChannel.topic).toEqual(
    `Private chat for sentMessageUser and mentionedUser self-destruct at ${extendedExpirantionDate}`,
  )
  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage?.content).toEqual(
    `The lifetime of the channel has been extended of 10 minutes more ⏱`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage?.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )

  jest.advanceTimersByTime(1000 * 60 * 5)
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(6)
  expect(privateChannel.lastMessage?.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻

Goodbye 👋
    `.trim(),
  )

  expect(privateChannel.deleted).toBeTruthy()
})
