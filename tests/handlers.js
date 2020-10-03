const {rest} = require('msw')
const kif = require('./data/kif.json')
const posts = require('./data/kcd-blog.json')

const handlers = [
  rest.get(
    'https://api.github.com/repos/kentcdodds/kifs/contents/kifs.json',
    (req, res, ctx) => {
      return res(
        ctx.json({
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(kif)).toString('base64'),
        }),
      )
    },
  ),
  rest.get('https://kentcdodds.com/blog.json', (req, res, ctx) => {
    return res(ctx.json(posts))
  }),
]

module.exports = handlers
