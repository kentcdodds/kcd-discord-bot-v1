const {rest} = require('msw')
const {SnowflakeUtil} = require('discord.js')
const {DiscordManager} = require('test-utils')

const handlers = [
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
      return res(
        ctx.status(200),
        ctx.json(Array.from(discordChannel.messages.cache.values())),
      )
    },
  ),
  rest.post(
    '*/api/:apiVersion/channels/:channelId/messages',
    (req, res, ctx) => {
      const channel = DiscordManager.channels[req.params.channelId]
      const guild = DiscordManager.guilds[channel.guild_id]
      const message = {
        id: SnowflakeUtil.generate(),
        channel_id: channel.id,
        guild_id: channel.guild_id,
        timestamp: new Date().toISOString(),
        author: guild.client.user,
        ...req.body,
      }
      return res(ctx.status(200), ctx.json(message))
    },
  ),
  rest.delete('*/api/:apiVersion/channels/:channelId', (req, res, ctx) => {
    const channel = DiscordManager.channels[req.params.channelId]
    channel.deleted = true
    DiscordManager.guilds[channel.guild_id].client.actions.ChannelDelete.handle(
      channel,
    )
    return res(ctx.status(200), ctx.json(channel))
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
