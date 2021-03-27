import {DiscordManager} from './test-utils'
import {server} from './server'

process.env.CONVERT_KIT_API_KEY = 'FAKE_CONVERT_KIT_API_KEY'
process.env.CONVERT_KIT_API_SECRET = 'FAKE_CONVERT_KIT_API_SECRET'
process.env.DISCORD_BOT_TOKEN = 'FAKE_BOT_TOKEN'
process.env.GIST_REPO_THANKS = 'testThanks'

beforeEach(() => jest.spyOn(Date, 'now'))
beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  DiscordManager.cleanup()
  jest.restoreAllMocks()
  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  }
})

expect.addSnapshotSerializer({
  test(value) {
    return typeof value === 'string' && value.includes('<')
  },
  print(val) {
    const stringVal = val as string
    return stringVal
      .replace(/<@!?(\d+)>/g, (match, memberId) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const member = guild.members.cache.get(memberId)
          if (member) return `<@!${member.displayName}>`
        }
        return match
      })
      .replace(/<#(\d+)>/g, (match, channelId) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const channel = guild.channels.cache.get(channelId)
          if (channel) return `<#${channel.name}>`
        }
        return match
      })
      .replace(/<@&(\d+)>/g, (match, roleId) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const role = guild.roles.cache.get(roleId)
          if (role) return `<@&${role.name}>`
        }
        return match
      })
  },
})
