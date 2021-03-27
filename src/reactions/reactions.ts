import type * as TDiscord from 'discord.js'
import {getTextChannel} from '../utils'
import {ask} from './reaction-fns/bot-ask'
import {officeHours} from './reaction-fns/bot-office-hours'
import {dontAskToAsk} from './reaction-fns/bot-dontasktoask'

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
} as const

// the help command depends on all the other commands, so we just inline it here
// Command purpose:
// lists all available commands
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
