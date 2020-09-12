const Rollbar = require('rollbar')

if (process.env.NODE_ENV === 'production') {
  // include and initialize the rollbar library with your access token
  const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
  })
  module.exports = rollbar
} else {
  module.exports = console
}
