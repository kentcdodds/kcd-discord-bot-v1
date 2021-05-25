import type * as TDiscord from 'discord.js'
import {
  getMemberIdFromChannel,
  isWelcomeChannel,
  isTextChannel,
  getTextChannel,
  botLog,
  getErrorMessage,
  getMemberLink,
  colors,
} from '../utils'

const editErrorMessagePrefix = `There's a problem with an edit that was just made. Please edit the answer again to fix it.`

const {
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  VERIFIER_API_KEY,
} = process.env

if (!CONVERT_KIT_API_SECRET) {
  throw new Error('CONVERT_KIT_API_SECRET env variable is required')
}
if (!CONVERT_KIT_API_KEY) {
  throw new Error('CONVERT_KIT_API_KEY env variable is required')
}
if (!VERIFIER_API_KEY) {
  throw new Error('VERIFIER_API_KEY env variable is required')
}

function getSubscriberEndpoint(email: string) {
  const url = new URL('https://api.convertkit.com/v3/subscribers')
  url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET as string)
  url.searchParams.set('email_address', email)
  return url.toString()
}

type Answers = {
  name?: string
  email?: string
  coc?: true
  report?: true
  avatar?: 'added' | 'skipped'
  confirm?: true
  finished?: null
}

type StepMessageGetter = (
  answers: Answers,
  member: TDiscord.GuildMember,
) => string | Promise<string>
type ValidateFn = (info: {
  answers: Answers
  message: TDiscord.Message
}) => string | undefined | null | Promise<string | undefined | null>
type ActionFn = (info: {
  answers: Answers
  member: TDiscord.GuildMember
  channel: TDiscord.TextChannel
  isEdit: boolean
}) => unknown | Promise<unknown>

type RegularStep = {
  name: keyof Answers
  isQuestionMessage?: (messageContents: string) => boolean
  question: string | StepMessageGetter
  feedback: string | StepMessageGetter
  getAnswer: (
    messageContents: string,
    member: TDiscord.GuildMember,
  ) => string | true | null
  shouldSkip?: (member: TDiscord.GuildMember) => boolean
  validate: ValidateFn
  action?: ActionFn
  actionOnlyStep?: false
}
type ActionOnlyStep = {
  actionOnlyStep: true
  shouldSkip?: RegularStep['shouldSkip']
  action: ActionFn
}
type Step = RegularStep | ActionOnlyStep

async function getMessageContents(
  msg: string | StepMessageGetter,
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

const isRegularStep = (step: Step | undefined): step is RegularStep =>
  !step?.actionOnlyStep
const isActionOnlyStep = (step: Step | undefined): step is ActionOnlyStep =>
  Boolean(step?.actionOnlyStep)

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

function getBotLogEmbed(
  member: TDiscord.GuildMember,
  status: string,
): TDiscord.MessageEmbedOptions {
  return {
    title: '👋 New Member',
    author: {
      name: member.displayName,
      iconURL: member.user.avatarURL() ?? member.user.defaultAvatarURL,
      url: getMemberLink(member),
    },
    color: colors.base0E,
    description: `${member} has joined the server.`,
    fields: [
      {name: 'Member ID', value: member.id},
      {name: 'Status', value: status},
    ],
  }
}

function updateOnboardingBotLog(
  member: TDiscord.GuildMember,
  updatedEmbed: () => TDiscord.MessageEmbedOptions,
) {
  let botLogMessage
  try {
    const botsChannel = getTextChannel(member.guild, 'bot-logs')
    if (!botsChannel) return

    botLogMessage = botsChannel.messages.cache.find(msg =>
      msg.embeds.some(embd => {
        if (!embd.title || !/New Member/i.test(embd.title)) return false

        return embd.fields.find(field => {
          return /Member ID/i.test(field.name) && field.value === member.id
        })
      }),
    )
  } catch (error: unknown) {
    // ignore errors for logs...
    console.error(
      `Error trying to get the botLogMessage to update`,
      getErrorMessage(error),
    )
  }
  if (botLogMessage) {
    let embed
    try {
      embed = updatedEmbed()
      return botLogMessage.edit({embed})
    } catch {
      // ignore
    }
  } else {
    return botLog(member.guild, updatedEmbed)
  }
}

export * from '../utils'
export {
  editErrorMessagePrefix,
  getSubscriberEndpoint,
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  VERIFIER_API_KEY,
  getWelcomeChannels,
  isMemberUnconfirmed,
  getMemberWelcomeChannel,
  getMessageContents,
  isRegularStep,
  isActionOnlyStep,
  updateOnboardingBotLog,
  getBotLogEmbed,
}
export type {Answers, Step, RegularStep, ActionOnlyStep}
