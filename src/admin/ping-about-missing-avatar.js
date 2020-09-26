const {getMember} = require('./utils')

const isMEE6Bot = member =>
  member.user.bot && member.user.username.includes('MEE6')

async function pingAboutMissingAvatar(message) {
  const mee6Bot = getMember(message.guild, message.author.id)
  if (!isMEE6Bot(mee6Bot)) return // only process the MEE6 bot
  if (!message.content.includes('you just advanced to')) return // only bug them when they get a rank upgrade

  const member = message.mentions.members.first()
  if (member.user.avatar) return // if they have an avatar then they're good

  await message.channel.send(
    `
Congratulations on your new level ${member.user}! I noticed you still don't have an avatar set. Could you please take a second to get that set?

Here's how you do that: <https://support.discord.com/hc/en-us/articles/204156688-How-do-I-change-my-avatar->

If you don't, I'll bug you about it every time you level-up 😈 So you may as well just get it over with.
    `.trim(),
  )
}

module.exports = {pingAboutMissingAvatar}
