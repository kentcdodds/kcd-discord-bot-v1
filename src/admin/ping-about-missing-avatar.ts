import type * as TDiscord from 'discord.js'

const isMEE6Bot = (member: TDiscord.GuildMember | null | undefined) =>
  member?.user.bot && member.user.username.includes('MEE6')

async function pingAboutMissingAvatar(message: TDiscord.Message) {
  const mee6Bot = message.member
  if (!isMEE6Bot(mee6Bot)) return // only process the MEE6 bot
  if (!message.content.includes('you just advanced to')) return // only bug them when they get a rank upgrade

  const member = message.mentions.members?.first()
  if (!member || member.user.avatar) return // if they have an avatar then they're good

  await message.channel.send(
    `
Congratulations on your new level ${member.user}! I noticed you still don't have an avatar set. Could you please take a second to get that set?

Here's how you do that: <https://support.discord.com/hc/en-us/articles/360035491151-Account-Customization#h_3b115372-f09d-42cf-a02c-d7db97272735>

If you don't, I'll bug you about it every time you level-up 😈 So you may as well just get it over with.
    `.trim(),
  )
}

export {pingAboutMissingAvatar}
