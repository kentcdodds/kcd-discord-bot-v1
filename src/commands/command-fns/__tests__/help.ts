import Discord from 'discord.js'
import {makeFakeClient} from 'test-utils'
import {help} from '../../commands'

test('prints help for all commands', async () => {
  const {
    client,
    defaultChannels: {talkToBotsChannel},
    kody,
  } = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help', author: kody.user},
    talkToBotsChannel,
  )
  await help(message)

  const reply = talkToBotsChannel.lastMessage
  if (!reply || talkToBotsChannel.messages.cache.size !== 1) {
    throw new Error(`The bot didn't send exactly one reply`)
  }
  expect(reply.content).toMatchInlineSnapshot(`
    Here are the available commands (for more details on a command, type \`?help <name-of-command>\`):

    - help: Lists available commands
    - kif: Send a KCD gif (send \`?help kif\` for more info)
    - thanks: A special way to show your appreciation for someone who's helped you out a bit
    - clubs: Create a club with \`?clubs create LINK_TO_GOOGLE_FORM\` (learn more: <https://kcd.im/clubs>)
    - info: Gives information about the bot (deploy date etc.)
    - blog: Find articles on Kent's blog: <https://kentcdodds.com/blog>
    - meetup: Enable users to start and schedule meetups
  `)
})

test('help with a specific command', async () => {
  const {
    client,
    defaultChannels: {talkToBotsChannel},
  } = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {id: 'help_test', content: '?help info'},
    talkToBotsChannel,
  )
  await help(message)

  const reply = talkToBotsChannel.lastMessage
  if (!reply || talkToBotsChannel.messages.cache.size !== 1) {
    throw new Error(`The bot didn't send exactly one reply`)
  }
  expect(reply.content).toMatchInlineSnapshot(
    `Gives information about the bot (deploy date etc.)`,
  )
})
