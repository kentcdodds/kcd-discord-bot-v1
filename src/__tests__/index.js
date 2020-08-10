const {rest} = require('msw')
const {setupServer} = require('msw/node')
const {handleNewMember, handleNewMessage, handleUpdatedMessage} = require('..')

const server = setupServer(
  // Describe the requests to mock.
  rest.post(
    'https://app.convertkit.com/forms/1547100/subscriptions',
    (req, res, ctx) => {
      const {first_name, email_address} = req.body
      return res(
        ctx.json({
          consent: {
            enabled: false,
            url: `https://app.convertkit.com/forms/consents/81358631?redirect=https%3A%2F%2Fapp.convertkit.com%2Fforms%2Fsuccess%3Fform_id%3D1547100%26first_name%3D${encodeURIComponent(
              first_name,
            )}%26email%3D${encodeURIComponent(
              email_address,
            )}%26ck_subscriber_id%3D948692788\u0026response_format=json`,
          },
          status: 'success',
          redirect_url: `https://app.convertkit.com/forms/success?form_id=1547100\u0026first_name=${encodeURIComponent(
            first_name,
          )}\u0026email=${encodeURIComponent(
            email_address,
          )}\u0026ck_subscriber_id=948692788`,
        }),
      )
    },
  ),
)

beforeAll(() => server.listen({onUnhandledRequest: 'warn'}))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

// eslint-disable-next-line max-lines-per-function
async function setup() {
  const mockClient = {user: {id: 'mock-client', name: 'BOT'}}
  let channel
  const guild = {}

  const mockMember = {
    id: 'mock-user',
    name: 'Fred Joe',
    client: mockClient,
    guild,
    user: {
      id: 'mock-user',
      username: 'fredjoe',
      discriminator: '1234',
    },
    roles: {
      remove: jest.fn(),
      add: jest.fn(),
    },
  }
  mockMember.user.toString = function toString() {
    return `<@${this.id}>`
  }

  function createChannel(name, options) {
    return {
      id: `channel_${name}`,
      name,
      toString: () => `channel_${name}-id`,
      client: mockClient,
      type: 'text',
      messages: {
        _messages: [],
        _create({content, author}) {
          const message = {
            client: mockClient,
            guild,
            author,
            content,
            edit(newContent) {
              return updateMessage(message, newContent)
            },
            delete() {
              const index = channel.messages._messages.indexOf(message)
              channel.messages._messages.splice(index, 1)
            },
            channel,
          }
          return message
        },
        fetch() {
          return Promise.resolve(this._messages)
        },
      },
      delete: jest.fn(),
      async send(newMessageContent) {
        const message = this.messages._create({
          author: mockClient.user,
          content: newMessageContent,
        })
        this.messages._messages.unshift(message)
        // eslint-disable-next-line no-use-before-define
        await handleNewMessage(message)
        return message
      },
      ...options,
    }
  }

  Object.assign(guild, {
    client: mockClient,
    members: {
      cache: {
        find(cb) {
          if (cb(mockMember)) return mockMember
          return null
        },
      },
    },
    channels: {
      cache: {
        _channels: {
          welcomeCategoryChannel: createChannel('Welcome!', {
            type: 'category',
          }),
          introductionChannel: createChannel('👶-introductions'),
          talkToBotsChannel: createChannel('🤖-talk-to-bots'),
          officeHoursChannel: createChannel('🏫-office-hours'),
        },
        find(cb) {
          for (const ch of Object.values(this._channels)) {
            if (cb(ch)) return ch
          }
          throw new Error('unhandled case in channels.cache.find')
        },
      },
      create(name, options) {
        channel = createChannel(name, options)
        return channel
      },
    },
    roles: {
      cache: {
        _roles: {
          everyone: {name: '@everyone', id: 'everyone-role-id'},
          member: {name: 'Member', id: 'member-role-id'},
          unconfirmedMember: {
            name: 'Unconfirmed Member',
            id: 'unconfirmed-role-id',
          },
        },
        find(cb) {
          for (const role of Object.values(this._roles)) {
            if (cb(role)) return role
          }
          return null
        },
      },
    },
  })

  await handleNewMember(mockMember)

  expect(mockMember.roles.add).toHaveBeenCalledWith(
    guild.roles.cache._roles.unconfirmedMember,
    'New member',
  )
  expect(mockMember.roles.add).toHaveBeenCalledTimes(1)
  mockMember.roles.add.mockClear()

  async function sendFromUser(content) {
    const message = channel.messages._create({author: mockMember, content})
    channel.messages._messages.unshift(message)
    await handleNewMessage(message)
    return message
  }

  async function updateMessage(oldMessage, newContent) {
    const messagesArray = channel.messages._messages
    const newMessage = channel.messages._create({
      author: oldMessage.author,
      content: newContent,
    })
    messagesArray[messagesArray.indexOf(oldMessage)] = newMessage
    await handleUpdatedMessage(oldMessage, newMessage)
    return newMessage
  }

  function getBotResponses() {
    const response = []
    for (const message of channel.messages._messages) {
      if (message.author.id === mockClient.user.id) response.push(message)
      else break
    }
    return response
      .map(m => `${m.author.name}: ${m.content}`)
      .reverse()
      .join('\n')
  }

  function getMessageThread(chan = channel) {
    return `
Messages in ${chan.name}

${chan.messages._messages
  .map(m => `${m.author.name}: ${m.content}`)
  .reverse()
  .join('\n')}
    `.trim()
  }

  return {
    send: sendFromUser,
    update: updateMessage,
    member: mockMember,
    messages: channel.messages._messages,
    channel,
    getMessageThread,
    getBotResponses,
    introductionChannel: guild.channels.cache._channels.introductionChannel,
  }
}

test('the typical flow', async () => {
  const {send, getMessageThread, member, introductionChannel} = await setup()

  await send('Fred')
  await send('fred@example.com')
  await send('yes')
  await send('team@kentcdodds.com')
  await send('yes')

  expect(getMessageThread()).toMatchInlineSnapshot(`
    "Messages in 👋-welcome-fredjoe_1234

    BOT: Hello <@mock-user> 👋

    I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`fredjoe#1234\`) and we'll get things fixed up for you.

    (Note, if you make a mistake, you can edit your responses).

    So, let's get started. Here's the first question (of 5):
    BOT: What's your first name?
    Fred Joe: Fred
    BOT: Great, hi Fred 👋
    BOT: What's your email address? (This will add you to Kent's mailing list. You will receive a confirmation email.)
    Fred Joe: fred@example.com
    BOT: Awesome, when we're done here, you'll receive a confirmation email to: fred@example.com.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**
    Fred Joe: yes
    BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: What's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).
    Fred Joe: team@kentcdodds.com
    BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    Fred Joe: yes
    BOT: Awesome, welcome to the KCD Community on Discord!
    BOT: You should be good to go now. Don't forget to check fred@example.com for a confirmation email. Thanks and enjoy the community!

    I recommend you introduce yourself in channel_👶-introductions-id and take a look at what you can do in channel_🤖-talk-to-bots-id. And don't miss Kent's office hours in channel_🏫-office-hours-id! Enjoy the community!

    This channel will get deleted automatically eventually, but you can delete this channel now by sending the word \`delete\`."
  `)

  expect(member.roles.add).toHaveBeenCalledWith(
    member.guild.roles.cache._roles.member,
    'New confirmed member',
  )
  expect(member.roles.add).toHaveBeenCalledTimes(1)

  expect(getMessageThread(introductionChannel)).toMatchInlineSnapshot(`
    "Messages in 👶-introductions

    BOT: Hey everyone! <@mock-user> is new here. Let's give them a warm welcome!

    We'd love to get to know you a bit, <@mock-user>. You can tell us where you're from 🌐, where you work 🏢, send a photo of your pet 🐶, what tech you like 💻, your favorite snack 🍬🍎, or anything else you'd like 🤪."
  `)
})

test('typing and editing to an invalid value', async () => {
  const {send, update, getMessageThread, getBotResponses} = await setup()

  await send('Fred')

  // invalid email
  await send('not an email')
  expect(getBotResponses()).toMatchInlineSnapshot(
    `"BOT: That doesn't look like an email address. Please provide a proper email address."`,
  )

  // valid email
  let emailMessage = await send('fred@example.com')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: Awesome, when we're done here, you'll receive a confirmation email to: fred@example.com.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**"
  `)

  let cocMessage = await send('yes')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: What's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out)."
  `)
  await send('team@kentcdodds.com')

  // edit something to invalid
  emailMessage = await update(emailMessage, 'not an email')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. That doesn't look like an email address. Please provide a proper email address."
  `)

  cocMessage = await update(cocMessage, 'No')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. That doesn't look like an email address. Please provide a proper email address.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. You must agree to the code of conduct to join this community. Do you agree to abide by and uphold the code of conduct? (The answer must be \\"yes\\")"
  `)
  await update(emailMessage, 'fred@acme.com')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@acme.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. You must agree to the code of conduct to join this community. Do you agree to abide by and uphold the code of conduct? (The answer must be \\"yes\\")"
  `)

  // try to send "yes" to complete everything despite there being an edit error
  await send('yes')
  expect(getBotResponses()).toMatchInlineSnapshot(
    `"BOT: There are existing errors with your previous answers, please edit your answer above before continuing."`,
  )

  await update(cocMessage, 'Yes')
  expect(getMessageThread()).not.toContain(`There's a problem with an edit`)

  await send('yes')

  expect(getMessageThread()).toMatchInlineSnapshot(`
    "Messages in 👋-welcome-fredjoe_1234

    BOT: Hello <@mock-user> 👋

    I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`fredjoe#1234\`) and we'll get things fixed up for you.

    (Note, if you make a mistake, you can edit your responses).

    So, let's get started. Here's the first question (of 5):
    BOT: What's your first name?
    Fred Joe: Fred
    BOT: Great, hi Fred 👋
    BOT: What's your email address? (This will add you to Kent's mailing list. You will receive a confirmation email.)
    Fred Joe: not an email
    BOT: That doesn't look like an email address. Please provide a proper email address.
    Fred Joe: fred@acme.com
    BOT: Awesome, when we're done here, you'll receive a confirmation email to: fred@acme.com.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**
    Fred Joe: Yes
    BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: What's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).
    Fred Joe: team@kentcdodds.com
    BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@acme.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    Fred Joe: yes
    BOT: There are existing errors with your previous answers, please edit your answer above before continuing.
    BOT: Thanks for fixing things up, now we can continue.
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@acme.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, simply edit your response. **If everything's correct, simply reply \\"yes\\"**.
    Fred Joe: yes
    BOT: Awesome, welcome to the KCD Community on Discord!
    BOT: You should be good to go now. Don't forget to check fred@acme.com for a confirmation email. Thanks and enjoy the community!

    I recommend you introduce yourself in channel_👶-introductions-id and take a look at what you can do in channel_🤖-talk-to-bots-id. And don't miss Kent's office hours in channel_🏫-office-hours-id! Enjoy the community!

    This channel will get deleted automatically eventually, but you can delete this channel now by sending the word \`delete\`."
  `)
})
