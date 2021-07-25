import type * as TDiscord from 'discord.js'
import {getMember, getTextChannel} from './utils'

const hasModRole = (
  member: TDiscord.GuildMember | TDiscord.PartialGuildMember,
) => member.roles.cache.some(({name}) => name === 'Moderator')

async function handleGuildMemberUpdate(
  oldMember: TDiscord.GuildMember | TDiscord.PartialGuildMember,
  newMember: TDiscord.GuildMember,
) {
  const oldHasModRole = hasModRole(oldMember)
  const newHasModRole = hasModRole(newMember)
  const isNewMod = newHasModRole && !oldHasModRole
  if (isNewMod) {
    await newMember.setNickname(`${newMember.displayName} ◆`)
    return
  }
  return handleMember(newMember)
}

async function handleMember(member: TDiscord.GuildMember | undefined | null) {
  if (!member) return
  const hasBadge = member.nickname?.includes('◆')
  if (hasBadge && !hasModRole(member)) {
    await member.setNickname(member.displayName.replace(/◆/g, '').trim())
    const botsChannel = getTextChannel(member.guild, 'talk-to-bots')
    if (!botsChannel) return
    await botsChannel.send(
      `
Hi ${member.user}, I noticed you added "◆" to your nickname. I'm afraid you can't do this because it's reserved for Moderators, so I've removed it.
      `.trim(),
    )
  }
}

async function handleNewMessage(message: TDiscord.Message) {
  return handleMember(getMember(message.guild, message.author.id))
}

export {handleGuildMemberUpdate, handleNewMessage}
