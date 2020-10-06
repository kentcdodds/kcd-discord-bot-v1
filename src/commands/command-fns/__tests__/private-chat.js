const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const privateChat = require('../private-chat')

test('should not create a chat without mentioned member', async () => {
  const {client, talkToBotsChannel} = makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'private_chat_test', content: '?private-chat @Username1'},
    talkToBotsChannel,
  )
  await privateChat(message)

  expect(message.channel.send).toHaveBeenCalledTimes(1)
  expect(message.channel.send).toHaveBeenCalledWith(
    'You should mention at least one other member.',
  )
})
