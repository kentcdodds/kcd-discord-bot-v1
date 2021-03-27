// Reaction purpose:
// Let the person know how to improve their question
import type * as TDiscord from 'discord.js'
import {getTextChannel} from '../utils'

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

export {officeHours}
