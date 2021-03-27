import Discord from 'discord.js'
import {makeFakeClient, waitUntil} from 'test-utils'
import {handleNewMessage} from '..'

test('handles incoming messages', async () => {
  const {client, defaultChannels, kody} = await makeFakeClient()

  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help', author: kody.user},
    defaultChannels.talkToBotsChannel,
  )

  await handleNewMessage(message)
  await waitUntil(() =>
    expect(
      Array.from(defaultChannels.talkToBotsChannel.messages.cache.values()),
    ).toHaveLength(1),
  )
  expect(defaultChannels.talkToBotsChannel.lastMessage?.content)
    .toMatchInlineSnapshot(`
    Here are the available commands (for more details on a command, type \`?help <name-of-command>\`):

    - help: Lists available commands
    - kif: Send a KCD gif (send \`?help kif\` for more info)
    - thanks: A special way to show your appreciation for someone who's helped you out a bit
    - clubs: Create a club with \`?clubs create LINK_TO_GOOGLE_FORM\` (learn more: <https://kcd.im/clubs>)
    - info: Gives information about the bot (deploy date etc.)
    - private-chat: Create a private channel with who you want. This channel is temporary.
    - blog: Find articles on Kent's blog: <https://kentcdodds.com/blog>
    - meetup: Enable users to start and schedule meetups
  `)
})
