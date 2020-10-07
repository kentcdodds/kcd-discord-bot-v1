const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const {makeFakeClient, waitUntil} = require('test-utils')
const privateChat = require('../private-chat')
const {getCategory} = require('../../utils')
const {cleanup} = require('../../../private-chat/cleanup')

async function createPrivateChat(mentionedUsernames = []) {
  const {
    client,
    talkToBotsChannel,
    guild,
    addUserMessage,
    createUser,
  } = await makeFakeClient()
  const sentMessageUser = createUser('sentMessageUser')
  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content: '?private-chat',
      author: sentMessageUser,
    },
    talkToBotsChannel,
  )
  const mentionedUsers = mentionedUsernames.map(username =>
    createUser(client, username, guild),
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, mentionedUsers, [], false),
  })

  await privateChat(message)

  return {
    client,
    message,
    guild,
    channelMembers: [sentMessageUser, ...mentionedUsers],
    addUserMessage,
  }
}

function getPrivateChannels(guild) {
  const categoryPrivateChat = getCategory(guild, {name: 'private chat'})
  return Array.from(
    guild.channels.cache
      .filter(channel => channel.parent?.id === categoryPrivateChat.id)
      .values(),
  )
}

test('should create a private chat', async () => {
  const {message, guild, channelMembers} = await createPrivateChat([
    'mentionedUser',
  ])
  const privateChannels = getPrivateChannels(guild)

  expect(privateChannels).toHaveLength(1)
  const privateChannel = privateChannels[0]
  expect(privateChannel.lastMessage).toBeDefined()
  expect(privateChannel.lastMessage.content).toEqual(
    `
Hello <@!${channelMembers[1].user.id}> and <@!${channelMembers[0].user.id}> 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
`.trim(),
  )

  expect(message.channel.send).toHaveBeenCalledTimes(1)
  expect(message.channel.send).toHaveBeenCalledWith(
    `I've created <#${privateChannel.id}> for you folks to talk privately. Cheers!`,
  )
})

test('should delete the private chat after 10 minutes of inactivity', async () => {
  jest.spyOn(Date, 'now').mockImplementation(() => 1598947200000) // 10:00 UTC+2
  const {guild} = await createPrivateChat(['mentionedUser'])
  const privateChannel = getPrivateChannels(guild)[0]
  jest.spyOn(Date, 'now').mockImplementation(() => 1598947380000) //10:03:00 UTC+2
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(1)

  jest.spyOn(Date, 'now').mockImplementation(() => 1598947501000) //10:05:01 UTC+2
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(2)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for inactivity 🚶‍♀️`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)

  jest.spyOn(Date, 'now').mockImplementation(() => 1598947801000) //10:10:01 UTC+2

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for inactivity 🚶‍♀️
  
  Goodbye 👋
    `.trim(),
  )

  await waitUntil(() => {
    expect(privateChannel.deleted).toBeTruthy()
  })
})

test('should delete the private chat after 60 minutes', async () => {
  jest.spyOn(Date, 'now').mockImplementation(() => 1598947200000) // 10:00 UTC+2
  const {guild, channelMembers, addUserMessage} = await createPrivateChat([
    'mentionedUser',
  ])
  const privateChannel = getPrivateChannels(guild)[0]

  jest.spyOn(Date, 'now').mockImplementation(() => 1598947800000) //10:15:00 UTC+2
  addUserMessage({user: channelMembers[0].user, channel: privateChannel})
  jest.spyOn(Date, 'now').mockImplementation(() => 1598950501000) //10:55:01 UTC+2
  addUserMessage({user: channelMembers[0].user, channel: privateChannel})
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )
  // run this to check that no other warning message are sent
  await cleanup(guild)

  jest.spyOn(Date, 'now').mockImplementation(() => 1598950801000) //11:00:01 UTC+2

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(5)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻
  
  Goodbye 👋
    `.trim(),
  )

  await waitUntil(() => {
    expect(privateChannel.deleted).toBeTruthy()
  })
})

test('should not create a chat without mentioned member', async () => {
  const {message} = await createPrivateChat()
  expect(message.channel.send).toHaveBeenCalledTimes(1)
  expect(message.channel.send).toHaveBeenCalledWith(
    'You should mention at least one other member.',
  )
})

test('should give an error trying to create a chat for the same members', async () => {
  const {message, guild} = await createPrivateChat(['mentionedUser'])
  const privateChannel = getPrivateChannels(guild)[0]
  await privateChat(message)

  expect(message.channel.send).toHaveBeenCalledTimes(2)
  expect(message.channel.send).toHaveBeenCalledWith(
    `There is already a chat for the same members <#${privateChannel.id}>`,
  )
})
