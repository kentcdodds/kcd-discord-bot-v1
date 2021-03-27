// Reaction purpose:
// Let the person know how to improve their question
import type * as TDiscord from 'discord.js'

async function ask(messageReaction: TDiscord.MessageReaction) {
  const message = messageReaction.message
  await message.reply(
    `We appreciate your question and we want to help you. Could you please give us more details? Please follow the guidelines in <https://kcd.im/ask> (especially the part about making a <https://kcd.im/repro>) and then we'll be able to answer your question.`,
  )
}
ask.description =
  'Sends a reply to the message author explaining how to improve their question'

export {ask}
