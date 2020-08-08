const Discord = require('discord.js')
const got = require('got')

const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const steps = [
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
  },
  {
    name: 'email',
    question: `What's your email address? (This will add you to Kent's mailing list. You will receive a confirmation email.)`,
    feedback: answers =>
      `Awesome, when we're done here, you'll receive a confirmation email to: ${answers.email}.`,
    getAnswer: messageContents =>
      messageContents.match(/^Awesome.*confirmation email to: (.*?)\.$/)?.[1] ??
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
    question: `What's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).`.trim(),
    feedback: `That's right!`,
    getAnswer: messageContents =>
      /^That's right.$/.test(messageContents) ? true : null,
    validate(response) {
      if (response.toLowerCase() !== 'team@kentcdodds.com') {
        return `That's not right. Please open the code of conduct to find out. We take our code of conduct seriously. Thanks!`
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

If you'd like to change any, simply edit your response. **If everything's correct, simply reply "yes"**.
    `.trim(),
    isQuestionMessage: messageContents =>
      /^Here are your answers/.test(messageContents),
    feedback: `Awesome, welcome to the KCD Community on Discord!`,
    getAnswer: messageContents =>
      /^Awesome, welcome to the KCD/.test(messageContents) ? true : null,
    action: async (answers, message) => {
      const memberRole = message.guild.roles.cache.find(
        ({name}) => name === 'Member',
      )
      const unconfirmedMemberRole = message.guild.roles.cache.find(
        ({name}) => name === 'Unconfirmed Member',
      )

      const member = message.guild.members.cache.find(
        ({user}) => user.id === message.author.id,
      )

      await member.roles.remove(unconfirmedMemberRole)
      await member.roles.add(memberRole, 'New confirmed member')
      const {body} = await got.post(
        'https://app.convertkit.com/forms/1547100/subscriptions',
        {
          responseType: 'json',
          json: {
            first_name: answers.name,
            email_address: answers.email,
          },
        },
      )
      if (body.status === 'quarantined') {
        message.channel.send(
          `
Please verify your humanity here: ${body.url}

Once you've done that, then you should be good to go! Enjoy the community!

You can delete this channel by sending the word \`delete\`.
          `.trim(),
        )
      } else {
        message.channel.send(
          `
You should be good to go now. Don't forget to check ${answers.email} for a confirmation email. Thanks and enjoy the community!

This channel will self-destruct in 10 seconds...
          `.trim(),
        )
        await new Promise(resolve =>
          setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : 5000),
        )
        await message.channel.delete()
      }
    },
    validate(response) {
      if (response.toLowerCase() !== 'yes') {
        return `Feel free to edit any of the answers. Reply "yes" when we're good to go.`
      }
    },
  },
]

const getMessageContents = (msg, answers) =>
  typeof msg === 'function' ? msg(answers) : msg

function getAnswers(messages) {
  const answers = {}
  for (const message of messages) {
    for (const step of steps) {
      const answer = step.getAnswer(message.content)
      if (answer !== null) {
        answers[step.name] = answer
        break
      }
    }
  }
  return answers
}

async function handleNewMessage(message) {
  if (!message.channel.name.startsWith('👋-welcome-')) return
  if (message.author.id === message.client.user.id) return

  const member = message.guild.members.cache.find(
    ({user}) => user.id === message.author.id,
  )

  if (message.content === 'delete') {
    const isUnconfirmed = !!member.roles.cache.find(
      ({name}) => name === 'Unconfirmed Member',
    )
    const promises = [message.channel.delete()]
    if (isUnconfirmed) {
      promises.push(
        member.kick('Unconfirmed member deleted the onboarding channel.'),
      )
    }
    return Promise.all(promises)
  }

  const messages = Array.from((await message.channel.messages.fetch()).values())
  const botMessages = Array.from(messages).filter(
    ({author}) => author.id === message.client.user.id,
  )
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  if (editErrorMessages.length) {
    await message.channel.send(
      `There are existing errors with your previous answers, please edit your answer above before continuing.`,
    )
    return
  }

  const answers = getAnswers(botMessages)

  const currentStep = steps.find(step => !answers.hasOwnProperty(step.name))

  if (!currentStep) {
    await message.channel.send(getMessageContents(steps[0].feedback, answers))
    return
  }

  const currentStepQuestionContent = getMessageContents(
    currentStep.question,
    answers,
  )
  const questionHasBeenAsked = botMessages.find(
    ({content}) => currentStepQuestionContent === content,
  )
  if (!questionHasBeenAsked) {
    await message.channel.send(currentStepQuestionContent)
    return
  }

  const error = currentStep.validate(message.content)
  if (error) {
    await message.channel.send(error)
    return
  }

  answers[currentStep.name] = message.content
  if (currentStep.feedback) {
    await message.channel.send(
      getMessageContents(currentStep.feedback, answers),
    )
  }
  if (currentStep.action) {
    await currentStep.action(answers, message)
  }

  const nextStep = steps[steps.indexOf(currentStep) + 1]
  if (nextStep) {
    await message.channel.send(getMessageContents(nextStep.question, answers))
  }
}

async function handleUpdatedMessage(oldMessage, newMessage) {
  if (!newMessage.channel.name.startsWith('👋-welcome-')) return
  if (newMessage.author.id === newMessage.client.user.id) return

  const messages = Array.from(
    (await newMessage.channel.messages.fetch()).values(),
  )
  const botMessages = Array.from(messages).filter(
    ({author}) => author.id === newMessage.client.user.id,
  )
  const answers = getAnswers(botMessages)
  const messageAfterEditedMessage = messages[messages.indexOf(newMessage) - 1]
  if (!messageAfterEditedMessage) return

  const editedStep = steps.find(s =>
    s.getAnswer(messageAfterEditedMessage.content),
  )
  if (!editedStep) return

  const error = editedStep.validate(newMessage.content)
  if (error) {
    await newMessage.channel.send(`${editErrorMessagePrefix} ${error}`)
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
  promises.push(...editErrorMessagesToDelete.map(m => m.delete()))

  answers[editedStep.name] = newMessage.content

  const contentAndMessages = []
  for (const step of steps) {
    contentAndMessages.push(
      [
        getMessageContents(step.question, answers),
        messages.find(msg => {
          if (step.isQuestionMessage) {
            return step.isQuestionMessage(msg.content)
          } else {
            return step.question === msg.content
          }
        }),
      ],
      [
        getMessageContents(step.feedback, answers),
        messages.find(msg => step.getAnswer(msg.content)),
      ],
    )
  }
  for (const [newContent, msg] of contentAndMessages) {
    if (msg && msg.content !== newContent) {
      promises.push(msg.edit(newContent))
    }
  }

  if (editErrorMessages.length === editErrorMessagesToDelete.length) {
    const currentStep = steps.find(step => !answers.hasOwnProperty(step.name))
    if (currentStep) {
      promises.push(
        newMessage.channel
          .send(`Thanks for fixing things up, now we can continue.`)
          .then(() => {
            newMessage.channel.send(
              getMessageContents(currentStep.question, answers),
            )
          }),
      )
    }
  }

  await Promise.all(promises)
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
    `👋-welcome-${username}_${discriminator}`,
    {
      topic: `Membership application for ${username}#${discriminator}`,
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

  await channel.send(
    `
Hello ${user} 👋

I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`${username}#${discriminator}\`) and we'll get things fixed up for you.

So, let's get started...
      `.trim(),
  )
  await channel.send(steps[0].question)
}

async function cleanup(guild) {
  const maxWaitingTime = 1000 * 60 * 30
  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted after a while.`
  const spamWarningMessageContent = `you're sending a lot of messages, this channel will get deleted automatically if you send too many.`
  const asyncStuff = guild.channels.cache
    .filter(({name}) => name.startsWith('👋-welcome-'))
    .mapValues(channel => {
      return (async () => {
        // load all the messages so we can get the last message
        await Promise.all([channel.messages.fetch(), channel.fetch()])

        const {lastMessage, client, members} = channel

        const unconfirmedMember = members.find(({roles}) =>
          roles.cache.find(({name}) => name === 'Unconfirmed Member'),
        )

        // if they're getting close to too many messages, give them a warning
        if (channel.messages.cache.size > tooManyMessages * 0.7) {
          const hasWarned = channel.messages.cache.find(({content}) =>
            content.includes(spamWarningMessageContent),
          )
          if (!hasWarned && unconfirmedMember) {
            await channel.send(
              `Whoa ${unconfirmedMember.user}, ${spamWarningMessageContent}`,
            )
          }
        }

        if (channel.messages.cache.size > tooManyMessages) {
          // they sent way too many messages... Spam probably...
          const promises = [channel.delete()]
          if (unconfirmedMember) {
            promises.push(unconfirmedMember.kick('Too many messages'))
          }
          return Promise.all(promises)
        }

        if (lastMessage.author.id === client.user.id) {
          // we haven't heard from them in a while...
          const timeSinceLastMessage = new Date() - lastMessage.createdAt
          if (timeSinceLastMessage > maxWaitingTime) {
            const promises = [channel.delete()]
            if (unconfirmedMember) {
              promises.push(unconfirmedMember.kick('Onboarding timed out'))
            }
            return Promise.all(promises)
          } else if (timeSinceLastMessage > maxWaitingTime * 0.7) {
            if (
              !lastMessage.content.includes(timeoutWarningMessageContent) &&
              unconfirmedMember
            ) {
              return channel.send(
                `Hi ${unconfirmedMember.user}, ${timeoutWarningMessageContent}`,
              )
            }
          }
        }
      })()
    })
  await Promise.all(asyncStuff)
}

module.exports = {
  handleNewMember,
  handleNewMessage,
  handleUpdatedMessage,
  cleanup,
}

/*
eslint
  consistent-return: "off",
*/
