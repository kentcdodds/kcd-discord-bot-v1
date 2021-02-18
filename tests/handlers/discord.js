const {rest} = require('msw')
const {SnowflakeUtil, Constants} = require('discord.js')
const {DiscordManager} = require('test-utils')

const handlers = [
  rest.post('*/api/:apiVersion/users/:userid/channels', (req, res, ctx) => {
    const createdChannel = {
      id: SnowflakeUtil.generate(),
      type: Constants.ChannelTypes.DM,
    }
    DiscordManager.channels[createdChannel.id] = {
      ...createdChannel,
    }
    return res(ctx.status(200), ctx.json(createdChannel))
  }),
  rest.post('*/api/:apiVersion/guilds/:guild/channels', (req, res, ctx) => {
    const createdChannel = {
      id: SnowflakeUtil.generate(),
      guild_id: req.params.guild,
      ...req.body,
    }
    DiscordManager.channels[createdChannel.id] = {
      ...createdChannel,
    }

    return res(ctx.status(200), ctx.json(createdChannel))
  }),
  rest.get(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const cachedChannel = DiscordManager.channels[req.params.channelId]
      const discordChannel = Array.from(
        DiscordManager.guilds[cachedChannel.guild_id].channels.cache.values(),
      ).find(channel => channel.id === cachedChannel.id)
      const messages = Array.from(discordChannel.messages.cache.values()).map(
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
      const deletedMessage = {
        id: req.params.messageId,
        channel_id: req.params.channelId,
      }
      DiscordManager.guilds[
        channel.guild_id
      ].client.actions.MessageDelete.handle(deletedMessage)
      return res(ctx.status(200), ctx.json(deletedMessage))
    },
  ),
  rest.patch(
    '*/api/:apiVersion/channels/:channelId/messages/:messageId',
    (req, res, ctx) => {
      const channel = DiscordManager.channels[req.params.channelId]
      const editedMessage = {
        ...req.body,
        id: req.params.messageId,
        channel_id: req.params.channelId,
      }
      DiscordManager.guilds[
        channel.guild_id
      ].client.actions.MessageUpdate.handle(editedMessage)

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
      return res(ctx.json([]))
    },
  ),
  rest.get(
    '*/api/:apiVersion/guilds/:guildId/members/:memberId',
    (req, res, ctx) => {
      const guild = DiscordManager.guilds[req.params.guildId]
      const {
        nickname: nick,
        _roles: roles,
        joinedTimestamp: joined_at,
        premiumSinceTimestamp: premium_since,
        user,
      } = Array.from(guild.members.cache.values()).find(
        member => member.user.id === req.params.memberId,
      )
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

      const user = Array.from(guild.members.cache.values()).find(
        guildMember => guildMember.user.id === req.params.memberId,
      )
      const removedRole = Array.from(guild.roles.cache.values()).find(
        role => role.id === req.params.roleId,
      )
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

      const user = Array.from(guild.members.cache.values()).find(
        guildMember => guildMember.user.id === req.params.memberId,
      )
      const assigneRole = Array.from(guild.roles.cache.values()).find(
        role => role.id === req.params.roleId,
      )
      user._roles.push(assigneRole.id)
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
      const guild = DiscordManager.guilds[channel.guild_id]
      const members = Array.from(guild.members.cache.values())
      const mentions = Array.from(
        req.body.content.matchAll(/<@!(?<userId>\d+)>/g),
      ).map(
        mention => members.find(user => user.id === mention.groups.userId).user,
      )

      const message = {
        id: SnowflakeUtil.generate(),
        channel_id: channel.id,
        guild_id: channel.guild_id,
        timestamp: new Date().toISOString(),
        author: guild.client.user,
        mentions,
        ...req.body,
      }
      return res(ctx.status(200), ctx.json(message))
    },
  ),
  rest.patch('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = {
      ...DiscordManager.channels[req.params.channelId],
      ...req.body,
    }

    DiscordManager.guilds[channel.guild_id].client.actions.ChannelUpdate.handle(
      channel,
    )
    return res(ctx.text('body'))
  }),
  rest.delete('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = DiscordManager.channels[req.params.channelId]
    channel.deleted = true
    DiscordManager.guilds[channel.guild_id].client.actions.ChannelDelete.handle(
      channel,
    )
    return res(ctx.status(200), ctx.json(channel))
  }),
  rest.post('*/api/:apiVersion/guilds/:guildId/emojis', (req, res, ctx) => {
    const emoji = {
      id: SnowflakeUtil.generate(),
      ...req.body,
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

module.exports = handlers
