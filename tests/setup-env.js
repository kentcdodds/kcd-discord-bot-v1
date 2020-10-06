const {server} = require('./server')

process.env.CONVERT_KIT_API_KEY = 'FAKE_CONVERT_KIT_API_KEY'
process.env.CONVERT_KIT_API_SECRET = 'FAKE_CONVERT_KIT_API_SECRET'

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
