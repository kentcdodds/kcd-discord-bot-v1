/* eslint-disable @typescript-eslint/no-var-requires */
import Discord from 'discord.js'
import {makeFakeClient} from 'test-utils'

test('prints useful info', async () => {
  const {info} = require('../info')
  const {
    client,
    defaultChannels: {talkToBotsChannel},
    kody,
  } = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?info', author: kody.user},
    talkToBotsChannel,
  )

  await info(message)

  const reply = talkToBotsChannel.lastMessage
  if (!reply || talkToBotsChannel.messages.cache.size !== 1) {
    throw new Error(`The bot didn't send exactly one reply`)
  }
})
