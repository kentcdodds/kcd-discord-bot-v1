import type * as TDiscord from 'discord.js'
import {cleanupGuildOnInterval} from './utils'
import {handleNewMember} from './handle-new-member'
import {handleNewMessage} from './handle-new-message'
import {handleUpdatedMessage} from './handle-updated-message'
import {cleanup} from './cleanup'

function setup(client: TDiscord.Client) {
  client.on('message', handleNewMessage)
  client.on('messageUpdate', handleUpdatedMessage)
  client.on('guildMemberAdd', handleNewMember)

  cleanupGuildOnInterval(client, guild => cleanup(guild), 5000)
}

export * from './handle-new-message'
export * from './handle-updated-message'
export * from './handle-new-member'
export * from './cleanup'
export {setup}
