const Discord = require('discord.js')
const {rest} = require('msw')
const {server} = require('server')
const {makeFakeClient} = require('test-utils')
const blog = require('../blog')

const setup = async command => {
  const {client, talkToBotsChannel, kody} = makeFakeClient()
  const message = new Discord.Message(
    client,
    {
      id: 'help_test',
      content: `?blog ${command}`,
      author: kody.user,
    },
    talkToBotsChannel,
  )
  Object.assign(message, {
    mentions: new Discord.MessageMentions(message, [], [], false),
  })
  await blog(message)
  return talkToBotsChannel.send
}

test('should show the list of the last 10 articles', async () => {
  const send = await setup('last')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "This is the list of the last 10 articles on the blog:
    - How to React ⚛️
      <https://kentcdodds.com/blog/how-to-react>
    - Favor Progress Over Pride in Open Source
      <https://kentcdodds.com/blog/favor-progress-over-pride-in-open-source>
    - Testing Implementation Details
      <https://kentcdodds.com/blog/testing-implementation-details>
    - How getting into Open Source has been awesome for me
      <https://kentcdodds.com/blog/how-getting-into-open-source-has-been-awesome-for-me>
    - useState lazy initialization and function updates
      <https://kentcdodds.com/blog/use-state-lazy-initialization-and-function-updates>
    - Use ternaries rather than && in JSX
      <https://kentcdodds.com/blog/use-ternaries-rather-than-and-and-in-jsx>
    - Application State Management with React
      <https://kentcdodds.com/blog/application-state-management-with-react>
    - Use react-error-boundary to handle errors in React
      <https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react>
    - JavaScript to Know for React
      <https://kentcdodds.com/blog/javascript-to-know-for-react>
    - How I structure Express apps
      <https://kentcdodds.com/blog/how-i-structure-express-apps>"
  `)
})

test('should show articles matching the search string', async () => {
  let send = await setup('open source')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(`
    "This is the list of the articles matching \\"open source\\" 💻:
    - Favor Progress Over Pride in Open Source
      <https://kentcdodds.com/blog/favor-progress-over-pride-in-open-source>
    - How getting into Open Source has been awesome for me
      <https://kentcdodds.com/blog/how-getting-into-open-source-has-been-awesome-for-me>
    - What open source project should I contribute to?
      <https://kentcdodds.com/blog/what-open-source-project-should-i-contribute-to>"
  `)

  send = await setup('onditionally render content in JSX')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith(
    `https://kentcdodds.com/blog/use-ternaries-rather-than-and-and-in-jsx`,
  )

  send = await setup(`why you shouldn't mock fetch or your AP`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith(
    `https://kentcdodds.com/blog/stop-mocking-fetch`,
  )
})

test('should show the first articles retrieved', async () => {
  const send = await setup(`latest`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith(`https://kentcdodds.com/blog/how-to-react`)
})

test('should show an info message if not articles are found', async () => {
  const send = await setup(`not exist`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Unfortunately there is no article matching \\"not exist\\" 😟. Try searching here: <https://kentcdodds.com/blog>"`,
  )
})

test('should show an info message if there is an issue retrying articles', async () => {
  server.use(
    rest.get('https://kentcdodds.com/blog.json', (req, res, ctx) => {
      return res(ctx.status(500))
    }),
  )

  const send = await setup(`not exist`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchInlineSnapshot(
    `"Something went wrong retrieving the list of articles 😬. Try searching here: <https://kentcdodds.com/blog>"`,
  )
})

test('should give an error message if the user not provide a search term', async () => {
  const send = await setup(``)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith(
    `A search term is required. For example: \`?blog state management\``,
  )
})
