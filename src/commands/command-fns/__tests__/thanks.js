const Discord = require('discord.js')
const {SnowflakeUtil} = require('discord.js')
const {rest} = require('msw')
const {makeFakeClient} = require('test-utils')
const {server} = require('server')
const thanks = require('../thanks')

async function setup(content, mentionedUsernames = []) {
  const {client, defaultChannels, kody, createUser} = await makeFakeClient()
  const message = new Discord.Message(
    client,
    {
      id: SnowflakeUtil.generate(),
      content,
      author: kody.user,
    },
    defaultChannels.talkToBotsChannel,
  )
  const mentionedUsers = (
    await Promise.all(mentionedUsernames.map(username => createUser(username)))
  ).map(guildMember => guildMember.user)

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

test('should say thank to an user', async () => {
  let thanksRetrieved = false
  let savedThanks = {}
  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        thanksRetrieved = true
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: ''}}}),
        )
      },
    ),
    rest.patch(
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

  const thanksMessage = `https://discordapp.com/channels/${botChannel.guild.id}/${botChannel.id}/${message.id}`
  const thanksObject = {}
  thanksObject[mentionedUsers[0].id] = [thanksMessage]
  expect(thanksRetrieved).toBeTruthy()
  expect(JSON.parse(savedThanks.files['thanks.json'].content)).toMatchObject(
    thanksObject,
  )
  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(1)
  expect(getThanksMessages()[0].content).toEqual(
    `
Hey <@${mentionedUsers[0].id}>! You got thanked! 🎉

<@${kody.id}> appreciated you for:

> the help with epicReact

Link: <${thanksMessage}>
  `.trim(),
  )
  expect(getBotMessages()[0].content).toEqual(
    `Aw! Thanks! https://discordapp.com/channels/${botChannel.guild.id}/${
      thanksChannel.id
    }/${getThanksMessages()[0].id} 😍`,
  )
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
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(`
    "This is the rank of the requested member:
    - kody hasn't been thanked yet 🙁"
  `)
})

test('should show the rank of the user message', async () => {
  const {getBotMessages, getThanksMessages, message, kody} = await setup(
    '?thanks rank',
  )

  const ranks = {}
  ranks[kody.id] = ['link_to_message']

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: JSON.stringify(ranks)}}}),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(`
    "This is the rank of the requested member:
    - kody has been thanked 1 time 👏"
  `)
})

test('should show the rank of the mentioned user', async () => {
  const {
    getBotMessages,
    getThanksMessages,
    message,
    mentionedUsers,
  } = await setup('?thanks rank', ['user1'])

  const ranks = {}
  ranks[mentionedUsers[0].id] = ['link_to_message1', 'link_to_message2']

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: JSON.stringify(ranks)}}}),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(`
    "This is the rank of the requested member:
    - user1 has been thanked 2 times 👏"
  `)
})

test('should show the rank of the top 10 users', async () => {
  const {getBotMessages, getThanksMessages, message, createUser} = await setup(
    '?thanks rank top',
  )
  const rankedUsers = await Promise.all(
    Array.from(Array(20).keys()).map(index => createUser(`user${index}`)),
  )

  const ranks = {}
  rankedUsers.forEach((rankedUser, index) => {
    ranks[rankedUser.id] = Array.from(Array(index).keys()).map(
      messageIndex => `link_to_message${messageIndex}`,
    )
  })

  server.use(
    rest.get(
      `https://api.github.com/gists/${process.env.GIST_REPO_THANKS}`,
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({files: {'thanks.json': {content: JSON.stringify(ranks)}}}),
        )
      },
    ),
  )

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(`
    "This is the list of the top thanked members 💪:
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
    - user9 has been thanked 9 times 👏"
  `)
})

test('should give an error if the message not contain the reason for the thank', async () => {
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
  const {
    getBotMessages,
    getThanksMessages,
    message,
  } = await setup('?thanks @user1', ['user1'])

  await thanks(message)

  expect(getBotMessages()).toHaveLength(1)
  expect(getThanksMessages()).toHaveLength(0)
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(
    `"You have to use the word \\"for\\" when thanking someone. For example: \`?thanks @user1 for being so nice and answering my questions\`"`,
  )
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
  expect(getBotMessages()[0].content).toMatchInlineSnapshot(
    `"There is an issue retrieving the history. Please try again later 🙏"`,
  )
})
