import {rest} from 'msw'
import posts from '../data/kcd-blog.json'

const handlers = [
  rest.get('https://kentcdodds.com/blog.json', (req, res, ctx) => {
    return res(ctx.json(posts))
  }),
]

export {handlers}
