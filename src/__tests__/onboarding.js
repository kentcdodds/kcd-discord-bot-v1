const {rest} = require('msw')
const {server} = require('server')
const {makeFakeClient} = require('test-utils')
const {isWelcomeChannel} = require('../utils')
const {
  onboarding: {handleNewMember, handleNewMessage, handleUpdatedMessage},
} = require('..')

function getOnBoardingChannels(guild) {
  return Array.from(guild.channels.cache.filter(isWelcomeChannel).values())
}

async function setup() {
  const {
    client,
    createUser,
    sendFromUser,
    reactFromUser,
    guild,
    defaultChannels,
  } = await makeFakeClient()

  const member = await createUser('fredjoe', {
    discriminator: 1234,
  })

  await handleNewMember(member)

  const [onboardingChannel] = getOnBoardingChannels(guild)

  async function send(content) {
    const message = sendFromUser({
      user: member.user,
      channel: onboardingChannel,
      content,
    })
    await handleNewMessage(message)
    return message
  }

  async function update(oldMessage, newContent) {
    const newMessage = {
      ...oldMessage,
      content: newContent,
      guild,
      client,
    }
    onboardingChannel.messages.cache.set(newMessage.id, newMessage)
    await handleUpdatedMessage(oldMessage, newMessage)
    return newMessage
  }

  function getMessageThread() {
    return `
Messages in ${onboardingChannel.name}

${Array.from(onboardingChannel.messages.cache.values())
  .map(m => {
    const content = m.content
      .replace(`<@${member.id}>`, '<@mock-user>')
      .replace(`<#${defaultChannels.tipsChannel.id}>`, 'channel_💁-tips-id')
      .replace(
        `<#${defaultChannels.introductionChannel.id}>`,
        'channel_👶-introductions-id',
      )
    return `${m.author.username}: ${content}`
  })
  .join('\n')}
    `.trim()
  }

  function getBotResponses() {
    const response = []
    const messages = Array.from(
      onboardingChannel.messages.cache.values(),
    ).reverse()
    for (const message of messages) {
      if (message.author.id === client.user.id) response.push(message)
      else break
    }
    return response
      .reverse()
      .map(m => `${m.author.username}: ${m.content}`)
      .join('\n')
  }

  const react = (message, emoji) =>
    reactFromUser({user: member.user, message, reactionName: emoji})

  return {
    member,
    send,
    update,
    react,
    onboardingChannel,
    getMessageThread,
    getBotResponses,
    defaultChannels,
  }
}

// eslint-disable-next-line max-lines-per-function
test('the typical flow', async () => {
  const {
    send,
    react,
    getMessageThread,
    onboardingChannel,
    member,
  } = await setup()

  expect(onboardingChannel.name).toMatchInlineSnapshot(
    `"🌊-welcome-fredjoe_1234"`,
  )

  const name = 'Fred'
  const email = 'fred@example.com'
  await send(name) // What's your name
  await send(email) // What's your email
  await send('yes') // coc?
  await send('team@kentcdodds.com') // coc check
  await send('done') // avatar
  await send('yes') // confirm

  // now they're subscribed
  server.use(
    rest.get('https://api.convertkit.com/v3/subscribers', (req, res, ctx) => {
      return res(
        ctx.json({
          total_subscribers: 1,
          page: 1,
          total_pages: 1,
          subscribers: [
            {
              id: 363855345,
              first_name: name,
              email_address: email,
              state: 'inactive',
              created_at: new Date().toJSON(),
              fields: {},
            },
          ],
        }),
      )
    }),
    rest.put(
      'https://api.convertkit.com/v3/subscribers/:subscriberId',
      (req, res, ctx) => {
        expect(req.body.fields).toEqual({tech_interests: 'cypress,jest'})
        return res(
          ctx.json({
            subscriber: {
              id: req.params.subscriberId,
              first_name: name,
              email_address: email,
              state: 'inactive',
              created_at: new Date().toJSON(),
              fields: {
                tech_interests: req.body.fields,
              },
            },
          }),
        )
      },
    ),
  )

  const messages = Array.from(onboardingChannel.messages.cache.values())
  const techMessage = messages.find(msg =>
    msg.content.includes('the tech you are most interested in'),
  )
  await react(techMessage, 'jest')
  await react(techMessage, 'cypress')

  await send('anything else?')
  await send('delete')

  expect(getMessageThread()).toMatchInlineSnapshot(`
    "Messages in 🌊-welcome-fredjoe_1234

    BOT: Hello <@mock-user> 👋

    I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`fredjoe#1234\`), an explanation of the trouble, and a screenshot of the conversation. And we'll get things fixed up for you.

    (Note, if you make a mistake, you can edit your responses).

    In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    BOT: What's your first name?
    fredjoe: Fred
    BOT: Great, hi Fred 👋
    BOT: _I've changed your nickname on this server to Fred. If you'd like to change it back then type: \`/nick fredjoe\`_
    BOT: What's your email address? (This will look you up on Kent's mailing list. If you're not already on it, you'll be added and will receive a confirmation email.)
    fredjoe: fred@example.com
    BOT: Awesome, when we're done here, you'll receive a confirmation email to: fred@example.com.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**
    fredjoe: yes
    BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: **Based on what you read in the Code of Conduct**, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).
    fredjoe: team@kentcdodds.com
    BOT: That's right!
    BOT: It's more fun here when folks have an avatar. You can go ahead and set yours now 😄

    I got this image using your email address with gravatar.com. You can use it for your avatar if you like.

    https://www.gravatar.com/avatar/6255165076a5e31273cbda50bb9f9636?s=128&d=404

    Here's how you set your avatar: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

    **When you're finished (or if you'd like to just move on), just say \\"done\\"**
    fredjoe: done
    BOT: Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    fredjoe: yes
    BOT: Awesome, welcome to the KCD Community on Discord!
    BOT: 🎉 You should be good to go now. Don't forget to check fred@example.com for a confirmation email. 📬

    🎊 You now have access to the whole server. Welcome!
    BOT: https://media.giphy.com/media/MDxjbPCg6DGf8JclbR/giphy.gif
    BOT: 👆 that's Kent!
    BOT: One last thing here if you want, click the icon of the tech you are most interested in right now (or want to learn about). Kent will use this to give you more relevant content in the future.
    BOT: The first thing I'd suggest you do is go to channel_💁-tips-id to read up on some of the things you can do here.

    We'd love to get to know you a bit. Tell us about you in channel_👶-introductions-id. Here's a template you can use:

    🌐 I'm from:
    🏢 I work at:
    💻 I work with this tech:
    🍎 I snack on:
    🤪 I really enjoy:

    Enjoy the community!
    fredjoe: anything else?
    BOT: We're all done. This channel will get deleted automatically eventually, but if you want to delete it yourself, then say \\"delete\\".
    fredjoe: delete
    BOT: This channel is getting deleted for the following reason: Requested by the member

    Goodbye 👋"
  `)

  expect(
    Array.from(member.roles.cache.values())
      .map(role => role.name)
      .join(', '),
  ).toMatchInlineSnapshot(`"Member, @everyone"`)
})

// eslint-disable-next-line max-lines-per-function
test('typing and editing to an invalid value', async () => {
  const {
    send,
    update,
    getMessageThread,
    getBotResponses,
    member,
  } = await setup()

  const nameMessage = await send('Fred')

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
    BOT: **Based on what you read in the Code of Conduct**, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out)."
  `)
  await send('team@kentcdodds.com')

  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: That's right!
    BOT: It's more fun here when folks have an avatar. You can go ahead and set yours now 😄

    I got this image using your email address with gravatar.com. You can use it for your avatar if you like.

    https://www.gravatar.com/avatar/6255165076a5e31273cbda50bb9f9636?s=128&d=404

    Here's how you set your avatar: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

    **When you're finished (or if you'd like to just move on), just say \\"done\\"**"
  `)
  await send('done')

  // edit something to invalid
  emailMessage = await update(emailMessage, 'not an email')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. That doesn't look like an email address. Please provide a proper email address."
  `)

  cocMessage = await update(cocMessage, 'No')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@example.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. That doesn't look like an email address. Please provide a proper email address.
    BOT: There's a problem with an edit that was just made. Please edit the answer again to fix it. You must agree to the code of conduct to join this community. Do you agree to abide by and uphold the code of conduct? (The answer must be \\"yes\\")"
  `)
  await update(emailMessage, 'fred@acme.com')
  expect(getBotResponses()).toMatchInlineSnapshot(`
    "BOT: Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@acme.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
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

  await update(nameMessage, 'Freddy')

  await send('delete')

  expect(getMessageThread()).toMatchInlineSnapshot(`
    "Messages in 🌊-welcome-fredjoe_1234

    BOT: Hello <@mock-user> 👋

    I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`fredjoe#1234\`), an explanation of the trouble, and a screenshot of the conversation. And we'll get things fixed up for you.

    (Note, if you make a mistake, you can edit your responses).

    In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    BOT: What's your first name?
    fredjoe: Freddy
    BOT: Great, hi Freddy 👋
    BOT: _I've changed your nickname on this server to Fred. If you'd like to change it back then type: \`/nick fredjoe\`_
    BOT: What's your email address? (This will look you up on Kent's mailing list. If you're not already on it, you'll be added and will receive a confirmation email.)
    fredjoe: not an email
    BOT: That doesn't look like an email address. Please provide a proper email address.
    fredjoe: fred@acme.com
    BOT: Awesome, when we're done here, you'll receive a confirmation email to: fred@acme.com.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**
    fredjoe: Yes
    BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: **Based on what you read in the Code of Conduct**, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).
    fredjoe: team@kentcdodds.com
    BOT: That's right!
    BOT: It's more fun here when folks have an avatar. You can go ahead and set yours now 😄

    I got this image using your email address with gravatar.com. You can use it for your avatar if you like.

    https://www.gravatar.com/avatar/6255165076a5e31273cbda50bb9f9636?s=128&d=404

    Here's how you set your avatar: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

    **When you're finished (or if you'd like to just move on), just say \\"done\\"**
    fredjoe: done
    BOT: Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).
    BOT: Here are your answers:
      First Name: Fred
      Email: fred@acme.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    fredjoe: yes
    BOT: There are existing errors with your previous answers, please edit your answer above before continuing.
    BOT: Thanks for fixing things up, now we can continue.
    BOT: Here are your answers:
      First Name: Freddy
      Email: fred@acme.com
      Accepted Code of Conduct: Yes
      Avatar: Skipped

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    fredjoe: yes
    BOT: Awesome, welcome to the KCD Community on Discord!
    BOT: 🎉 You should be good to go now. Don't forget to check fred@acme.com for a confirmation email. 📬

    🎊 You now have access to the whole server. Welcome!
    BOT: https://media.giphy.com/media/MDxjbPCg6DGf8JclbR/giphy.gif
    BOT: 👆 that's Kent!
    BOT: One last thing here if you want, click the icon of the tech you are most interested in right now (or want to learn about). Kent will use this to give you more relevant content in the future.
    BOT: The first thing I'd suggest you do is go to channel_💁-tips-id to read up on some of the things you can do here.

    We'd love to get to know you a bit. Tell us about you in channel_👶-introductions-id. Here's a template you can use:

    🌐 I'm from:
    🏢 I work at:
    💻 I work with this tech:
    🍎 I snack on:
    🤪 I really enjoy:

    Enjoy the community!
    BOT: _I've changed your nickname on this server to Freddy. If you'd like to change it back then type: \`/nick fredjoe\`_
    BOT: Thanks for fixing things up, now we can continue.
    BOT: The first thing I'd suggest you do is go to channel_💁-tips-id to read up on some of the things you can do here.

    We'd love to get to know you a bit. Tell us about you in channel_👶-introductions-id. Here's a template you can use:

    🌐 I'm from:
    🏢 I work at:
    💻 I work with this tech:
    🍎 I snack on:
    🤪 I really enjoy:

    Enjoy the community!
    fredjoe: delete
    BOT: This channel is getting deleted for the following reason: Requested by the member

    Goodbye 👋"
  `)

  expect(
    Array.from(member.roles.cache.values())
      .map(role => role.name)
      .join(', '),
  ).toMatchInlineSnapshot(`"Member, @everyone"`)
})

test('a new member with some info already', async () => {
  const {send, getMessageThread, member} = await setup()
  member.user.avatar = '123432'

  const email = 'fred+already-subscribed@example.com'

  server.use(
    rest.get('https://api.convertkit.com/v3/subscribers', (req, res, ctx) => {
      return res(
        ctx.json({
          total_subscribers: 1,
          page: 1,
          total_pages: 1,
          subscribers: [
            {
              id: 363855345,
              first_name: 'Fred',
              email_address: email,
              state: 'active',
              created_at: new Date().toJSON(),
              fields: {},
            },
          ],
        }),
      )
    }),
  )

  await send('Fred') // name
  await send(email) // email
  await send('yes') // coc
  await send('team@kentcdodds.com') // coc verify
  await send('yes') // confirm
  await send('anything else?')

  expect(getMessageThread()).toMatchInlineSnapshot(`
    "Messages in 🌊-welcome-fredjoe_1234

    BOT: Hello <@mock-user> 👋

    I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`fredjoe#1234\`), an explanation of the trouble, and a screenshot of the conversation. And we'll get things fixed up for you.

    (Note, if you make a mistake, you can edit your responses).

    In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    BOT: What's your first name?
    fredjoe: Fred
    BOT: Great, hi Fred 👋
    BOT: _I've changed your nickname on this server to Fred. If you'd like to change it back then type: \`/nick fredjoe\`_
    BOT: What's your email address? (This will look you up on Kent's mailing list. If you're not already on it, you'll be added and will receive a confirmation email.)
    fredjoe: fred+already-subscribed@example.com
    BOT: Oh, nice, fred+already-subscribed@example.com is already a part of Kent's mailing list (you rock 🤘), so you won't be getting a confirmation email after all.
    BOT: Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

    Please read about our code of conduct here: https://kentcdodds.com/conduct

    Do you agree to abide by and uphold the code of conduct? **The only correct answer is \\"yes\\"**
    fredjoe: yes
    BOT: Great, thanks for helping us keep this an awesome place to be.
    BOT: **Based on what you read in the Code of Conduct**, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).
    fredjoe: team@kentcdodds.com
    BOT: That's right!
    BOT: Here are your answers:
      First Name: Fred
      Email: fred+already-subscribed@example.com
      Accepted Code of Conduct: Yes

    If you'd like to change any, then edit your responses above.

    **If everything's correct, simply reply \\"yes\\"**.
    fredjoe: yes
    BOT: Awesome, welcome to the KCD Community on Discord!
    BOT: 🎉 You should be good to go now. 

    🎊 You now have access to the whole server. Welcome!
    BOT: https://media.giphy.com/media/MDxjbPCg6DGf8JclbR/giphy.gif
    BOT: 👆 that's Kent!
    BOT: One last thing here if you want, click the icon of the tech you are most interested in right now (or want to learn about). Kent will use this to give you more relevant content in the future.
    BOT: The first thing I'd suggest you do is go to channel_💁-tips-id to read up on some of the things you can do here.

    We'd love to get to know you a bit. Tell us about you in channel_👶-introductions-id. Here's a template you can use:

    🌐 I'm from:
    🏢 I work at:
    💻 I work with this tech:
    🍎 I snack on:
    🤪 I really enjoy:

    Enjoy the community!
    fredjoe: anything else?
    BOT: We're all done. This channel will get deleted automatically eventually, but if you want to delete it yourself, then say \\"delete\\"."
  `)

  expect(
    Array.from(member.roles.cache.values())
      .map(role => role.name)
      .join(', '),
  ).toMatchInlineSnapshot(`"Member, @everyone"`)
})
