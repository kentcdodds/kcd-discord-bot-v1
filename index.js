const path = require('path')

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'local'}`,
})

if (process.env.NODE_ENV === 'production') {
  require('./dist')
} else {
  require('ts-node').register({
    dir: path.resolve('src'),
    pretty: true,
    transpileOnly: true,
    ignore: ['/node_modules/', '/__tests__/'],
    project: require.resolve('./tsconfig.json'),
  })
  require('./src')
}
