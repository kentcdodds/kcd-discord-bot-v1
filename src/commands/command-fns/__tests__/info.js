const {buildTime} = require('../../../../build-info.json')

jest.mock('../../../../build-info.json', () => ({
  buildTime: new Date('2020-10-18 04:35:12 GMT').getTime(),
  commit: {
    sha: 'b84d60ca5507ebf73c8fd2fe620a8ad1cdf1958e',
    author: 'Kent C. Dodds',
    date: '2020-10-17T18:01:47Z',
    message: 'improve the info command',
    link:
      'https://github.com/kentcdodds/kcd-discord-bot/commit/b84d60ca5507ebf73c8fd2fe620a8ad1cdf1958e',
  },
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
      Commit:
        author: Kent C. Dodds
        date: Sat, 17 Oct 2020 18:01:47 GMT (3.6 days ago)
        message: improve the info command
        link: <https://github.com/kentcdodds/kcd-discord-bot/commit/b84d60ca5507ebf73c8fd2fe620a8ad1cdf1958e>"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})
