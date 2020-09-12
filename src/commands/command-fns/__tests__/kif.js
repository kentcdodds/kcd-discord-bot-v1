const kif = require('../kif')

test('sends a gif', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif hi', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"https://giphy.com/gifs/hi-kentcdodds-VbzmrabLQFE8VbQY3V"`,
  )
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests similar item', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif peace fail', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"peace fail\\"

    Did you mean \\"peace fall\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests two items', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif laugh', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"laugh\\"

    Did you mean \\"laugh cry\\" or \\"laugh huh\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test('suggests several items (but no more than 6)', async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif a', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "Couldn't find a kif for: \\"a\\"

    Did you mean \\"aw\\", \\"adorable\\", \\"agree\\", \\"agreed\\", \\"applause\\", or \\"aw, thanks\\"?"
  `)
  expect(send).toHaveBeenCalledTimes(1)
})

test(`says it can't find something if it can't`, async () => {
  const send = jest.fn(() => Promise.resolve())
  const message = {content: '?kif blah', channel: {send}}
  await kif(message)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Couldn't find a kif for: \\"blah\\""`,
  )
  expect(send).toHaveBeenCalledTimes(1)
})
