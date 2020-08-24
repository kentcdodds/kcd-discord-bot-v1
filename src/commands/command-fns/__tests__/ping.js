const ping = require('../ping')

test('ping pongs', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?ping', channel: {send}}
  await ping(message)
  expect(send).toHaveBeenCalledWith('pong')
  expect(send).toHaveBeenCalledTimes(1)
})

test('ping pongs with arg', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?ping you awesome bot', channel: {send}}
  await ping(message)
  expect(send).toHaveBeenCalledWith('pong you awesome bot')
  expect(send).toHaveBeenCalledTimes(1)
})
