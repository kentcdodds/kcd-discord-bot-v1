const got = require('got')
const redent = require('redent')
const {getSend, finalMessage} = require('./utils')

const httpify = link => (link.startsWith('http') ? link : `https://${link}`)

function getActiveClubMessage(answers, member) {
  return `
🎊 New club looking for members 🎉

**Club Name:** ${answers.name}

**Club Curriculum:** ${answers.curriculumLink}

**Club Captain:** ${member.user}

**Learning Goal Summary:** ${answers.summary}

**Club Schedule:**
${redent(answers.schedule, 6)}

**Club Registration Form:** <${answers.registrationForm}>

If this schedule doesn't work well for you, then feel free to start your own club with the same registration. Learn more here: <https://kcd.im/clubs>
  `.trim()
}

const allSteps = [
  {
    name: 'curriculumLink',
    question: `Please give me a link to the curriculum you plan to go through with this club.`,
    feedback: answers => {
      return `Nice, I'll tell people about this awesome curriculum: <${httpify(
        answers.curriculumLink,
      )}>`
    },
    getAnswer: messageContents =>
      messageContents.match(/awesome curriculum: <(?<curriculumLink>\S+?)>/i)
        ?.groups?.curriculumLink ?? null,
    validate: async ({message}) => {
      let url
      try {
        url = new URL(httpify(message.content))
      } catch {
        return `Sorry, I don't think that's a URL. Please provide a link to the course/github repo/book/etc. your group plans to go through.`
      }
      try {
        const res = await got.head(url)
        if (res.statusCode === 200) return
      } catch {
        // ignore
      }
      return `Sorry, I couldn't verify that link is is accepting traffic. It doesn't respond with a status code of success (HTTP code 200) when I ping it with a HEAD request.`
    },
  },
  {
    name: 'name',
    question: `What's the name of your club?`,
    feedback: answers => `Awesome, your club name is ${answers.name} 👍`,
    getAnswer: messageContents =>
      messageContents.match(/^Awesome, your club name is (.*?) 👍/)?.[1] ??
      null,
    validate({message}) {
      const response = message.content
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
    validate({message}) {
      const response = message.content
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
    validate: async ({message}) => {
      const response = message.content
      if (response.toLowerCase().includes(`i don't have one`)) {
        return `Ok, you can't start a club before you have a registration form, so learn more about how to create one from <https://kentcdodds.com/clubs#joining-or-starting-a-learning-club>, then come back and try again.`
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
    name: 'schedule',
    question: `
What's your club schedule?

Please make sure to include a time and timezone if you're planning on having meetings.

Your registration form should probably have this in it, so you should be able to copy/paste it from there.

Find good example schedules here: <https://kentcdodds.com/clubs#example-schedules>
    `.trim(),
    feedback: answers =>
      `Fantastic, here's what I'll say about the schedule:\n\n${
        answers.schedule?.trim() ?? ''
      }`,
    getAnswer(messageContents) {
      // I could use regex with the "s" flag, but VSCode syntax highlighting didn't
      // like that... And... I'm enough of a slave of my tools that I rewrote the code
      // so I don't have to deal wit that... 😭
      if (!messageContents.includes('know about the schedule:')) return
      return messageContents.slice('schedule:\n\n')[1].trim()
    },
    validate({message}) {
      const response = message.content
      if (response.toLowerCase().startsWith('check the registration form')) {
        return
      }
      if (message.attachments.size > 0) {
        return `Looks like you have a big schedule! That's great. Unfortuantely we can't show that to folks, so instead, either make it shorter or reply with \`Check the registration form\``
      }
      if (!response.includes('\n')) {
        return `Your schedule doesn't include newlines... It's probably not thorough enough.`
      }
      if (response.length < 100) {
        return `That's too short, please make your schedule more thorough.`
      }
      if (response.length > 1500) {
        return `That's too long. If your schedule is really long, then reply: \`Check the registration form\``
      }
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
    validate({message}) {
      const response = message.content
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
