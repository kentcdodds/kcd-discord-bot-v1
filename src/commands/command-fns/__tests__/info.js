beforeEach(() => {
  jest.useFakeTimers('modern')
  jest.setSystemTime(new Date('2020-10-18 04:35:12 GMT'))
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

test('prints useful info', async () => {
  const info = require('../info')
  const threeDays = 1000 * 60 * 60 * 24 * 3
  const twoHours = 1000 * 60 * 60 * 2
  const fourtyFiveMinutes = 1000 * 60 * 45
  const threeSeconds = 1000 * 3
  jest.advanceTimersByTime(
    threeDays + twoHours + fourtyFiveMinutes + threeSeconds,
  )
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?info', channel: {send}}
  await info(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Here's some info about the currently running bot:

      Deployed at: Sun, 18 Oct 2020 04:35:12 GMT (3.1 days ago)"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})
