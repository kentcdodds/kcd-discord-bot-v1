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
    question: `Based on what you read in the Code of Conduct, what's the email address you send Code of Conduct concerns and violations to? (If you're not sure, open the code of conduct to find out).`.trim(),
    feedback: `That's right!`,
    getAnswer: messageContents =>
      /^That's right.$/.test(messageContents) ? true : null,
    validate(response) {
      if (response.toLowerCase() !== 'team@kentcdodds.com') {
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

If you'd like to change any, simply edit your response. **If everything's correct, simply reply "yes"**.
    `.trim(),
    isQuestionMessage: messageContents =>
      /^Here are your answers/.test(messageContents),
    feedback: `Awesome, welcome to the KCD Community on Discord!`,
    getAnswer: messageContents =>
      /^Awesome, welcome to the KCD/.test(messageContents) ? true : null,
    action: async (answers, member, channel) => {
      const {guild} = member

      const memberRole = guild.roles.cache.find(({name}) => name === 'Member')
      const unconfirmedMemberRole = guild.roles.cache.find(
        ({name}) => name === 'Unconfirmed Member',
      )

      const introChannel = guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('introduction') && type === 'text',
      )
      const botsChannel = guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('bots-only') && type === 'text',
      )

      const recommendations = `
Here are a few things I recommend you spend a second doing:

1. Update your nickname to your actual name (type this: \`/nick Your Name\`)
2. Update your avatar to a picture of you
3. Tell us about you in ${introChannel}. Here's a template you can use:

🌐 I'm from:
🏢 I work at:
💻 I work with this tech:
🍎 I snack on:
🤪 I'm unique because:

4. Check out ${botsChannel} to opt-into notifications for when Kent's streaming or doing Office Hours.
5. Enjoy the community!
      `.trim()

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
        channel.send(
          `
Please verify your humanity here: ${body.url}

Once you've done that, then you should be good to go!

${recommendations}

This channel will get deleted automatically eventually, but you can delete this channel now by sending the word \`delete\`.
          `.trim(),
        )
      } else {
        channel.send(
          `
You should be good to go now. Don't forget to check ${answers.email} for a confirmation email. Thanks and enjoy the community!

${recommendations}

This channel will get deleted automatically eventually, but you can delete this channel now by sending the word \`delete\`.
          `.trim(),
        )
      }
    },
    validate(response) {
      if (response.toLowerCase() !== 'yes') {
        return `Feel free to edit any of the answers. Reply "yes" when we're good to go.`
      }
    },
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
  const {channel} = message

  // must be a welcome channel
  if (!channel.name.startsWith('👋-welcome-')) return

  // message must have been sent from the new member
  const {memberId} =
    channel.topic.match(/\(New Member ID: "(?<memberId>.*?)"\)/)?.groups ?? {}
  if (message.author.id !== memberId) return

  const member = message.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  if (message.content.toLowerCase() === 'delete') {
    const isUnconfirmed = !!member.roles.cache.find(
      ({name}) => name === 'Unconfirmed Member',
    )
    const promises = [channel.delete()]
    if (isUnconfirmed) {
      promises.push(
        member.kick('Unconfirmed member deleted the onboarding channel.'),
      )
    }
    return Promise.all(promises)
  }

  const messages = Array.from((await channel.messages.fetch()).values())
  const botMessages = Array.from(messages).filter(
    ({author}) => author.id === message.client.user.id,
  )
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  if (editErrorMessages.length) {
    await channel.send(
      `There are existing errors with your previous answers, please edit your answer above before continuing.`,
    )
    return
  }

  const answers = getAnswers(botMessages)

  const currentStep = steps.find(step => !answers.hasOwnProperty(step.name))

  if (!currentStep) {
    await channel.send(await getMessageContents(steps[0].feedback, answers))
    return
  }

  const currentStepQuestionContent = await getMessageContents(
    currentStep.question,
    answers,
  )
  const questionHasBeenAsked = botMessages.find(
    ({content}) => currentStepQuestionContent === content,
  )
  if (!questionHasBeenAsked) {
    await channel.send(currentStepQuestionContent)
    return
  }

  const error = currentStep.validate(message.content)
  if (error) {
    await channel.send(error)
    return
  }

  answers[currentStep.name] = message.content
  if (currentStep.feedback) {
    await channel.send(await getMessageContents(currentStep.feedback, answers))
  }
  if (currentStep.action) {
    await currentStep.action(answers, member, message.channel)
  }

  const nextStep = steps[steps.indexOf(currentStep) + 1]
  if (nextStep) {
    await message.channel.send(
      await getMessageContents(nextStep.question, answers),
    )
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
        // eslint-disable-next-line no-await-in-loop
        await getMessageContents(step.question, answers),
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
        await getMessageContents(step.feedback, answers),
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
          .then(async () => {
            newMessage.channel.send(
              await getMessageContents(currentStep.question, answers),
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

  await channel.send(
    `
Hello ${user} 👋

I'm a bot and I'm here to welcome you to the KCD Community on Discord! Before you can join in the fun, I need to ask you a few questions. If you have any trouble, please email team@kentcdodds.com with your discord username (\`${username}#${discriminator}\`) and we'll get things fixed up for you.

(Note, if you make a mistake, you can edit your responses).

So, let's get started. Here's the first question (of ${steps.length}):
      `.trim(),
  )

  // wait a brief moment because sometimes the first message happens *after* the second
  await new Promise(resolve =>
    setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : 500),
  )

  await channel.send(steps[0].question)
}

async function cleanup(guild) {
  const maxWaitingTime = 1000 * 60 * 30
  const tooManyMessages = 100
  const timeoutWarningMessageContent = `it's been a while and I haven't heard from you. This channel will get automatically deleted and you'll be removed from the server after a while. Don't worry though, you can always try again later when you have time to finish: https://kcd.im/discord`
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
