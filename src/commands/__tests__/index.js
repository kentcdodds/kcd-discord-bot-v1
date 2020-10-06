const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const {handleNewMessage} = require('..')

test('handles incoming messages', async () => {
  const {client, talkToBotsChannel, kody} = makeFakeClient()

  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help', author: kody.user},
    talkToBotsChannel,
  )

  await handleNewMessage(message)
  expect(talkToBotsChannel.send).toHaveBeenCalledTimes(1)
})
