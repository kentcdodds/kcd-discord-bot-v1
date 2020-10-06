const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const {makeFakeClient, createUser, guilds} = require('test-utils')
const {rest} = require('msw')
const {setupServer} = require('msw/node')
const privateChat = require('../private-chat')
const {getCategory} = require('../../utils')
const {cleanup} = require('../../../private-chat/cleanup')

let channels = {}
const server = setupServer(
  rest.post('*/api/:apiVersion/guilds/:guild/channels', (req, res, ctx) => {
    const createdChannel = {
      id: SnowflakeUtil.generate(),
      guild_id: req.params.guild,
      ...req.body,
    }
    channels[createdChannel.id] = {
      ...createdChannel,
      messages: [],
    }
    return res(ctx.status(200), ctx.json(createdChannel))
  }),
  rest.get(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const channel = channels[req.params.channelId]
      return res(ctx.status(200), ctx.json(channel.messages))
    },
  ),
  rest.post(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const channel = channels[req.params.channelId]
      const guild = guilds[channel.guild_id]
      const message = {
        id: SnowflakeUtil.generate(),
        channel_id: channel.id,
        guild_id: channel.guild_id,
        timestamp: new Date().toISOString(),
        author: guild.client.user,
        ...req.body,
      }
      channel.messages.push(message)
      return res(ctx.status(200), ctx.json(message))
    },
  ),
  rest.delete('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = channels[req.params.channelId]
    channel.deleted = true
    return res(ctx.status(200), ctx.json(channel))
  }),
  rest.get('*/api/:apiVersion/gateway/bot', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        url: '',
        shards: 9,
        session_start_limit: {
          total: 1000,
          remaining: 999,
          reset_after: 14400000,
        },
      }),
    )
  }),
)
beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  channels = {}
})

async function createPrivateChat(mentionedUsernames = []) {
  const {client, talkToBotsChannel, guild} = await makeFakeClient()
  const sentMessageUser = createUser(client, 'sentMessageUser', guild)
  const message = new Discord.Message(
    client,
    {
      id: 'private_chat_test',
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
    mentionedUsers,
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
  const {message, guild} = await createPrivateChat(['mentionedUser'])
  const privateChannels = getPrivateChannels(guild)

  expect(privateChannels).toHaveLength(1)
  const privateChannel = privateChannels[0]
  expect(privateChannel.lastMessage).toBeDefined()
  expect(privateChannel.lastMessage.content).toEqual(
    `
Hello <@!mentionedUser-id> and <@!sentMessageUser-id> 👋

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

  jest.spyOn(Date, 'now').mockImplementation(() => 1598947801000) //10:10:01 UTC+2

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for inactivity 🚶‍♀️
  
  Goodbye 👋
    `.trim(),
  )
})

test('should delete the private chat after 60 minutes', async () => {
  jest.spyOn(Date, 'now').mockImplementation(() => 1598947200000) // 10:00 UTC+2
  const {guild, client, mentionedUsers} = await createPrivateChat([
    'mentionedUser',
  ])
  const privateChannel = getPrivateChannels(guild)[0]

  jest.spyOn(Date, 'now').mockImplementation(() => 1598950501000) //10:55:01 UTC+2
  const fakeUserMessage = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(Date.now()),
      content: 'Some content',
      author: mentionedUsers[0].user,
    },
    privateChannel,
  )
  privateChannel.messages.cache.set(fakeUserMessage.id, fakeUserMessage)
  channels[privateChannel.id].messages.push(fakeUserMessage)
  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(3)
  expect(privateChannel.lastMessage.content).toEqual(
    `This channel will be deleted in 5 minutes for the following reason: deleted for end of life 👻`,
  )

  jest.spyOn(Date, 'now').mockImplementation(() => 1598950801000) //11:00:01 UTC+2

  await cleanup(guild)
  expect(privateChannel.messages.cache.size).toEqual(4)
  expect(privateChannel.lastMessage.content).toEqual(
    `
This channel is getting deleted for the following reason: deleted for end of life 👻
  
  Goodbye 👋
    `.trim(),
  )
})

test('should not create a chat without mentioned member', async () => {
  const {message} = await createPrivateChat()
  expect(message.channel.send).toHaveBeenCalledTimes(1)
  expect(message.channel.send).toHaveBeenCalledWith(
    'You should mention at least one other member.',
  )
})
