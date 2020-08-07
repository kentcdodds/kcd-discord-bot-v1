const http = require('http')

const hostname = '127.0.0.1'
const port = process.env.PORT ?? 8888

const server = http.createServer((req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('The bot is running...')
})

server.listen(port, hostname, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://${hostname}:${port}/`)
})
