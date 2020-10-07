const {rest} = require('msw')

const handlers = [
  rest.get('https://api.convertkit.com/v3/subscribers', (req, res, ctx) => {
    return res(
      ctx.json({
        total_subscribers: 0,
        page: 1,
        total_pages: 1,
        subscribers: [],
      }),
    )
  }),
  rest.post(
    'https://api.convertkit.com/v3/forms/:formId/subscribe',
    (req, res, ctx) => {
      const {formId} = req.params
      const {first_name, email, fields} = req.body
      return res(
        ctx.json({
          subscription: {
            id: 1234567890,
            state: 'active',
            created_at: new Date().toJSON(),
            source: 'API::V3::SubscriptionsController (external)',
            referrer: null,
            subscribable_id: formId,
            subscribable_type: 'form',
            subscriber: {
              id: 987654321,
              first_name,
              email_address: email,
              state: 'inactive',
              created_at: new Date().toJSON(),
              fields,
            },
          },
        }),
      )
    },
  ),
  rest.post(
    'https://api.convertkit.com/v3/tags/:tagId/subscribe',
    (req, res, ctx) => {
      const {tagId} = req.params
      const {first_name, email, fields} = req.body
      return res(
        ctx.json({
          subscription: {
            id: 1234567890,
            state: 'active',
            created_at: new Date().toJSON(),
            source: 'API::V3::SubscriptionsController (external)',
            referrer: null,
            subscribable_id: tagId,
            subscribable_type: 'tag',
            subscriber: {
              id: 987654321,
              first_name,
              email_address: email,
              state: 'inactive',
              created_at: new Date().toJSON(),
              fields,
            },
          },
        }),
      )
    },
  ),
  rest.get('https://www.gravatar.com/avatar/:hash', (req, res, ctx) => {
    return res(ctx.status(200))
  }),
]

module.exports = handlers
