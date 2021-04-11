import type * as TDiscord from 'discord.js'
import got from 'got'
import mem from 'mem'
import md5 from 'md5-hash'
import nodeUrl from 'url'
import {
  getSubscriberEndpoint,
  getSend,
  CONVERT_KIT_API_KEY,
  CONVERT_KIT_API_SECRET,
  VERIFIER_API_KEY,
  sleep,
  getChannel,
  typedBoolean,
  isRegularStep,
  RegularStep,
  rollbar,
} from './utils'
import type {Answers, Step} from './utils'

const {URL} = nodeUrl

const memGot = mem(got, {
  // five minutes
  maxAge: 1000 * 60 * 5,
})

async function getConvertKitSubscriber(email: string) {
  const url = getSubscriberEndpoint(email)

  const {
    body: {subscribers: [subscriber = {state: 'inactive'}] = []} = {},
  } = await memGot(url.toString(), {responseType: 'json'})

  return subscriber.state === 'active' ? subscriber : null
}

const firstStep: RegularStep = {
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
      const newNickname = previousNickname.includes('🚀')
        ? `${answers.name} 🚀`
        : answers.name ?? ''
      await member.setNickname(newNickname, 'Set during onboarding')
      await send(
        `_I've changed your nickname on this server to ${answers.name}. If you'd like to change it back then type: \`/nick ${previousNickname}\`_`,
      )
    } catch (error: unknown) {
      // not sure when this would fail, but if it does, it's not a huge deal.
      // So let's just keep going.
      // it failed on me locally so... 🤷‍♂️
      rollbar.error(
        `Failed setting a nickname for ${member.id}:`,
        (error as Error).message,
      )
    }
  },
}

const allSteps: ReadonlyArray<Step> = [
  firstStep,
  {
    name: 'email',
    question: `What's your email address? (This will look you up on Kent's mailing list. If you're not already on it, you'll be added and will receive a confirmation email.)`,
    feedback: async answers => {
      if (answers.email && (await getConvertKitSubscriber(answers.email))) {
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
    validate: async ({message}) => {
      const response = message.content
      if (!/^.+@.+\..+$/.test(response)) {
        return `That doesn't look like an email address. Please provide a proper email address.`
      }
      // before checking whether it's a disposable email
      // let's check whether they're a subscriber first...
      if (await getConvertKitSubscriber(response)) return

      // let's make sure the given email isn't a disposable email
      try {
        const verifierUrl = new URL(
          `https://verifier.meetchopra.com/verify/${response}`,
        )
        verifierUrl.searchParams.append('token', VERIFIER_API_KEY ?? '')
        const {result} = await got(verifierUrl.toString()).json()
        if (result.error?.code === 500) {
          throw new Error(result.error.message)
        }
        if (!result.status) {
          return `You must use your actual email address. Attempted to verify that ${response} exists and received the following error: ${
            result.error?.message ?? 'Unknown error'
          }`
        }
      } catch (error: unknown) {
        rollbar.error(
          `Trouble checking whether the email "${response}" was disposable`,
          (error as Error).message,
        )
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
      } catch (error: unknown) {
        // ignore the error
      }
      return `
${message}

Here's how you set your avatar: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

**When you're finished (or if you'd like to just move on), just say "done"**
      `.trim()
    },
    isQuestionMessage: messageContents =>
      messageContents.startsWith(`Here's how you set your avatar`),
    feedback: (answers, member) => {
      return member.user.avatar
        ? `Great, thanks for adding your avatar.`
        : `Ok, please do set your avatar later though. It helps keep everything human (and I'll bug you about it every now and then until you do 😈 😅).`
    },
    shouldSkip: member => Boolean(member.user.avatar),
    getAnswer: messageContents => {
      if (/adding your avatar/i.test(messageContents)) return 'added'
      if (/set your avatar later/i.test(messageContents)) return 'skipped'

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
    name: 'confirm',
    question: (answers, member) =>
      `
Here are your answers:
  First Name: ${answers.name}
  Email: ${answers.email}
  Accepted Code of Conduct: ${answers.coc ? 'Yes' : 'No'}${
        answers.avatar
          ? `\n  Avatar: ${member.user.avatar ? 'Added' : 'Skipped'}`
          : ''
      }

If you'd like to change any, then edit your responses above.

**If everything's correct, simply reply "yes"**.
    `.trim(),
    isQuestionMessage: messageContents =>
      messageContents.startsWith('Here are your answers'),
    feedback: `Awesome, welcome to the KCD Community on Discord!`,
    getAnswer: messageContents =>
      messageContents.startsWith('Awesome, welcome to the KCD') ? true : null,
    action: async ({answers, member, channel, isEdit}) => {
      const {guild} = member
      const send = getSend(channel)

      if (!isEdit) {
        const memberRole = guild.roles.cache.find(({name}) => name === 'Member')
        const unconfirmedMemberRole = guild.roles.cache.find(
          ({name}) => name === 'Unconfirmed Member',
        )
        if (!unconfirmedMemberRole || !memberRole) {
          await send(
            `Something is wrong. Please email team@kentcdodds.com and let them know I couldn't find the member or unconfirmed member roles.`,
          )
          return
        }

        await member.roles.remove(unconfirmedMemberRole)
        await member.roles.add(memberRole, 'New confirmed member')
      }

      const subscriber = answers.email
        ? await getConvertKitSubscriber(answers.email)
        : null
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
        await send(`https://media.giphy.com/media/MDxjbPCg6DGf8JclbR/giphy.gif`)
        // sending "👆 that's Kent!" afterword otherwise it appears above the gif somehow
        await send(`👆 that's Kent!`)
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
        `One last thing here if you want, click the icon of the tech you are most interested in right now (or want to learn about). Kent will use this to give you more relevant content in the future.`,
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
      const guild = message.guild
      if (!guild) return

      const reactionEmoji = emojis
        .map(emojiName =>
          guild.emojis.cache.find(({name}) => name.toLowerCase() === emojiName),
        )
        // it's possible the emoji title changed or was removed
        // we should fix the list above in that case, but we don't
        // want to crash just because of that... So we'll filter out those.
        .filter(typedBoolean)
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
    name: 'finished',
    feedback: `We're all done! Thanks!`,
    question: (answers, member) => {
      const tipsChannel = getChannel(member.guild, {name: 'tips'})
      const introChannel = getChannel(member.guild, {name: 'introductions'})

      return `
The first thing I'd suggest you do is go to ${tipsChannel} to read up on some of the things you can do here.

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
      messageContents.startsWith("Looks like we're all done"),
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

const getSteps = (member: TDiscord.GuildMember) =>
  allSteps.filter(s => !s.shouldSkip?.(member))

function getAnswers(
  messages: Array<TDiscord.Message>,
  member: TDiscord.GuildMember,
) {
  const answers: Answers = {}
  for (const message of messages) {
    for (const step of getSteps(member).filter(isRegularStep)) {
      const answer = step.getAnswer(message.content, member)
      if (answer !== null) {
        // @ts-expect-error I'm not sure how to make sure we're assigning
        // the right type to the right answer without making this overly complicated...
        answers[step.name] = answer
        break
      }
    }
  }
  return answers
}

function getCurrentStep(steps: Array<Step>, answers: Answers) {
  return steps
    .filter(isRegularStep)
    .find(step => !answers.hasOwnProperty(step.name))
}

export {allSteps, getAnswers, getCurrentStep, getSteps, firstStep}
