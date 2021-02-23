import Rollbar from 'rollbar'

function getLogger() {
  if (process.env.NODE_ENV === 'production') {
    // include and initialize the rollbar library with your access token
    return new Rollbar({
      accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
      captureUncaught: true,
      captureUnhandledRejections: true,
    })
  } else {
    return console
  }
}

export default getLogger()
