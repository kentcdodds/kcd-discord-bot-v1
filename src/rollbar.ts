import Rollbar from 'rollbar'

function getLogger(): typeof console {
  if (process.env.NODE_ENV === 'production') {
    // include and initialize the rollbar library with your access token
    // @ts-expect-error ugh...
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
