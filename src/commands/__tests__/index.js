const Discord = require('discord.js')
const {makeFakeClient, waitUntil} = require('test-utils')
const {handleNewMessage} = require('..')

test('handles incoming messages', async () => {
  const {client, talkToBotsChannel, kody} = await makeFakeClient()

  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help', author: kody.user},
    talkToBotsChannel,
  )

  await handleNewMessage(message)
  await waitUntil(() =>
    expect(Array.from(talkToBotsChannel.messages.cache.values())).toHaveLength(
      1,
    ),
  )
  const messages = Array.from(talkToBotsChannel.messages.cache.values())
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
