const got = require('got')
const pMemoize = require('p-memoize')
const {default: md5} = require('md5-hash')
const {
  getSubscriberEndpoint,
  getSend,
  CONVERT_KIT_API_KEY,
  CONVERT_KIT_API_SECRET,
  sleep,
} = require('./utils')

const memGot = pMemoize(got, {
  // five minutes
  maxAge: 1000 * 60 * 5,
})

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
    validate({message}) {
      const response = message.content
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
        const previousNickname = member.nickname ?? member.user.username
        if (previousNickname === answers.name) {
          return
        }
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
    question: `What's your email address? (This will look you up on Kent's mailing list. If you're not already on it, you'll be added and will receive a confirmation email.)`,
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
    validate({message}) {
      const response = message.content
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
    validate({message}) {
      const response = message.content
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
    validate({message, answers}) {
      const response = message.content
      const sameEmail =
        response === answers.email
          ? `Please note, I'm not looking for *your* email address again. I'm looking for the email address that's listed in the code of conduct`
          : ''
      if (!response.toLowerCase().includes('team@kentcdodds.com')) {
        const mainMessage = `That's not right. **I'm testing you to make sure you actually opened the code of conduct**. Please **open the code of conduct** and copy/paste the email address listed under the heading "Have questions/need to report an issue?" We take our code of conduct seriously, so I want to make sure you've opened it. Thanks!`
        const openCoc = `Now, please open <https://kentcdodds.com/conduct> and copy/paste the email address that's listed on that page.`
        return [mainMessage, sameEmail, openCoc].filter(Boolean).join('\n\n')
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
              // It would make sense to include the tag here, however, doing this
              // will auto-confirm this new subscriber (no double-opt-in) which
              // we do not want to do. Luckily, the discordForm adds this tag
              // automatically so we don't need it anyway.
              // tags: [discordTagId],
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
👆 that's Kent!

I'm a pretty neat bot. Learn more about what commands you can give me by sending \`?help\`.

━━━━━━━━━━━━━━━━━━━━

**If you wanna hang out here for a bit longer, I have a few questions that will help you get set up in this server a bit more.**
        `.trim()

        await send(`\n\n${moreStuffMessage}`)
      }
    },
    validate({message}) {
      const response = message.content
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
    validate({message}) {
      const response = message.content
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

      return `Would you like to be notified when Kent starts <https://kcd.im/office-hours> in ${officeHoursChannel}?`
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
    validate({message}) {
      const response = message.content
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

Here's how you set your avatar: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

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
    shouldSkip: member => Boolean(member?.user.avatar),
    getAnswer: messageContents => {
      if (/adding your avatar/i.test(messageContents)) return 'ADDED'
      if (/set your avatar later/i.test(messageContents)) return 'SKIPPED'

      return null
    },
    validate({message}) {
      const response = message.content
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
🤪 I really enjoy:

Enjoy the community!
      `.trim()
    },
    isQuestionMessage: messageContents =>
      /^Looks like we're all done/.test(messageContents),
    validate({message}) {
      // there's no valid answer because this is the last step,
      // so we'll just keep saying this forever.
      const response = `We're all done. This channel will get deleted automatically eventually, but if you want to delete it yourself, then say "delete".`
      if (message.content.toLowerCase().includes('thank')) {
        return `
You're very welcome! Thanks for your gratitude! High five ✋

https://media.giphy.com/media/g3zttGo4Vo2M8/giphy.gif

${response}
        `.trim()
      }
      return response
    },
    getAnswer: () => null,
  },
]

const getSteps = member => allSteps.filter(s => !s.shouldSkip?.(member))

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

module.exports = {
  allSteps,
  getAnswers,
  getCurrentStep,
  getSteps,
}
