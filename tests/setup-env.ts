import {DiscordManager} from './test-utils'
import {server} from './server'

process.env.CONVERT_KIT_API_KEY = 'FAKE_CONVERT_KIT_API_KEY'
process.env.CONVERT_KIT_API_SECRET = 'FAKE_CONVERT_KIT_API_SECRET'
process.env.DISCORD_BOT_TOKEN = 'FAKE_BOT_TOKEN'
process.env.GIST_REPO_THANKS = 'testThanks'
process.env.GIST_BOT_TOKEN = 'some_github_token'
process.env.VERIFIER_API_KEY = 'FAKE_VERIFIER_API_KEY'
process.env.SENTRY_DSN =
  'https://293408d23048@f029432.ingest.sentry.io/34902384032'

jest.mock('@sentry/node')

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
    const newVal = stringVal
      // member mention
      .replace(/<@!?(\d+)>/g, (match, memberId: string) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const member = guild.members.cache.get(memberId)
          if (member) return `<@!${member.displayName}>`
        }
        return match
      })
      // channel mention
      .replace(/<#(\d+)>/g, (match, channelId: string) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const channel = guild.channels.cache.get(channelId)
          if (channel) return `<#${channel.name}>`
        }
        return match
      })
      // role mention
      .replace(/<@&(\d+)>/g, (match, roleId: string) => {
        for (const guild of Object.values(DiscordManager.guilds)) {
          const role = guild.roles.cache.get(roleId)
          if (role) return `<@&${role.name}>`
        }
        return match
      })
      // emoji
      .replace(/<(:.+?:)\d+>/g, '$1')
      // message url
      .replace(
        /https:\/\/discordapp.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)\/(?<messageId>\d+)/g,
        `https://discordapp.com/channels/:guildId/:channelId/:messageId`,
      )

    return newVal
  },
})
