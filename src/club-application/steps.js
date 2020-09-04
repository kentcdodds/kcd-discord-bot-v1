const {getSend, finalMessage} = require('./utils')

function getActiveClubMessage(answers, member) {
  return `
📝 Club looking for members: ${answers.name}

**Club Captain:** ${member.user}

**Learning Goal Summary:** ${answers.summary}

**Club Meeting Time:** <${answers.meetingTimeLink}>

**Club Registration Form:** <${answers.registrationForm}>

If you can't make that meeting time, then feel free to start your own club with the same registration. Learn more here: <https://kcd.im/clubs>
  `.trim()
}

const allSteps = [
  {
    name: 'name',
    question: `What's the name of your club?`,
    feedback: answers => `Awesome, your club name is ${answers.name} 👍`,
    getAnswer: messageContents =>
      messageContents.match(/^Awesome, your club name is (.*?) 👍/)?.[1] ??
      null,
    validate(response) {
      if (response.toLowerCase().includes('club')) {
        return `Club names do not need the word "club" in them. It's a bit redundant 😅. Try again please.`
      }
      if (response.length < 1) {
        return `That's too short. Please give me a longer club name.`
      }
      if (response.length > 30) {
        return `That's too long. Please give me a shorter club name.`
      }
    },
  },
  {
    name: 'summary',
    question: `What's a 150 character summary of the learning goal of your club?`,
    feedback: answers =>
      `Great, here's what I got for your learning goal summary:\n\n> ${answers.summary}`,
    getAnswer: messageContents =>
      messageContents.match(/learning goal summary:\n\n> (.+)$/)?.[1] ?? null,
    validate(response) {
      if (response.includes('\n')) {
        return `Newline characters aren't allowed in club summaries. It should all be on one line.`
      }
      if (response.length < 10) {
        return `That's too short, please be more specific.`
      }
      if (response.length > 150) {
        return `That's too long, please be more succinct.`
      }
    },
  },
  {
    name: 'registrationForm',
    question: `
Please give me a link to your **club registration form**.

If you don't have one yet, reply with "I don't have one".
    `.trim(),
    feedback: answers => {
      return `Super, I'll use <${answers.registrationForm}> when I let people know about this awesome new club!`
    },
    getAnswer: messageContents => {
      const groups = messageContents.match(
        /^Super, I'll use <(?<registrationForm>\S+?)> when I let people know/i,
      )?.groups
      if (groups) {
        return groups.registrationForm
      }
      return null
    },
    validate: async response => {
      if (response.toLowerCase().includes(`i don't have one`)) {
        return `Ok, you can't start a club before you have a registration form, so learn more about how to create one from <https://kentcdodds.com/clubs#registration-form>, then come back and try again.`
      }
      try {
        if (new URL(response).hostname === 'docs.google.com') return
        // short URLs are ok
        if (new URL(response).hostname === 'forms.gle') return
      } catch {
        // ignore
      }
      return `Sorry, I couldn't verify the existance of that as a Google Form. Please make sure you're providing a publicly accessible Google Form.`
    },
  },
  {
    name: 'meetingTimeLink',
    question: `
When will your club meet each week?

Please go to <https://everytimezone.com> and drag the line to the day of the week and time of day when you're club will meet. Then give me that link.
    `.trim(),
    feedback: answers =>
      `Ok, I'll let people know of the time using <${answers.meetingTimeLink}>`,
    getAnswer: messageContents =>
      messageContents.match(/know of the time using <(.+?)>$/)?.[1] ?? null,
    validate(response) {
      try {
        if (new URL(response).hostname === 'everytimezone.com') return
      } catch {
        // ignore
      }
      return `Sorry, that doesn't look like an everytimezone.com link.`
    },
  },
  {
    name: 'confirm',
    question: (answers, member) =>
      `
Once we're finished, I'll add your club to the list of active clubs with the following message:

---------------

${getActiveClubMessage(answers, member)}

---------------

This post will be **automatically deleted** after _one week_. If you are still looking for new members after that time, feel free to do this again. If your club fills up and you want the message removed, simply add a 🏁 reaction to it, and I'll delete it.

**Is everything correct? If not, please edit your responses above. When everything's ready, simply reply "yes"**.
    `.trim(),
    isQuestionMessage: messageContents =>
      /^Here are your answers/.test(messageContents),
    feedback: `Awesome, let's get this thing rolling!`,
    getAnswer: messageContents =>
      /^Awesome, let's get this thing rolling/.test(messageContents)
        ? true
        : null,
    validate(response) {
      if (response.toLowerCase() !== 'yes') {
        return `Feel free to edit any of the answers where you gave them above. Reply "yes" when we're good to go.`
      }
    },
    action: async ({answers, member, channel}) => {
      const send = getSend(channel)

      const activeClubsChannel = member.guild.channels.cache.find(
        ({name, type}) =>
          name.toLowerCase().includes('active-clubs') && type === 'text',
      )
      const taskMessage = await send(
        `Notifying everyone in ${activeClubsChannel}`,
      )
      await getSend(activeClubsChannel)(getActiveClubMessage(answers, member))
      await taskMessage.react('✅')

      await send(
        `
Ok ${member.user}, we're all good to go! Please prepare to accept member's friend requests and registrations and add them to a Group DM (learn more: <https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls>)

${finalMessage}
        `.trim(),
      )
    },
  },
]

const getSteps = member => allSteps.filter(s => !s.shouldSkip?.(member))

function getAnswers(messages, member) {
  const answers = {}
  for (const message of messages) {
    for (const step of getSteps(member).filter(s => !s.actionOnlyStep)) {
      const answer = step.getAnswer(message.content, member)
      if (answer != null) {
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

module.exports = {
  allSteps,
  getAnswers,
  getCurrentStep,
  getSteps,
}
