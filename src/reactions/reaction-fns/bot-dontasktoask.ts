// Reaction purpose:
// Let the person know how to improve their question
import type * as TDiscord from 'discord.js'

async function dontAskToAsk(messageReaction: TDiscord.MessageReaction) {
  const message = messageReaction.message
  await message.reply(
    `We're happy to answer your questions! You don't need to bother asking. Learn more: <https://dontasktoask.com>`,
  )
}
dontAskToAsk.description = `Sends a reply to the message author explaining that they don't need to ask to ask.`

export {dontAskToAsk}
