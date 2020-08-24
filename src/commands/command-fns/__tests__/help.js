const help = require('../help')

test('prints help for all commands', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?help', channel: {send}}
  await help(message)
  expect(send).toHaveBeenCalledWith(expect.stringContaining('- help'))
  expect(send).toHaveBeenCalledTimes(1)
})

test('help with a specific command', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?help ping', channel: {send}}
  await help(message)
  expect(send).toHaveBeenCalledWith(expect.stringContaining('pong'))
  expect(send).toHaveBeenCalledTimes(1)
})
