const {regex} = require('../command-regex')

test.each([
  ['?ping', {command: 'ping', args: ''}],
  ['?ping ', {command: 'ping', args: ''}],
  ['?ping hello there', {command: 'ping', args: 'hello there'}],
  [
    '?ping this is \n multiple lines',
    {command: 'ping', args: 'this is \n multiple lines'},
  ],
])('"%s" matches', (input, parsed) => {
  expect(input.match(regex).groups).toEqual(parsed)
})

test.each([['?'], ['? ping'], ['?\nping']])('"%s" does not match', input => {
  expect(input.match(regex)).toBeNull()
})
