const {buildTime} = require('../../../../build-info.json')

jest.mock('../../../../build-info.json', () => ({
  buildTime: new Date('2020-10-18 04:35:12 GMT').getTime(),
  commit:
    'https://github.com/kentcdodds/kcd-discord-bot/commit/fab041f by Kent C. Dodds 38 minutes ago: improve kif logic',
}))

beforeEach(() => {
  jest.useFakeTimers('modern')

  const threeDays = 1000 * 60 * 60 * 24 * 3
  const twoHours = 1000 * 60 * 60 * 2
  const fourtyFiveMinutes = 1000 * 60 * 45
  const threeSeconds = 1000 * 3

  jest.setSystemTime(
    buildTime + threeDays + twoHours + fourtyFiveMinutes + threeSeconds,
  )
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

test('prints useful info', async () => {
  const info = require('../info')
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?info', channel: {send}}
  await info(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Here's some info about the currently running bot:

      Deployed at: Sun, 18 Oct 2020 04:35:12 GMT (3.1 days ago)
      Commit: https://github.com/kentcdodds/kcd-discord-bot/commit/fab041f by Kent C. Dodds 38 minutes ago: improve kif logic"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})
