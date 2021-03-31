import type * as TDiscord from 'discord.js'
import {getTextChannel} from '../utils'

type ReactionFn = {
  (message: TDiscord.MessageReaction): Promise<unknown>
  description?: string
}

const reactions: Record<string, ReactionFn | undefined> = {
  // the help command depends on this, so we do not include it here...
  bothelp: help,
  botask: ask,
  botofficehours: officeHours,
  botdontasktoask: dontAskToAsk,
  botdouble: doubleAsk,
} as const

async function ask(messageReaction: TDiscord.MessageReaction) {
  await messageReaction.message.reply(
    `We appreciate your question and we'll do our best to help you when we can. Could you please give us more details? Please follow the guidelines in <https://kcd.im/ask> (especially the part about making a <https://kcd.im/repro>) and then we'll be able to answer your question.`,
  )
}
ask.description =
  'Sends a reply to the message author explaining how to improve their question'

async function doubleAsk(messageReaction: TDiscord.MessageReaction) {
  await messageReaction.message.reply(
    `Please avoid posting the same thing in multiple channels. Choose the best channel, and wait for a response there. Please delete the other message to avoid fragmenting the answers and causing confusion. Thanks!`,
  )
}
doubleAsk.description = `Sends a reply to the message author explaining that they shouldn't ask the same question twice.`

async function officeHours(messageReaction: TDiscord.MessageReaction) {
  const message = messageReaction.message
  const officeHoursChannel = getTextChannel(message.guild, 'kcd-office-hours')
  if (!officeHoursChannel) return

  await message.reply(
    `If you don't get a satisfactory answer here, then you can feel free to ask Kent during his <https://kcd.im/office-hours> in ${officeHoursChannel}. To do so, formulate your question to make sure it's clear (follow the guildelines in <https://kcd.im/ask>) and a <https://kcd.im/repro> helps a lot if applicable. Then post it to ${officeHoursChannel} or join the meeting and ask live. Kent streams/records his office hours on YouTube so even if you can't make it in person, you should be able to watch his answer later.`,
  )
}
officeHours.description =
  'Sends a reply to the message author explaining how to ask their question during Office Hours.'

async function dontAskToAsk(messageReaction: TDiscord.MessageReaction) {
  const message = messageReaction.message
  await message.reply(
    `We're happy to answer your questions if we can, so you don't need to ask if you can ask. Learn more: <https://dontasktoask.com>`,
  )
}
dontAskToAsk.description = `Sends a reply to the message author explaining that they don't need to ask to ask.`

async function help(messageReaction: TDiscord.MessageReaction) {
  const helpRequester = messageReaction.users.cache.first()
  if (!helpRequester) return

  const botsChannel = getTextChannel(
    messageReaction.message.guild,
    'talk-to-bots',
  )
  if (!botsChannel) return

  const result = botsChannel.send(
    `
${helpRequester} Here are the available bot reactions:

- ${Object.entries(reactions)
      .map(([name, fn]) => [name, fn?.description].filter(Boolean).join(': '))
      .join('\n- ')}
    `.trim(),
  )
  return result
}
help.description = 'Lists available bot reactions'

export default reactions
export {help}
