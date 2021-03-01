import Discord from 'discord.js'
import {rest} from 'msw'
import {server} from 'server'
import {makeFakeClient} from 'test-utils'
import {blog} from '../blog'

const setup = async (command: string) => {
  const {
    client,
    defaultChannels: {talkToBotsChannel},
    kody,
    cleanup,
  } = await makeFakeClient()
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

  if (talkToBotsChannel.messages.cache.size !== 1) {
    throw new Error(`The bot didn't send only a single reply`)
  }

  const reply = talkToBotsChannel.lastMessage
  if (!reply) throw new Error(`The bot didn't send a reply`)

  return {reply, cleanup}
}

test('should show the list of the last 10 articles', async () => {
  const {reply} = await setup('last')

  expect(reply.content).toMatchInlineSnapshot(`
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
  let utils = await setup('open source')

  expect(utils.reply.content).toMatchInlineSnapshot(`
    "This is the list of the articles matching \\"open source\\" 💻:
    - Favor Progress Over Pride in Open Source
      <https://kentcdodds.com/blog/favor-progress-over-pride-in-open-source>
    - How getting into Open Source has been awesome for me
      <https://kentcdodds.com/blog/how-getting-into-open-source-has-been-awesome-for-me>
    - What open source project should I contribute to?
      <https://kentcdodds.com/blog/what-open-source-project-should-i-contribute-to>"
  `)

  utils.cleanup()
  utils = await setup('conditionally render content in JSX')

  expect(utils.reply.content).toEqual(
    `https://kentcdodds.com/blog/use-ternaries-rather-than-and-and-in-jsx`,
  )
  utils.cleanup()

  utils = await setup(`why you shouldn't mock fetch or your AP`)

  expect(utils.reply.content).toEqual(
    `https://kentcdodds.com/blog/stop-mocking-fetch`,
  )
})

test('should show the first articles retrieved', async () => {
  const {reply} = await setup(`latest`)

  expect(reply.content).toEqual(`https://kentcdodds.com/blog/how-to-react`)
})

test('should show an info message if not articles are found', async () => {
  const {reply} = await setup(`not exist`)

  expect(reply.content).toMatchInlineSnapshot(
    `"Unfortunately there is no article matching \\"not exist\\" 😟. Try searching here: <https://kentcdodds.com/blog>"`,
  )
})

test('should show an info message if there is an issue retrying articles', async () => {
  server.use(
    rest.get('https://kentcdodds.com/blog.json', (req, res, ctx) => {
      return res(ctx.status(500))
    }),
  )

  const {reply} = await setup(`not exist`)

  expect(reply.content).toMatchInlineSnapshot(
    `"Something went wrong retrieving the list of articles 😬. Try searching here: <https://kentcdodds.com/blog>"`,
  )
})

test('should give an error message if the user not provide a search term', async () => {
  const {reply} = await setup(``)

  expect(reply.content).toMatchInlineSnapshot(
    `"A search term is required. For example: \`?blog state management\`"`,
  )
})

test('should show the first 10 results if there are more', async () => {
  const {reply} = await setup(`re`)

  expect(reply.content).toMatchInlineSnapshot(`
    "There are too many results for \\"re\\". Here are the top 10:
    - How to React ⚛️
      <https://kentcdodds.com/blog/how-to-react>
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
    - 💯 UPDATED: Advanced React Component Patterns ⚛️
      <https://kentcdodds.com/blog/updated-advanced-react-component-patterns>
    - Testing Implementation Details
      <https://kentcdodds.com/blog/testing-implementation-details>
    - How I Record Educational Videos
      <https://kentcdodds.com/blog/how-i-record-educational-videos>
    - Should I write a test or fix a bug?
      <https://kentcdodds.com/blog/should-i-write-a-test-or-fix-a-bug>"
  `)
})

test('should return an article link for random', async () => {
  const {reply} = await setup(`random`)

  expect(reply.content).toContain(`https://kentcdodds.com/blog/`)
})
