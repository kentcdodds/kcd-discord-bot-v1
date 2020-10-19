const Discord = require('discord.js')
const {makeFakeClient} = require('test-utils')
const help = require('../help')

test('prints help for all commands', async () => {
  const {client, defaultChannels, kody} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help', author: kody.user},
    defaultChannels.talkToBotsChannel,
  )
  await help(message)

  const messages = Array.from(
    defaultChannels.talkToBotsChannel.messages.cache.values(),
  )
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(`
    "Here are the available commands:

    - help: Lists available commands
    - kif: Send a KCD gif (send \`?help kif\` for more info)
    - thanks: A special way to show your appreciation for someone who's helped you out a bit
    - roles: Add or remove yourself from these roles: \\"Notify: Kent Live\\" and \\"Notify: Office Hours\\"
    - clubs: Create a club with \`?clubs create LINK_TO_GOOGLE_FORM\` (learn more: <https://kcd.im/clubs>)
    - info: Gives information about the bot (deploy date etc.)
    - private-chat: Create a private channel with who you want. This channel is temporary.
    - blog: Find articles on Kent's blog: <https://kentcdodds.com/blog>"
  `)
})

test('help with a specific command', async () => {
  const {client, defaultChannels} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help info'},
    defaultChannels.talkToBotsChannel,
  )
  await help(message)

  const messages = Array.from(
    defaultChannels.talkToBotsChannel.messages.cache.values(),
  )
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toMatchInlineSnapshot(
    `"Gives information about the bot (deploy date etc.)"`,
  )
})
