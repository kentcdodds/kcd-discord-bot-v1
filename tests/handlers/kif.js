const {rest} = require('msw')
const kif = require('../data/kif.json')

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
]

module.exports = handlers
