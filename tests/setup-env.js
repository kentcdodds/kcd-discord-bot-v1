const {DiscordManager} = require('test-utils')
const {server} = require('./server')

process.env.CONVERT_KIT_API_KEY = 'FAKE_CONVERT_KIT_API_KEY'
process.env.CONVERT_KIT_API_SECRET = 'FAKE_CONVERT_KIT_API_SECRET'
process.env.DISCORD_BOT_TOKEN = 'FAKE_BOT_TOKEN'
process.env.GIST_REPO_THANKS = 'testThanks'

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  DiscordManager.cleanup()
})
