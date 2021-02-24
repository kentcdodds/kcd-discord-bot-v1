// Command purpose:
// to automate management of learning clubs https://kcd.im/clubs
import type * as TDiscord from 'discord.js'
import {getCommandArgs} from '../../utils'
import {createClub} from './create'

async function clubs(message: TDiscord.Message) {
  const subcommand = getCommandArgs(message.content)
  if (subcommand.startsWith('create')) {
    return createClub(message)
  }
}
clubs.description =
  'Create a club with `?clubs create LINK_TO_GOOGLE_FORM` (learn more: <https://kcd.im/clubs>)'

export {clubs}
