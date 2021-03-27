import type * as TDiscord from 'discord.js'
import {rest} from 'msw'
import {SnowflakeUtil, Util} from 'discord.js'
import {DiscordManager, getClientActions} from '../test-utils'
import {isTextChannel} from '../../src/utils'

const handlers = [
  rest.post('*/api/:apiVersion/guilds/:guild/channels', (req, res, ctx) => {
    const createdChannel = {
      id: SnowflakeUtil.generate(),
      guild_id: req.params.guild,
      ...(req.body as {type: number}),
    }
    DiscordManager.channels[createdChannel.id] = {
      ...createdChannel,
    }

    return res(ctx.status(200), ctx.json(createdChannel))
  }),
  rest.get(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const {channelId} = req.params
      const channelInfo = DiscordManager.channels[channelId]
      if (!channelInfo) {
        throw new Error(`No channel with the id of ${channelId}`)
      }
      const guild = DiscordManager.guilds[channelInfo.guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${channelInfo.guild_id}`)
      }
      const channel = guild.channels.cache.get(channelId)
      if (!channel || !isTextChannel(channel)) {
        throw new Error(
          `Tried to get messages from a non-text channel: ${channelId}`,
        )
      }
      const messages = Array.from(channel.messages.cache.values()).map(
        message => {
          return {
            ...message,
            mentions: Array.from(message.mentions.users.values()),
            reactions: Array.from(message.reactions.cache.values()).map(
              reaction => ({
                count: reaction.count,
                emoji: reaction.emoji,
              }),
            ),
          }
        },
      )

      return res(ctx.status(200), ctx.json(messages.reverse()))
    },
  ),
  rest.delete(
    '*/api/:apiVersion/channels/:channelId/messages/:messageId',
    (req, res, ctx) => {
      const channel = DiscordManager.channels[req.params.channelId]
      if (!channel) {
        throw new Error(`No channel with the id of ${req.params.channelId}`)
      }
      const guild = DiscordManager.guilds[channel.guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${channel.guild_id}`)
      }
      const deletedMessage = {
        id: req.params.messageId,
        channel_id: req.params.channelId,
      }
      getClientActions(guild.client).MessageDelete.handle(deletedMessage)
      return res(ctx.status(200), ctx.json(deletedMessage))
    },
  ),
  rest.patch(
    '*/api/:apiVersion/channels/:channelId/messages/:messageId',
    (req, res, ctx) => {
      const channel = DiscordManager.channels[req.params.channelId]
      if (!channel) {
        throw new Error(`No channel with the id of ${req.params.channelId}`)
      }
      const guild = DiscordManager.guilds[channel.guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${channel.guild_id}`)
      }
      const editedMessage = {
        ...(req.body as {}),
        id: req.params.messageId,
        channel_id: req.params.channelId,
      }
      getClientActions(guild.client).MessageUpdate.handle(editedMessage)

      return res(ctx.status(200), ctx.json(editedMessage))
    },
  ),
  rest.put(
    `*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/*/@me`,
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(req.body))
    },
  ),
  rest.get(
    '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
    (req, res, ctx) => {
      const {channelId, messageId, reaction} = req.params
      const emoji = Util.parseEmoji(reaction)
      if (!emoji) {
        throw new Error(`No emojis could be parsed from ${reaction}`)
      }
      const {guild_id} = DiscordManager.channels[channelId] ?? {}
      if (!guild_id) {
        throw new Error(`No channel info for the channelId of ${channelId}`)
      }
      const guild = DiscordManager.guilds[guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${guild_id}`)
      }

      const channel = guild.channels.cache.get(
        channelId,
      ) as TDiscord.TextChannel
      const message = channel.messages.cache.get(messageId)
      if (!message) return res(ctx.json([]))

      const reactionsForMessage = DiscordManager.reactions[message.id]
      if (!reactionsForMessage) {
        return res(ctx.json([]))
      }
      const messageReaction = reactionsForMessage[emoji.name]
      if (!messageReaction) return res(ctx.json([]))

      const reactingUsers = Array.from(messageReaction.users.cache.values())
      return res(ctx.json(reactingUsers))
    },
  ),
  rest.delete(
    '*/api/:apiVersion/channels/:channelId/messages/:messageId/reactions/:reaction',
    (req, res, ctx) => {
      const {channelId, messageId, reaction} = req.params
      const emoji = Util.parseEmoji(reaction)
      if (!emoji) {
        throw new Error(`No emojis could be parsed from ${reaction}`)
      }
      const {guild_id} = DiscordManager.channels[channelId] ?? {}
      if (!guild_id) {
        throw new Error(`No channel info for the channelId of ${channelId}`)
      }
      const guild = DiscordManager.guilds[guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${guild_id}`)
      }

      const channel = guild.channels.cache.get(
        channelId,
      ) as TDiscord.TextChannel
      const message = channel.messages.cache.get(messageId)
      if (!message) {
        throw new Error(`No message could be found with id ${messageId}`)
      }
      delete DiscordManager.reactions[message.id]?.[emoji.name]
      getClientActions(guild.client).MessageReactionRemoveEmoji.handle({
        message_id: messageId,
        channel_id: channelId,
        emoji,
      })
      message.reactions.cache.delete(emoji.name)
      return res(ctx.json([]))
    },
  ),
  rest.get(
    '*/api/:apiVersion/guilds/:guildId/members/:memberId',
    (req, res, ctx) => {
      const guild = DiscordManager.guilds[req.params.guildId]
      if (!guild) {
        throw new Error(`No guild with the ID of ${req.params.guildId}`)
      }

      const {
        nickname: nick,
        _roles: roles,
        joinedTimestamp: joined_at,
        premiumSinceTimestamp: premium_since,
        user,
      } = Array.from(guild.members.cache.values()).find(
        member => member.user.id === req.params.memberId,
      ) as TDiscord.GuildMember & {_roles: Array<string>}
      const objectMember = {
        nick,
        roles,
        joined_at,
        premium_since,
        user,
      }
      return res(ctx.status(200), ctx.json(objectMember))
    },
  ),
  rest.delete(
    '*/api/:apiVersion/guilds/:guildId/members/:memberId/roles/:roleId',
    (req, res, ctx) => {
      const updateUser = {
        id: req.params.memberId,
      }
      const guild = DiscordManager.guilds[req.params.guildId]
      if (!guild) {
        throw new Error(`No guild with the ID of ${req.params.guildId}`)
      }

      const user = Array.from(guild.members.cache.values()).find(
        guildMember => guildMember.user.id === req.params.memberId,
      ) as TDiscord.GuildMember & {_roles: Array<string>}
      const removedRole = guild.roles.cache.get(req.params.roleId)
      if (!removedRole) {
        throw new Error(`No role with the ID of ${req.params.roleId}`)
      }
      user._roles = user._roles.filter(roleId => roleId !== removedRole.id)
      return res(ctx.status(200), ctx.json(updateUser))
    },
  ),
  rest.put(
    '*/api/:apiVersion/guilds/:guildId/members/:memberId/roles/:roleId',
    (req, res, ctx) => {
      const updateUser = {
        id: req.params.memberId,
      }
      const guild = DiscordManager.guilds[req.params.guildId]
      if (!guild) {
        throw new Error(`No guild with the ID of ${req.params.guildId}`)
      }

      const user = Array.from(guild.members.cache.values()).find(
        guildMember => guildMember.user.id === req.params.memberId,
      ) as TDiscord.GuildMember & {_roles: Array<string>}

      const assignedRole = guild.roles.cache.get(req.params.roleId)
      if (!assignedRole) {
        throw new Error(`No role with the ID of ${req.params.roleId}`)
      }
      user._roles.push(assignedRole.id)
      return res(ctx.status(200), ctx.json(updateUser))
    },
  ),
  rest.patch(
    '*/api/:apiVersion/guilds/:guildId/members/:memberId',
    (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({}))
    },
  ),
  rest.post(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const channel = DiscordManager.channels[req.params.channelId]
      if (!channel) {
        throw new Error(`No channel with the id of ${req.params.channelId}`)
      }
      const guild = DiscordManager.guilds[channel.guild_id]
      if (!guild) {
        throw new Error(`No guild with the ID of ${channel.guild_id}`)
      }
      const content = (req.body as {content: string}).content
      const mentions = Array.from(
        // @ts-expect-error for some reason I can't make TS happy about matchAll
        content.matchAll(/<@!(?<userId>\d+)>/g) as Array<RegExpMatchArray>,
      ).map(mention =>
        mention.groups?.userId
          ? guild.members.cache.get(mention.groups.userId)?.user
          : null,
      )

      const message = {
        id: SnowflakeUtil.generate(),
        channel_id: channel.id,
        guild_id: channel.guild_id,
        timestamp: new Date().toISOString(),
        author: guild.client.user,
        mentions,
        ...(req.body as {}),
      }
      return res(ctx.status(200), ctx.json(message))
    },
  ),
  rest.patch('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = {
      ...DiscordManager.channels[req.params.channelId],
      ...(req.body as {}),
    }
    if (!channel.guild_id) {
      throw new Error(`No guild channel with the id of ${req.params.channelId}`)
    }
    const guild = DiscordManager.guilds[channel.guild_id]
    if (!guild) {
      throw new Error(`No guild with the ID of ${channel.guild_id}`)
    }
    getClientActions(guild.client).ChannelUpdate.handle(channel)
    return res(ctx.text('body'))
  }),
  rest.delete('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = DiscordManager.channels[req.params.channelId]
    if (!channel) {
      throw new Error(`No channel with the id of ${req.params.channelId}`)
    }
    const guild = DiscordManager.guilds[channel.guild_id]
    if (!guild) {
      throw new Error(`No guild with the ID of ${channel.guild_id}`)
    }
    channel.deleted = true
    getClientActions(guild.client).ChannelDelete.handle(channel)
    return res(ctx.status(200), ctx.json(channel))
  }),
  rest.post('*/api/:apiVersion/guilds/:guildId/emojis', (req, res, ctx) => {
    const emoji = {
      id: SnowflakeUtil.generate(),
      ...(req.body as {}),
    }
    return res(ctx.status(200), ctx.json(emoji))
  }),
  rest.get('*/api/:apiVersion/gateway/bot', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        url: '',
        shards: 9,
        session_start_limit: {
          total: 1000,
          remaining: 999,
          reset_after: 14400000,
        },
      }),
    )
  }),
]

export {handlers}
