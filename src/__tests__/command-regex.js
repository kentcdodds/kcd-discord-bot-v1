const {commandRegex} = require('../utils')

test.each([
  ['?ping', {command: 'ping', args: ''}],
  ['?ping ', {command: 'ping', args: ''}],
  ['?ping hello there', {command: 'ping', args: 'hello there'}],
  [
    '?ping this is \n multiple lines',
    {command: 'ping', args: 'this is \n multiple lines'},
  ],
  [
    'This is multiple lines\n?ping arguments are everything after the command\n not an argument',
    {
      command: 'ping',
      args: 'arguments are everything after the command\n not an argument',
    },
  ],
])('"%s" matches', (input, parsed) => {
  expect(input.match(commandRegex).groups).toEqual(parsed)
})

test.each([['?'], ['? ping'], ['?\nping']])('"%s" does not match', input => {
  expect(input.match(commandRegex)).toBeNull()
})
