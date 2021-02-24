import type * as TDiscord from 'discord.js'
import * as dedupeMessages from './deduping-channel-posts'
import {pingAboutMissingAvatar} from './ping-about-missing-avatar'
import * as exclusiveEpicReactRocket from './exclusive-epic-react-rocket'
import * as cleanupSelfDestructMessages from './cleanup-self-destruct-messages'

function setup(client: TDiscord.Client) {
  client.on('message', dedupeMessages.handleNewMessage)
  dedupeMessages.setup(client)

  void cleanupSelfDestructMessages.setup(client)

  client.on('message', pingAboutMissingAvatar)
  client.on(
    'guildMemberUpdate',
    exclusiveEpicReactRocket.handleGuildMemberUpdate,
  )
  client.on('message', exclusiveEpicReactRocket.handleNewMessage)
}

export {
  setup,
  dedupeMessages,
  pingAboutMissingAvatar,
  exclusiveEpicReactRocket,
  cleanupSelfDestructMessages,
}
