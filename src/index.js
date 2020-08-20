const Discord = require('discord.js')
const got = require('got')
const pMemoize = require('p-memoize')
const {default: md5} = require('md5-hash')

const memGot = pMemoize(got, {
  // five minutes
  maxAge: 1000 * 60 * 5,
})

const welcomeChannelPrefix =
  process.env.NODE_ENV === 'production' ? '👋-welcome-' : '🌊-welcome-'

const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const {CONVERT_KIT_API_SECRET, CONVERT_KIT_API_KEY} = process.env

if (!CONVERT_KIT_API_SECRET) {
  throw new Error('CONVERT_KIT_API_SECRET env variable is required')
}
if (!CONVERT_KIT_API_KEY) {
  throw new Error('CONVERT_KIT_API_KEY env variable is required')
}

const sleep = t =>
  new Promise(resolve =>
    setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : t),
  )

const getSend = channel => async (...args) => {
  const result = await channel.send(...args)
  // wait a brief moment before continuing because channel.send doesn't
  // always resolve after the message is actually sent.
  await sleep(200)
  return result
}

function getSubscriberEndpoint(email) {
  const url = new URL('https://api.convertkit.com/v3/subscribers')
  url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET)
  url.searchParams.set('email_address', email)
  return url.toString()
}

async function getConvertKitSubscriber(email) {
  const url = getSubscriberEndpoint(email)

  const {
    body: {subscribers: [subscriber] = []} = {},
  } = await memGot(url.toString(), {responseType: 'json'})

  return subscriber?.state === 'active' ? subscriber : null
}

const allSteps = [
  {
    name: 'name',
    question: `What's your first name?`,
    feedback: answers => `Great, hi ${answers.name} 👋`,
    getAnswer: messageContents =>
      messageContents.match(/^Great, hi (.*?) 👋/)?.[1] ?? null,
    validate(response) {
      const base = `That does not look like a first name.{qualifier} I need to know what to call you. What's your real first name?`
      if (response.length < 0) {
        return base.replace('{qualifier}', ` It's too short.`)
      }
      if (response.length > 25) {
        return base.replace('{qualifier}', ` It's too long.`)
      }
    },
    action: async ({answers, member, channel}) => {
      try {
        const send = getSend(channel)
        const previousNickname = member.nickname ?? 'Your Name'
        await member.setNickname(answers.name, 'Set during onboarding')
        await send(
          `_I've changed your nickname on this server to ${answers.name}. If you'd like to change it back then type: \`/nick ${previousNickname}\`_`,
        )
      } catch (error) {
        // not sure when this would fail, but if it does, it's not a huge deal.
        // So let's just keep going.
        // it failed on me locally so... 🤷‍♂️
        console.error(
          `Failed setting a nickname for ${member.id}:`,
          error.message,
        )
      }
    },
  },
  {
    name: 'email',
    question: `What's your email address? (This will add you to Kent's mailing list. You will receive a confirmation email.)`,
    feedback: async answers => {
      if (await getConvertKitSubscriber(answers.email)) {
        return `Oh, nice, ${answers.email} is already a part of Kent's mailing list (you rock 🤘), so you won't be getting a confirmation email after all.`
      }
      return `Awesome, when we're done here, you'll receive a confirmation email to: ${answers.email}.`
    },
    getAnswer: messageContents =>
      messageContents.match(
        /^Awesome.*confirmation email to: (?<email>.+@.+?\..+?)\.$/,
      )?.groups?.email ??
      messageContents.match(
        /^Oh, nice, (?<email>.+@.+?\..+?) is already a part/,
      )?.groups?.email ??
      null,
    validate(response) {
      if (!/^.+@.+\..+$/.test(response)) {
        return `That doesn't look like an email address. Please provide a proper email address.`
      }
    },
  },
  {
    name: 'coc',
    question: `
Our community is commited to certain standards of behavior and we enforce that behavior to ensure it's a nice place to spend time.

Please read about our code of conduct here: https://kentcdodds.com/conduct

Do you agree to abide by and uphold the code of conduct? **The only correct answer is "yes"**
    `.trim(),
    feedback: `Great, thanks for helping us keep this an awesome place to be.`,
    getAnswer: messageContents =>
      /^Great, thanks.*awesome place to be.$/.test(messageContents)
        ? true
        : null,
    validate(response) {
      if (response.toLowerCase() !== 'yes') {
        return `You must agree to the code of conduct to join this community. Do you agree to abide by and uphold the code of conduct? (The answer must be "yes")`
      }
    },
  },
  {
    name: 'report',
    question: `**Based on what you read in the Code of Conduct**, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).`.trim(),
    feedback: `That's right!`,
    getAnswer: messageContents =>
      /^That's right.$/.test(messageContents) ? true : null,
    validate(response) {
      if (!response.toLowerCase().includes('team@kentcdodds.com')) {
        return `That's not right. Please open the code of conduct to find out. You're looking for the email address listed under the heading "Have questions/need to report an issue?" We take our code of conduct seriously, so I want to make sure you've opened it. Thanks!`
      }
    },
  },
  {
    name: 'confirm',
    question: answers =>
      `
Here are your answers:
  First Name: ${answers.name}
  Email: ${answers.email}
  Accepted Code of Conduct: ${answers.coc ? 'Yes' : 'No'}

If you'd like to change any, then edit your responses above.

**If everything's correct, simply reply "yes"**.
    `.trim(),
    isQuestionMessage: messageContents =>
      /^Here are your answers/.test(messageContents),
    feedback: `Awesome, welcome to the KCD Community on Discord!`,
    getAnswer: messageContents =>
      /^Awesome, welcome to the KCD/.test(messageContents) ? true : null,
    action: async ({answers, member, channel, isEdit}) => {
      const {guild} = member
      const send = getSend(channel)

      if (!isEdit) {
        const memberRole = guild.roles.cache.find(({name}) => name === 'Member')
        const unconfirmedMemberRole = guild.roles.cache.find(
          ({name}) => name === 'Unconfirmed Member',
        )

        await member.roles.remove(unconfirmedMemberRole)
        await member.roles.add(memberRole, 'New confirmed member')
      }

      const subscriber = await getConvertKitSubscriber(answers.email)
      const discordTagId = '1747377'
      const discordForm = '1547100'
      let checkEmail = ''
      if (subscriber) {
        await got.post(
          `https://api.convertkit.com/v3/tags/${discordTagId}/subscribe`,
          {
            responseType: 'json',
            json: {
              api_key: CONVERT_KIT_API_KEY,
              api_secret: CONVERT_KIT_API_SECRET,
              first_name: answers.name,
              email: answers.email,
              fields: {discord_user_id: member.id},
            },
          },
        )
      } else {
        // the main deifference in subscribing to a tag and subscribing to a
        // form is that in the form's case, the user will get a double opt-in
        // email before they're a confirmed subscriber. So we only add the
        // tag to existing subscribers who have already confirmed.
        await got.post(
          `https://api.convertkit.com/v3/forms/${discordForm}/subscribe`,
          {
            responseType: 'json',
            json: {
              api_key: CONVERT_KIT_API_KEY,
              api_secret: CONVERT_KIT_API_SECRET,
              first_name: answers.name,
              email: answers.email,
              fields: {discord_user_id: member.id},
              tags: [discordTagId],
            },
          },
        )
        checkEmail = `Don't forget to check ${answers.email} for a confirmation email. 📬`
      }
      await send(
        `
🎉 You should be good to go now. ${checkEmail}

${isEdit ? '' : `🎊 You now have access to the whole server. Welcome!`}
        `.trim(),
      )

      if (!isEdit) {
        // this is a gif of Kent doing a flip with the sub-text "SWEEEET!"
        await send('https://media.giphy.com/media/MDxjbPCg6DGf8JclbR/giphy.gif')

        const moreStuffMessage = `
━━━━━━━━━━━━━━━━━━━━

**If you wanna hang out here for a bit longer, I have a few questions that will help you get set up in this server a bit more.**
        `.trim()

        await send(`\n\n${moreStuffMessage}`)
      }
    },
    validate(response) {
      if (response.toLowerCase() !== 'yes') {
        return `Feel free to edit any of the answers. Reply "yes" when we're good to go.`
      }
    },
  },
  {
    actionOnlyStep: true,
    action: async ({channel}) => {
      const send = getSend(channel)
      const message = await send(
        `Click the icon of the tech you are most interested in right now (or want to learn about). Kent will use this to give you more relevant content in the future.`,
      )
      const emojis = [
        'react',
        'jest',
        'cypress',
        'reacttestinglibrary',
        'domtestinglibrary',
        'msw',
        'js',
        'ts',
        'css',
        'html',
        'node',
        'reactquery',
        'nextjs',
        'gatsby',
        'remix',
        'graphql',
      ]

      const reactionEmoji = emojis
        .map(emojiName =>
          message.guild.emojis.cache.find(
            ({name}) => name.toLowerCase() === emojiName,
          ),
        )
        // it's possible the emoji title changed or was removed
        // we should fix the list above in that case, but we don't
        // want to crash just because of that... So we'll filter out those.
        .filter(Boolean)
      for (const emoji of reactionEmoji) {
        // we want them in order
        // eslint-disable-next-line no-await-in-loop
        await message.react(emoji)
      }

      // just because adding the emoji takes a second and it looks funny
      // to have the next message come so quickly after finishing adding
      // all the reactions.
      await sleep(2000)
    },
  },
  {
    name: 'liveStream',
    question: (answers, member) => {
      const kentLiveChannel = member.guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('kent-live') && type === 'text',
      )

      return `Would you like to be notified when Kent starts live streaming in ${kentLiveChannel}?`
    },
    isQuestionMessage: messageContents =>
      /Would you like to be notified when Kent starts live streaming/.test(
        messageContents,
      ),
    feedback: answers => {
      return answers.liveStream?.toLowerCase() === 'yes'
        ? `Cool, when Kent starts live streaming, you'll get notified.`
        : `Ok, you won't be notified when Kent starts live streaming.`
    },
    action: async ({answers, member}) => {
      if (answers.liveStream !== 'yes') return

      await member.roles.add(
        member.guild.roles.cache.find(
          ({name}) => name.toLowerCase() === 'notify: kent live',
        ),
        'Requested by user during onboarding',
      )
    },
    getAnswer: messageContents => {
      return /^Cool, when Kent starts live streaming/i.test(messageContents)
        ? 'yes'
        : /^Ok, you won't be notified when Kent starts live streaming/.test(
            messageContents,
          )
        ? 'no'
        : null
    },
    validate(response) {
      if (!['yes', 'no'].includes(response.toLowerCase())) {
        return `You must answer "yes" or "no": Would you like to be notified when Kent starts live streaming?`
      }
    },
  },
  {
    name: 'officeHours',
    question: (answers, member) => {
      const officeHoursChannel = member.guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('office-hours') && type === 'text',
      )

      return `Would you like to be notified when Kent starts https://kcd.im/office-hours in ${officeHoursChannel}?`
    },
    isQuestionMessage: messageContents =>
      /kcd.im\/office-hours/.test(messageContents),
    feedback: answers => {
      return answers.officeHours?.toLowerCase() === 'yes'
        ? `Great, you'll be notified when Kent's Office Hours start.`
        : `No worries, you won't be notified about Kent's Office Hours.`
    },
    action: async ({answers, member}) => {
      if (answers.officeHours !== 'yes') return

      await member.roles.add(
        member.guild.roles.cache.find(
          ({name}) => name.toLowerCase() === 'notify: office hours',
        ),
        'Requested by user during onboarding',
      )
    },
    getAnswer: messageContents => {
      return /^Great, you'll be notified when Kent's Office Hours start./i.test(
        messageContents,
      )
        ? 'yes'
        : /^No worries, you won't be notified about Kent's Office Hours./.test(
            messageContents,
          )
        ? 'no'
        : null
    },
    validate(response) {
      if (!['yes', 'no'].includes(response.toLowerCase())) {
        return `You must answer "yes" or "no": Would you like to be notified when Kent starts office hours?`
      }
    },
  },
  {
    name: 'avatar',
    question: async answers => {
      let message = `It's more fun here when folks have an avatar. You can go ahead and set yours now 😄`
      try {
        const emailHash = md5(answers.email)
        const image = `https://www.gravatar.com/avatar/${emailHash}?s=128&d=404`
        await memGot(image)
        message = `
${message}

I got this image using your email address with gravatar.com. You can use it for your avatar if you like.

${image}
        `.trim()
      } catch (error) {
        // ignore the error
      }
      return `
${message}

Here's how you set your avatar: https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar-

**When you're finished (or if you'd like to just move on), just say "done"**
      `.trim()
    },
    isQuestionMessage: messageContents =>
      /^Here's how you set your avatar/.test(messageContents),
    feedback: (answers, member) => {
      return member.user.avatar
        ? `Great, thanks for adding your avatar.`
        : `Ok, please do set your avatar later though. It helps keep everything human.`
    },
    shouldSkip: member => Boolean(member.user.avatar),
    getAnswer: messageContents => {
      if (/adding your avatar/i.test(messageContents)) return 'ADDED'
      if (/set your avatar later/i.test(messageContents)) return 'SKIPPED'

      return null
    },
    validate(response) {
      if (response.toLowerCase() !== 'done') {
        return `Reply "done" when you're ready to continue.`
      }
    },
  },
  {
    name: 'finished',
    question: (answers, member) => {
      const introChannel = member.guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('introduction') && type === 'text',
      )
      return `
Looks like we're all done! Go explore!

We'd love to get to know you a bit. Tell us about you in ${introChannel}. Here's a template you can use:

🌐 I'm from:
🏢 I work at:
💻 I work with this tech:
🍎 I snack on:
🤪 I'm unique because:

Enjoy the community!
      `.trim()
    },
    isQuestionMessage: messageContents =>
      /^Looks like we're all done/.test(messageContents),
    validate(messageContent) {
      // there's no valid answer because this is the last step,
      // so we'll just keep saying this forever.
      const message = `We're all done. This channel will get deleted automatically eventually, but if you want to delete it yourself, then say "delete".`
      if (messageContent.toLowerCase().includes('thank')) {
        return `
You're very welcome! Thanks for your gratitude! High five ✋

https://media.giphy.com/media/g3zttGo4Vo2M8/giphy.gif

${message}
        `.trim()
      }
      return message
    },
    getAnswer: () => null,
  },
]

async function getMessageContents(msg, answers, member) {
  if (typeof msg === 'function') {
    const result = await msg(answers, member)
    return result
  } else {
    return msg
  }
}

const getSteps = member => allSteps.filter(s => !s.shouldSkip?.(member))

const getMemberId = channel =>
  channel.topic.match(/\(New Member ID: "(?<memberId>.*?)"\)/)?.groups
    ?.memberId ?? null

function getMember(message) {
  // message must have been sent from the new member
  const memberId = getMemberId(message.channel)
  if (message.author.id !== memberId) return null

  const member = message.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  return member
}

function getAnswers(messages, member) {
  const answers = {}
  for (const message of messages) {
    for (const step of getSteps(member).filter(s => !s.actionOnlyStep)) {
      const answer = step.getAnswer(message.content, member)
      if (answer !== null) {
        answers[step.name] = answer
        break
      }
    }
  }
  return answers
}

function getCurrentStep(steps, answers) {
  return steps
    .filter(s => !s.actionOnlyStep)
    .find(step => !answers.hasOwnProperty(step.name))
}

const getBotMessages = messages =>
  messages.filter(({author, client}) => author.id === client.user.id)

async function handleNewMessage(message) {
  const {channel} = message
  const send = getSend(channel)

  // must be a welcome channel
  if (!channel.name.startsWith(welcomeChannelPrefix)) return

  if (message.content.toLowerCase() === 'delete') {
    return deleteWelcomeChannel(channel, 'Requested by the member')
  }

  // message must have been sent from the new member
  const member = getMember(message)
  if (!member) return

  const steps = getSteps(member)

  const messages = Array.from((await channel.messages.fetch()).values())
  const botMessages = getBotMessages(messages)
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  if (editErrorMessages.length) {
    await send(
      `There are existing errors with your previous answers, please edit your answer above before continuing.`,
    )
    return
  }

  const answers = getAnswers(botMessages, member)

  // find the first step with no answer
  const currentStep = getCurrentStep(steps, answers)

  if (!currentStep) {
    // there aren't any answers yet, so let's send the first feedback
    await send(await getMessageContents(steps[0].feedback, answers, member))
    return
  }

  const currentStepQuestionContent = await getMessageContents(
    currentStep.question,
    answers,
    member,
  )
  const questionHasBeenAsked = botMessages.find(
    ({content}) => currentStepQuestionContent === content,
  )
  if (!questionHasBeenAsked) {
    await send(currentStepQuestionContent)
    return
  }

  const error = currentStep.validate(message.content)
  if (error) {
    await send(error)
    return
  }

  answers[currentStep.name] = message.content
  if (currentStep.feedback) {
    await send(await getMessageContents(currentStep.feedback, answers, member))
  }

  await currentStep.action?.({answers, member, channel, isEdit: false})

  // run action-only steps
  let currentStepIndex = steps.indexOf(currentStep)
  while (steps[currentStepIndex + 1].actionOnlyStep) {
    currentStepIndex = currentStepIndex + 1
    const actionOnlyStep = steps[currentStepIndex]
    // we want these run one at a time, not in parallel
    // eslint-disable-next-line no-await-in-loop
    await actionOnlyStep.action({answers, member, channel, isEdit: false})
  }

  // run next question step without an answer
  const nextStep = steps
    .slice(currentStepIndex + 1)
    .find(step => !answers.hasOwnProperty(step.name))
  if (nextStep) {
    await send(await getMessageContents(nextStep.question, answers, member))
  }
}

async function handleUpdatedMessage(oldMessage, newMessage) {
  const {channel} = newMessage
  const send = getSend(channel)

  // must be a welcome channel
  if (!channel.name.startsWith(welcomeChannelPrefix)) return

  const member = getMember(newMessage)
  if (!member) return

  const steps = getSteps(member)

  const messages = Array.from(
    (await newMessage.channel.messages.fetch()).values(),
  )
  const botMessages = getBotMessages(messages)
  const previousAnswers = getAnswers(botMessages, member)
  const answers = {...previousAnswers}
  const messageAfterEditedMessage = messages[messages.indexOf(newMessage) - 1]
  if (!messageAfterEditedMessage) return

  const editedStep = steps.find(s =>
    s.getAnswer(messageAfterEditedMessage.content, member),
  )
  if (!editedStep) return

  const error = editedStep.validate(newMessage.content)
  if (error) {
    await send(`${editErrorMessagePrefix} ${error}`)
    return
  }

  const promises = []

  // get the error message we printed previously due to any bad edits
  const stepErrorMessage = editedStep.validate(oldMessage.content)
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  const editErrorMessagesToDelete = editErrorMessages.filter(({content}) =>
    content.includes(stepErrorMessage),
  )
  promises.push(
    ...editErrorMessagesToDelete.map(m =>
      m.delete({reason: 'Edit error resolved.'}),
    ),
  )

  answers[editedStep.name] = newMessage.content

  const contentAndMessages = []
  for (const step of steps.filter(s => !s.actionOnlyStep)) {
    contentAndMessages.push(
      [
        // eslint-disable-next-line no-await-in-loop
        await getMessageContents(step.question, answers, member),
        messages.find(msg => {
          if (step.isQuestionMessage) {
            return step.isQuestionMessage(msg.content)
          } else {
            return step.question === msg.content
          }
        }),
      ],
      [
        // eslint-disable-next-line no-await-in-loop
        await getMessageContents(step.feedback, answers, member),
        messages.find(msg => step.getAnswer(msg.content, member)),
        step,
      ],
    )
  }
  for (const [newContent, msg, step] of contentAndMessages) {
    if (msg && msg.content !== newContent) {
      promises.push(
        (async () => {
          await msg.edit(newContent)
          await step?.action?.({
            answers,
            member,
            channel,
            previousAnswers,
            isEdit: true,
          })
        })(),
      )
    }
  }

  await Promise.all(promises)

  if (editErrorMessages.length === editErrorMessagesToDelete.length) {
    const currentStep = steps
      .filter(s => !s.actionOnlyStep)
      .find(step => !answers.hasOwnProperty(step.name))
    if (currentStep) {
      await send(`Thanks for fixing things up, now we can continue.`)
      await send(
        await getMessageContents(currentStep.question, answers, member),
      )
    }
  }
}

async function handleNewMember(member) {
  const {
    user,
    user: {username, discriminator},
  } = member

  const everyoneRole = member.guild.roles.cache.find(
    ({name}) => name === '@everyone',
  )
  const unconfirmedMemberRole = member.guild.roles.cache.find(
    ({name}) => name === 'Unconfirmed Member',
  )

  await member.roles.add(unconfirmedMemberRole, 'New member')

  const allPermissions = Object.keys(Discord.Permissions.FLAGS)

  const welcomeCategory = member.guild.channels.cache.find(
    ({type, name}) =>
      type === 'category' && name.toLowerCase().includes('welcome'),
  )

  const channel = await member.guild.channels.create(
    `${welcomeChannelPrefix}${username}_${discriminator}`,
    {
      topic: `Membership application for ${username}#${discriminator} (New Member ID: "${member.id}")`,
      reason: `To allow ${username}#${discriminator} to apply to join the community.`,
      parent: welcomeCategory,
      permissionOverwrites: [
        {
          type: 'role',
          id: everyoneRole.id,
          deny: allPermissions,
        },
        {
          type: 'member',
          id: member.id,
          allow: [
            'ADD_REACTIONS',
            'VIEW_CHANNEL',
            'SEND_MESSAGES',
            'SEND_TTS_MESSAGES',
            'READ_MESSAGE_HISTORY',
            'CHANGE_NICKNAME',
          ],
        },
        {
          type: 'member',
          id: member.client.user.id,
          allow: allPermissions,
        },
      ],
    },
  )
  const send = getSend(channel)

  await send(
    `
Hello ${user} 👋

I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`${username}#${discriminator}\`) and we'll get things fixed up for you.

(Note, if you make a mistake, you can edit your responses).

In less than 5 minutes, you'll have full access to this server. So, let's get started! Here's the first question:
    `.trim(),
  )

  await send(getSteps(member)[0].question)
}

async function deleteWelcomeChannel(channel, reason) {
  const send = getSend(channel)
  const memberId = getMemberId(channel)
  const member = channel.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  const memberIsUnconfirmed =
    !member ||
    member.roles.cache.find(({name}) => name === 'Unconfirmed Member')
  await send(
    `
This channel is getting deleted for the following reason: ${reason}

Goodbye 👋
    `.trim(),
  )
  const promises = []
  if (memberIsUnconfirmed && member) {
    await send(
      `You're still an unconfirmed member so you'll be kicked from the server. But don't worry, you can try again later.`,
    )
    promises.push(
      member.kick(
        `Unconfirmed member with welcome channel deleted because: ${reason}`,
      ),
    )
  } else {
    // if they reacted with their preferred tech, update their info in convertkit
    // to reflect those preferences
    const messages = Array.from((await channel.messages.fetch()).values())
    const reactionMessage = getBotMessages(messages).find(({content}) =>
      /Click the icon of the tech/.test(content),
    )
    if (reactionMessage) {
      const interests = reactionMessage.reactions.cache
        // because the new member is the only one in the channel, the only
        // way we could have more than 1 reaction to a message is if the bot
        // listed it as an option AND the member selected it.
        // doing things this way helps us avoid having to call
        // `await reaction.users.fetch()` for every reaction
        .filter(({count}) => count > 1)
        .map(({emoji}) => emoji.name)
        // sort alphabetically
        .sort((a, z) => (a < z ? -1 : a > z ? 1 : 0))
        .join(',')

      if (interests.length) {
        const botMessages = getBotMessages(messages)
        const answers = getAnswers(botMessages, member)

        promises.push(
          (async () => {
            const {body: {subscribers: [subscriber] = []} = {}} = await got(
              getSubscriberEndpoint(answers.email),
              {
                responseType: 'json',
              },
            )

            try {
              await got.put(
                `https://api.convertkit.com/v3/subscribers/${subscriber.id}`,
                {
                  responseType: 'json',
                  json: {
                    api_key: CONVERT_KIT_API_KEY,
                    api_secret: CONVERT_KIT_API_SECRET,
                    fields: {tech_interests: interests},
                  },
                },
              )
            } catch (error) {
              // possibly a 404 because the subscriber was deleted
              console.error(
                `Error setting the subscriber's interests: `,
                {
                  interests,
                  subscriberId: subscriber.id,
                  memberId: member?.id,
                },
                error.message,
              )
            }
          })(),
        )
      }
    }
  }

  await Promise.all(promises)

  // wait for 5 seconds so folks can read the messages before it's deleted
  await sleep(5000)
  await channel.delete(reason)
}

const getWelcomeChannels = guild =>
  guild.channels.cache.filter(({name}) => name.startsWith(welcomeChannelPrefix))

const isMemberUnconfirmed = member => {
  return member.roles.cache.some(({name}) => {
    return name === 'Unconfirmed Member'
  })
}

const getMemberWelcomeChannel = member =>
  getWelcomeChannels(member.guild).find(
    channel => getMemberId(channel) === member.id,
  )

async function cleanup(guild) {
  const maxWaitingTime = 1000 * 60 * 10
  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted and you'll be removed from the server after a while. Don't worry though, you can always try again later when you have time to finish: https://kcd.im/discord`
  const spamWarningMessageContent = `you're sending a lot of messages, this channel will get deleted automatically if you send too many.`
  // prime the cache
  await guild.members.fetch()

  const welcomeChannels = getWelcomeChannels(guild)
  const homelessUnconfirmedMembersKicks = guild.members.cache
    .filter(isMemberUnconfirmed)
    .filter(member => !getMemberWelcomeChannel(member))
    .mapValues(member =>
      member.kick(`Unconfirmed member with no welcome channel`),
    )
  const oldMembersKicks = guild.members.cache
    .filter(
      // no roles and joined over a minute ago
      ({roles, joinedAt}) =>
        !roles.cache.size && joinedAt < Date.now() - 1000 * 60,
    )
    .mapValues(member => member.kick(`Old member with no roles`))

  const channelDeletes = welcomeChannels.mapValues(channel => {
    const send = getSend(channel)
    return (async () => {
      // load all the messages so we can get the last message
      await Promise.all([channel.messages.fetch(), channel.fetch()])

      const {lastMessage} = channel

      const memberId = getMemberId(channel)
      const member = guild.members.cache.find(({user}) => user.id === memberId)

      // somehow the member is gone (maybe they left the server?)
      // delete the channel
      if (!member || !lastMessage) {
        await deleteWelcomeChannel(
          channel,
          'Member is not in the server anymore. May have left the server.',
        )
        return
      }

      // if they're getting close to too many messages, give them a warning
      if (channel.messages.cache.size > tooManyMessages * 0.7) {
        const hasWarned = channel.messages.cache.find(({content}) =>
          content.includes(spamWarningMessageContent),
        )
        if (!hasWarned) {
          await send(`Whoa ${member?.user}, ${spamWarningMessageContent}`)
        }
      }

      if (channel.messages.cache.size > tooManyMessages) {
        // they sent way too many messages... Spam probably...
        return deleteWelcomeChannel(channel, 'Too many messages')
      }

      if (lastMessage.author.id === member.id) {
        // they sent us something and we haven't responded yet
        // this happens if the bot goes down for some reason (normally when we redeploy)
        const timeSinceLastMessage = new Date() - lastMessage.createdAt
        if (timeSinceLastMessage > 6 * 1000) {
          // if it's been six seconds and we haven't handled the last message
          // then let's handle it now.
          await handleNewMessage(lastMessage)
        }
      } else {
        // we haven't heard from them in a while...
        const timeSinceLastMessage = new Date() - lastMessage.createdAt
        if (timeSinceLastMessage > maxWaitingTime) {
          return deleteWelcomeChannel(channel, 'Onboarding timed out')
        } else if (timeSinceLastMessage > maxWaitingTime * 0.7) {
          if (
            !lastMessage.content.includes(timeoutWarningMessageContent) &&
            isMemberUnconfirmed(member)
          ) {
            return send(`Hi ${member.user}, ${timeoutWarningMessageContent}`)
          }
        }
      }
    })()
  })

  await Promise.all([
    ...channelDeletes,
    ...homelessUnconfirmedMembersKicks,
    ...oldMembersKicks,
  ])
}

module.exports = {
  handleNewMember,
  handleNewMessage,
  handleUpdatedMessage,
  cleanup,
}

/*
eslint
  no-console: "off",
  consistent-return: "off",
  max-statements: ["error", 150],
  complexity: ["error", 20]
*/
