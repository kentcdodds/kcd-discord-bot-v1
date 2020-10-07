const {rest} = require('msw')
const posts = require('../data/kcd-blog.json')

const handlers = [
  rest.get('https://kentcdodds.com/blog.json', (req, res, ctx) => {
    return res(ctx.json(posts))
  }),
]

module.exports = handlers
