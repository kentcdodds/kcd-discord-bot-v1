import type * as TDiscord from 'discord.js'
import {getMember, getTextChannel} from './utils'

async function handleGuildMemberUpdate(
  oldMember: TDiscord.GuildMember | TDiscord.PartialGuildMember,
  newMember: TDiscord.GuildMember,
) {
  return handleMember(newMember)
}

async function handleMember(member: TDiscord.GuildMember | undefined | null) {
  if (!member) return
  const hasRocket = member.nickname?.includes('🏆')
  const isTestingJSMember = member.roles.cache.some(
    ({name}) => name === 'TestingJavaScript',
  )
  if (hasRocket && !isTestingJSMember) {
    await member.setNickname(member.displayName.replace(/🏆/g, '').trim())
    const botsChannel = getTextChannel(member.guild, 'talk-to-bots')
    if (!botsChannel) return
    await botsChannel.send(
      `
Hi ${member.user}, I noticed you added a trophy 🏆 to your nickname. I'm afraid you can't do this because your discord account is not connected to your TestingJavaScript.com account. Login to <https://TestingJavaScript.com> and click the link at the top to make that connection.

If you don't have an https://TestingJavaScript.com account, you should check it out. It's pretty great 😉 🏆
      `.trim(),
    )
  }
}

async function handleNewMessage(message: TDiscord.Message) {
  return handleMember(getMember(message.guild, message.author.id))
}

export {handleGuildMemberUpdate, handleNewMessage}
