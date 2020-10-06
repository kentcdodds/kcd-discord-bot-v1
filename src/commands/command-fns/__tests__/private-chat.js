const Discord = require('discord.js')
const {makeFakeClient, createUser} = require('test-utils')
const privateChat = require('../private-chat')
const {getCategory} = require('../../utils')

async function createPrivateChat(mentionedUsernames = []) {
  const {client, talkToBotsChannel, guild} = makeFakeClient()
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
  Object.assign(message, {
    mentions: new Discord.MessageMentions(
      message,
      mentionedUsernames.map(username => createUser(client, username, guild)),
      [],
      false,
    ),
  })

  await privateChat(message)

  return {
    message,
    guild,
  }
}

test('should create a private chat', async () => {
  const {message, guild} = await createPrivateChat(['mentionedUser'])
  expect(message.channel.send).toHaveBeenCalledTimes(1)
  expect(message.channel.send).toHaveBeenCalledWith(
    `I've created <#😎-private-mentionedUser-and-others-id> for you folks to talk privately. Cheers!`,
  )

  const categoryPrivateChat = getCategory(message.guild, {name: 'private chat'})
  const privateChannels = Array.from(
    guild.channels.cache
      .filter(channel => channel.parentID?.id === categoryPrivateChat.id)
      .values(),
  )
  expect(privateChannels).toHaveLength(1)
  const privateChannel = privateChannels[0]
  expect(privateChannel.send).toHaveBeenCalledTimes(1)
  expect(privateChannel.send).toHaveBeenCalledWith(
    `
Hello <@!mentionedUser-id> and <@!sentMessageUser-id> 👋

I'm the bot that created this channel for you. The channel will be deleted after 1 hour or after 10 minutes for inactivity. Enjoy 🗣

> Please note that the KCD Discord Server Owners and Admins *can* see this chat. So if you want to be *completely* private, then you'll need to take your communication elsewhere.
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
