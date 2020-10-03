const {rest} = require('msw')
const blog = require('../blog')
const {server} = require('../../../../tests/server')

const setup = async command => {
  const send = jest.fn(() => Promise.resolve())

  const message = {content: `?blog ${command}`, channel: {send}}
  await blog(message)

  return send
}

test('should show the list of the last 10 articles', async () => {
  const send = await setup('last')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send)
    .toHaveBeenCalledWith(`This is the list of the last 10 articles on the blog:
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
  <https://kentcdodds.com/blog/how-i-structure-express-apps>`)
})

test('should show articles matching the search string', async () => {
  let send = await setup('useState lazy initialization and function updates')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send)
    .toHaveBeenCalledWith(`This is the list of the articles matching your search 💻:
- useState lazy initialization and function updates
  <https://kentcdodds.com/blog/use-state-lazy-initialization-and-function-updates>`)

  send = await setup('onditionally render content in JSX')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send)
    .toHaveBeenCalledWith(`This is the list of the articles matching your search 💻:
- Use ternaries rather than && in JSX
  <https://kentcdodds.com/blog/use-ternaries-rather-than-and-and-in-jsx>`)

  send = await setup(`why you shouldn't mock fetch or your AP`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send)
    .toHaveBeenCalledWith(`This is the list of the articles matching your search 💻:
- Stop mocking fetch
  <https://kentcdodds.com/blog/stop-mocking-fetch>`)
})

test('should show an info message if not articles are found', async () => {
  const send = await setup(`not exist`)

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith(
    `😟 Unfortunately there is no article matching your search. Could you try again 😀?`,
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
  expect(send).toHaveBeenCalledWith(
    `🤯 Something went wront retrieving the list of articles. Could you try in a few minutes?😀?`,
  )
})
