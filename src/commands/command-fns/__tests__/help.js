const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const help = require('../help')

test('prints help for all commands', async () => {
  const {client, talkToBotsChannel} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help'},
    talkToBotsChannel,
  )
  await help(message)
  expect(talkToBotsChannel.send).toHaveBeenCalledWith(
    expect.stringContaining('- help'),
  )
  expect(talkToBotsChannel.send).toHaveBeenCalledTimes(1)
})

test('help with a specific command', async () => {
  const {client, talkToBotsChannel} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help info'},
    talkToBotsChannel,
  )
  await help(message)
  expect(talkToBotsChannel.send).toHaveBeenCalledWith(
    expect.stringContaining('information'),
  )
  expect(talkToBotsChannel.send).toHaveBeenCalledTimes(1)
})
