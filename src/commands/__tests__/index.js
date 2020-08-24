const {handleNewMessage} = require('..')

test('handles incoming messages', async () => {
  const send = jest.fn()
  await handleNewMessage({content: '?help', channel: {send}})
  expect(send).toHaveBeenCalledTimes(1)
})
