import type * as TDiscord from 'discord.js'
import {cleanupGuildOnInterval} from '../utils'
import {cleanup} from './cleanup'

function setup(client: TDiscord.Client) {
  cleanupGuildOnInterval(client, guild => cleanup(guild), 5000)
}

export * from './cleanup'
export {setup}
