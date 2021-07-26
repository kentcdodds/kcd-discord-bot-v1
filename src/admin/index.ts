import type * as TDiscord from 'discord.js'
import * as dedupeMessages from './deduping-channel-posts'
import {pingAboutMissingAvatar} from './ping-about-missing-avatar'
import * as exclusiveEpicReactRocket from './exclusive-epic-react-rocket'
import * as exclusiveTestingJSTrophy from './exclusive-testing-js-trophy'
import * as exclusiveModBadge from './exclusive-mod-badge'
import * as cleanupSelfDestructMessages from './cleanup-self-destruct-messages'
import * as cleanupBotMessages from './cleanup-bot-messages'

function setup(client: TDiscord.Client) {
  client.on('message', dedupeMessages.handleNewMessage)
  dedupeMessages.setup(client)

  void cleanupSelfDestructMessages.setup(client)

  void cleanupBotMessages.setup(client)

  client.on('message', pingAboutMissingAvatar)

  // Epic React 🚀
  client.on(
    'guildMemberUpdate',
    exclusiveEpicReactRocket.handleGuildMemberUpdate,
  )
  client.on('message', exclusiveEpicReactRocket.handleNewMessage)

  // TestingJavaScript 🏆
  client.on(
    'guildMemberUpdate',
    exclusiveTestingJSTrophy.handleGuildMemberUpdate,
  )
  client.on('message', exclusiveTestingJSTrophy.handleNewMessage)

  // Moderator ◆
  client.on('guildMemberUpdate', exclusiveModBadge.handleGuildMemberUpdate)
  client.on('message', exclusiveModBadge.handleNewMessage)
}

export {
  setup,
  dedupeMessages,
  pingAboutMissingAvatar,
  exclusiveEpicReactRocket,
  cleanupSelfDestructMessages,
}
