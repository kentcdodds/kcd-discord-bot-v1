import type * as TDiscord from 'discord.js'
import {getMemberIdFromChannel, isWelcomeChannel, isTextChannel} from '../utils'

const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const {CONVERT_KIT_API_SECRET, CONVERT_KIT_API_KEY} = process.env

if (!CONVERT_KIT_API_SECRET) {
  throw new Error('CONVERT_KIT_API_SECRET env variable is required')
}
if (!CONVERT_KIT_API_KEY) {
  throw new Error('CONVERT_KIT_API_KEY env variable is required')
}

function getSubscriberEndpoint(email: string) {
  const url = new URL('https://api.convertkit.com/v3/subscribers')
  url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET as string)
  url.searchParams.set('email_address', email)
  return url.toString()
}

type Answers = {}

async function getMessageContents(
  msg:
    | string
    | ((answers: Answers, member: TDiscord.GuildMember) => Promise<string>),
  answers: Answers,
  member: TDiscord.GuildMember,
) {
  if (typeof msg === 'function') {
    const result = await msg(answers, member)
    return result
  } else {
    return msg
  }
}

const getWelcomeChannels = (guild: TDiscord.Guild) =>
  guild.channels.cache.filter(
    ch => isTextChannel(ch) && isWelcomeChannel(ch),
  ) as TDiscord.Collection<string, TDiscord.TextChannel>

const hasRole = (member: TDiscord.GuildMember, roleName: string) =>
  member.roles.cache.some(({name}) => name === roleName)

function isMemberUnconfirmed(member: TDiscord.GuildMember) {
  const memberRoles = [
    'Member',
    'Moderator',
    'MegaMod',
    'Bot',
    'Admin',
    'Owner',
  ]
  return !memberRoles.some(r => hasRole(member, r))
}

const getMemberWelcomeChannel = (member: TDiscord.GuildMember) =>
  getWelcomeChannels(member.guild).find(
    channel => getMemberIdFromChannel(channel) === member.id,
  )

export * from '../utils'
export {
  editErrorMessagePrefix,
  getSubscriberEndpoint,
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  getWelcomeChannels,
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getMessageContents,
}
