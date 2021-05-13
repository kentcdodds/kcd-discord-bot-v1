import assert from 'assert'
import Discord, {SnowflakeUtil} from 'discord.js'
import {rest} from 'msw'
import {makeFakeClient} from 'test-utils'
import {server} from 'server'
import {thanks} from '../thanks'
import type {
  ThanksHistory,
  GitHubResponseBody,
  GitHubRequestBody,
} from '../thanks'

async function setup(content: string, mentionedUsernames: Array<string> = []) {
  const {client, defaultChannels, kody, createUser} = await makeFakeClient()
  const mentionedUsers = (
    await Promise.all(mentionedUsernames.map(username => createUser(username)))
  ).map(guildMember => guildMember.user)

  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content: content.replace(/@(\S+)/, (_, mention) => {
        const mentionedUser = mentionedUsers.find(
          user => user.username === mention,
        )
        assert(
          mentionedUser,
          `Content had an ID for which there was no mentioned user: ${mention}`,
        )
        return mentionedUser.toString()
      }),
      author: kody.user,
    },
    defaultChannels.talkToBotsChannel,
  )

  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, mentionedUsers, [], false),
  })

  const getBotMessages = () =>
    Array.from(defaultChannels.talkToBotsChannel.messages.cache.values())
  const getThanksMessages = () =>
    Array.from(defaultChannels.thanksChannel.messages.cache.values())
  return {
    getBotMessages,
    getThanksMessages,
    mentionedUsers,
    kody,
    botChannel: defaultChannels.talkToBotsChannel,
    thanksChannel: defaultChannels.thanksChannel,
    message,
    createUser,
  }
}

test('should say thanks if the message is complete', async () => {
  let thanksRetrieved = false
  let savedThanks: GitHubRequestBody
  server.use(
    rest.get<GitHubResponseBody>(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        thanksRetrieved = true
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
    rest.patch<GitHubRequestBody>(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        savedThanks = req.body
        return res(ctx.status(200), ctx.json({}))
      },
    ),
  )
  const {
    getBotMessages,
    getThanksMessages,
    mentionedUsers,
    kody,
    botChannel,
    thanksChannel,
    message,
  } = await setup('?thanks @user1 for the help with epicReact', ['user1'])

  await thanks(message)

  const [user1] = mentionedUsers
  assert(user1)

  const thanksMessageLink = `https://discordapp.com/channels/${botChannel.guild.id}/${botChannel.id}/${message.id}`
  const thanksHistory: ThanksHistory = {
    [thanksMessageLink]: {thanker: kody.user.id, thanked: [user1.id]},
  }
  expect(thanksRetrieved).toBeTruthy()

  // @ts-expect-error no idea how to deal with this situation...
  assert(savedThanks, 'Thanks not saved')
  expect(JSON.parse(savedThanks.files['thanks.json'].content)).toMatchObject(
    thanksHistory,
  )
  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(1)
  expect(getThanksMessages()[0]?.content).toEqual(
    `
Hey <@!${user1.id}>! You got thanked! 🎉

<@!${kody.id}> appreciated you for:

> the help with epicReact

Link: <${thanksMessageLink}>
  `.trim(),
  )
  expect(getBotMessages()[0]?.content).toEqual(
    `Aw! Thanks! https://discordapp.com/channels/${botChannel.guild.id}/${
      thanksChannel.id
    }/${getThanksMessages()[0]?.id} 😍`,
  )
})

test('should say thanks if there is no for', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
    rest.patch(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({}))
      },
    ),
  )
  const {
    getBotMessages,
    getThanksMessages,
    message,
  } = await setup('?thanks @user1 tadaa', ['user1'])

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(1)
  expect(getThanksMessages()[0]?.content.replace(/\d+/g, '123'))
    .toMatchInlineSnapshot(`
    Hey <@!123>! You got thanked! 🎉

    <@!123> appreciated you for:

    > tadaa

    Link: <https://discordapp.com/channels/123/123/123>
  `)
})

test('should say thanks if there is no message', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
    rest.patch(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({}))
      },
    ),
  )
  const {
    getBotMessages,
    getThanksMessages,
    message,
  } = await setup('  ?thanks    @user1    for   ', ['user1'])

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(1)
  expect(getThanksMessages()[0]?.content.replace(/\d+/g, '123'))
    .toMatchInlineSnapshot(`
    Hey <@!123>! You got thanked! 🎉

    <@!123> appreciated you.

    Link: <https://discordapp.com/channels/123/123/123>
  `)
})

test('should show a message if the user has never been thanked', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
  )
  const {getBotMessages, getThanksMessages, message} = await setup(
    '?thanks rank',
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - kody hasn't been thanked yet 🙁
  `)
})

test('should show the rank of the user message', async () => {
  const {getBotMessages, getThanksMessages, message, kody} = await setup(
    '?thanks rank',
  )

  const thanksHistory: ThanksHistory = {
    mockMessageId: {thanker: 'mockThanker', thanked: [kody.id]},
  }

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - kody has been thanked 1 time 👏
  `)
})

test('should show the rank of the mentioned user', async () => {
  const {
    getBotMessages,
    getThanksMessages,
    kody,
    message,
    mentionedUsers,
  } = await setup('?thanks rank', ['user1'])

  const [user1] = mentionedUsers
  assert(user1)
  const thanksHistory: ThanksHistory = {
    link_to_message1: {thanker: kody.id, thanked: [user1.id]},
    link_to_message2: {thanker: kody.id, thanked: [user1.id]},
  }

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - user1 has been thanked 2 times 👏
  `)
})

test('should show the rank of the top 10 users', async () => {
  const {
    getBotMessages,
    getThanksMessages,
    kody,
    message,
    createUser,
  } = await setup('?thanks rank top')
  const rankedUsers = await Promise.all(
    Array.from(Array(20).keys()).map(index => createUser(`user${index}`)),
  )

  const thanksHistory: ThanksHistory = {}
  rankedUsers.forEach((rankedUser, index) => {
    Array<string>(index)
      .fill('link_to_message')
      .forEach((_, i) => {
        thanksHistory[`mockMessageId${index}+${i}`] = {
          thanker: kody.id,
          thanked: [rankedUser.id],
        }
      })
  })

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the list of the top thanked members 💪:
    - user19 has been thanked 19 times 👏
    - user18 has been thanked 18 times 👏
    - user17 has been thanked 17 times 👏
    - user16 has been thanked 16 times 👏
    - user15 has been thanked 15 times 👏
    - user14 has been thanked 14 times 👏
    - user13 has been thanked 13 times 👏
    - user12 has been thanked 12 times 👏
    - user11 has been thanked 11 times 👏
    - user10 has been thanked 10 times 👏
  `)
})

test('should show a message if the user has never thanked', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
  )
  const {getBotMessages, getThanksMessages, message} = await setup(
    '?thanks gratitude rank',
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - kody hasn't thanked anyone yet 🙁
  `)
})

test('should show the gratitude rank of the user', async () => {
  const {getBotMessages, getThanksMessages, message, kody} = await setup(
    '?thanks gratitude rank',
  )

  const thanksHistory: ThanksHistory = {
    link_to_message: {thanker: kody.id, thanked: ['someone else']},
  }

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - kody has thanked other people 1 time 👏
  `)
})

test('should show the gratitude rank of the mentioned user', async () => {
  const {
    getBotMessages,
    getThanksMessages,
    kody,
    message,
    mentionedUsers,
  } = await setup('?thanks gratitude rank', ['user1'])

  const [user1] = mentionedUsers
  assert(user1)

  const thanksHistory: ThanksHistory = {
    link_to_message1: {thanker: user1.id, thanked: [kody.id]},
    link_to_message2: {thanker: user1.id, thanked: [kody.id]},
  }

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the rank of the requested member:
    - user1 has thanked other people 2 times 👏
  `)
})

test('should show the gratitude rank of the top 10 users', async () => {
  const {
    getBotMessages,
    getThanksMessages,
    kody,
    message,
    createUser,
  } = await setup('?thanks gratitude rank top')
  const rankedUsers = await Promise.all(
    Array.from(Array(20).keys()).map(index => createUser(`user${index}`)),
  )

  const thanksHistory: ThanksHistory = {}
  rankedUsers.forEach((rankedUser, index) => {
    Array<string>(index)
      .fill('link_to_message')
      .forEach((_, i) => {
        thanksHistory[`mockMessageId${index}+${i}`] = {
          thanker: rankedUser.id,
          thanked: [kody.id],
        }
      })
  })

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            files: {'thanks.json': {content: JSON.stringify(thanksHistory)}},
          }),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(`
    This is the list of the most grateful members 💪:
    - user19 has thanked other people 19 times 👏
    - user18 has thanked other people 18 times 👏
    - user17 has thanked other people 17 times 👏
    - user16 has thanked other people 16 times 👏
    - user15 has thanked other people 15 times 👏
    - user14 has thanked other people 14 times 👏
    - user13 has thanked other people 13 times 👏
    - user12 has thanked other people 12 times 👏
    - user11 has thanked other people 11 times 👏
    - user10 has thanked other people 10 times 👏
  `)
})

test('should give an error if there are some issues retrieving data from gist', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(ctx.status(500))
      },
    ),
  )
  const {
    getBotMessages,
    getThanksMessages,
    message,
  } = await setup('?thanks @user1', ['user1'])

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(
    `There is an issue retrieving the history. Please try again later 🙏`,
  )
})

test('should give an error if no user is thanked', async () => {
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
  )
  const {getBotMessages, getThanksMessages, message} = await setup('?thanks')

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0]?.content).toMatchInlineSnapshot(
    `You have to mention someone specific you want to thank.`,
  )
})
