// Command purpose:
// to automate creating new learning clubs https://kcd.im/clubs
const got = require('got')
const redent = require('redent')
const ogs = require('open-graph-scraper')
const rollbar = require('../../../rollbar')
const {
  getChannel,
  getRole,
  getCommandArgs,
  getMessageLink,
  sendBotMessageReply,
} = require('../../utils')

const httpify = link => (link.startsWith('http') ? link : `https://${link}`)

const formDataMarkers = {
  summary: {before: 'Learning Goal:', after: 'Learning Curriculum:'},
  curriculumLink: {
    before: 'Learning Curriculum:',
    after: 'Special Requirements:',
  },
  requirements: {before: 'Special Requirements:', after: 'Schedule:'},
  schedule: {before: 'Schedule:', after: 'Meetings are Sync:'},
  sync: {before: 'Meetings are Sync:', after: 'Club Captain:'},
}

const formDataValidators = []
for (const key of Object.keys(formDataMarkers)) {
  formDataValidators.push(formData =>
    formData.hasOwnProperty(key)
      ? null
      : `Can't find ${formDataMarkers[key].before} (make sure everything is in the correct order)`,
  )
}

const validators = [
  ({summary}) => {
    if (summary.length < 10) {
      return `That's too short, please be more specific.`
    }
    if (summary.length > 1000) {
      return `That's too long, please be more succinct.`
    }
  },
  async ({curriculumLink}) => {
    let url
    try {
      url = new URL(httpify(curriculumLink))
    } catch {
      return `Sorry, the "Learning Curriculum" of "${curriculumLink}" is not a URL. Please provide a link to the course/github repo/book/etc. your group plans to go through.`
    }
    try {
      const res = await got.head(url)
      if (res.statusCode === 200) return
    } catch {
      // ignore
    }
    return `Sorry, I couldn't verify the "Learning Curriculum" link of "<${curriculumLink}>" is accepting traffic. It doesn't respond with a status code of success (HTTP code 200) when I ping it with a HEAD request.`
  },
  ({schedule, sync}) => {
    if (schedule.length < 100) {
      return `The schedule is too short, please make your schedule more thorough.`
    }
    if (schedule.length > 10000) {
      return `The schedule is too long. It would probably be better to split this into more than one learning club.`
    }
    if (/yes/i.test(sync) && !/\d{1,2}:\d{2}/.test(schedule)) {
      return `Because this club has sync meetings, please make sure to include the time and timezone of the meetings. The time should be formatted as hh:mm or h:mm`
    }
  },
]

async function createClub(message) {
  const member = message.guild.members.cache.find(
    ({user}) => user.id === message.author.id,
  )
  const [, formLink] = getCommandArgs(message.content).split(' ')
  const invalidLinkResponse = `
Please send a Google Form link along with this command. For example:
  \`?clubs create https://docs.google.com/forms/d/e/...2jk4.../viewform?usp=sf_link\`

Find an example and template here: <https://kcd.im/kcd-learning-club-docs>
  `.trim()
  try {
    if (
      new URL(formLink).hostname !== 'docs.google.com' &&
      new URL(formLink).hostname !== 'forms.gle'
    ) {
      await sendBotMessageReply(message, invalidLinkResponse)
      return
    }
  } catch {
    await sendBotMessageReply(message, invalidLinkResponse)
    return
  }

  let formData
  try {
    formData = await getFormData(formLink)
  } catch (error) {
    rollbar.log('error getting the form data when creating a club', {
      errorMessage: error.message,
      formLink,
    })
    await sendBotMessageReply(message, error.message ?? 'Unknown error')
    return
  }

  const missingDataKeys = Object.keys(formDataMarkers).filter(
    key => !formData.hasOwnProperty(key),
  )

  if (missingDataKeys.length) {
    const missingKeyLines = missingDataKeys.map(
      key =>
        `Can't find data for "${formDataMarkers[key].before}" (make sure it comes before "${formDataMarkers[key].after})"`,
    )
    await sendBotMessageReply(
      message,
      `
I couldn't find all the required data for this club. Please make sure the Google Form Summary has all the data (and in the right order). Here's what I'm missing:
- ${missingKeyLines.join('\n- ')}
      `.trim(),
    )
    return
  }

  const allErrorResults = await Promise.all(validators.map(v => v(formData)))
  const errors = allErrorResults.filter(Boolean)
  if (errors.length) {
    const issues = errors.length === 1 ? 'an issue' : 'some issues'
    const problems = errors.length === 1 ? 'problem' : 'problems'
    await sendBotMessageReply(
      message,
      `
I found ${issues} with that club registration form:
- ${errors.join('\n- ')}

Please fix the ${problems} above and try again. Please be sure to follow the template: <https://kcd.im/kcd-learning-club-docs>
    `.trim(),
    )
    return
  }

  // we're good! Let's make this thing!
  const openClubsChannel = getChannel(member.guild, {name: 'open-clubs'})
  const captainsRole = getRole(member.guild, {name: 'Club Captains'})

  const isAlreadyACaptain = member.roles.cache.has(captainsRole.id)
  if (!isAlreadyACaptain) {
    await member.roles.add(captainsRole, `Captaining this club: ${formLink}`)
  }

  const activeClubMessage = await openClubsChannel.send(
    getActiveClubMessage({formLink, formData, member}),
  )
  const activeClubMessageLink = getMessageLink(activeClubMessage)
  await sendBotMessageReply(
    message,
    `
      Ok Captain ${member.user}! Congrats on starting your new club. I've posted all about it in ${openClubsChannel}: <${activeClubMessageLink}>.
      
      We're all set! Please prepare to accept member's friend requests and registrations and add them to a Group DM (learn more: <https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls>)
      
      Keep in mind, this that listing will be **automatically deleted** after _one week_. If you are still looking for new members after that time, feel free to do this again. If your club fills up and you want the message removed, simply add a 🏁 reaction to it, and I'll delete it.
    `.trim(),
  )
  if (!isAlreadyACaptain) {
    const captainsChannel = getChannel(member.guild, {name: 'club-captains'})
    await captainsChannel.send(
      `
Hi everyone, I want to introduce you to ${member.user}, our newest club captain 🎉

Congratulations on your new club ${member.user}!  You can chat with other club captains about captaining clubs in this channel.
      `.trim(),
    )
  }
}

async function getFormData(formLink) {
  const {error, result} = await ogs({url: formLink})
  if (error) {
    throw new Error(
      result.message ??
        'There was a problem retrieving information about this form.',
    )
  }

  const description = result.ogDescription

  const data = {title: result.ogTitle}
  for (const key of Object.keys(formDataMarkers)) {
    const {before, after} = formDataMarkers[key]
    const beforeIndex = description.indexOf(before)
    const afterIndex = description.indexOf(after)
    if (beforeIndex !== -1 && afterIndex !== -1) {
      const value = description
        .slice(beforeIndex + before.length, afterIndex)
        .trim()
      data[key] = value
    }
  }

  return data
}

const clipLongText = (text, max) =>
  text.length > max ? `${text.slice(0, max - 3)}...` : text

function getActiveClubMessage({formLink, formData, member}) {
  return `
🎊 New club looking for members 🎉

**${formData.title}**

**Club Curriculum:** ${httpify(formData.curriculumLink)}

**Club Captain:** ${member.user}

**Learning Goal Summary:** ${clipLongText(formData.summary, 500)}

**Requirements:**
${redent(clipLongText(formData.requirements, 200), 6)}

**Club Schedule:**
${redent(clipLongText(formData.schedule, 900), 6)}

**Club Registration Form:** <${formLink}>

If this schedule doesn't work well for you, then feel free to start your own club with the same registration. Learn more here: <https://kcd.im/clubs>
  `.trim()
}

module.exports = {createClub}
