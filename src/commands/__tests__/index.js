const {handleNewMessage} = require('..')

test('handles incoming messages', async () => {
  const send = jest.fn()
  await handleNewMessage({
    content: '?help',
    channel: {send},

    // someone please save me...
    guild: {
      roles: {
        cache: {
          find() {
            return {name: 'Member'}
          },
        },
      },
      members: {
        cache: {
          find() {
            return {
              id: '1234',
              roles: {
                cache: {
                  has() {
                    return true
                  },
                },
              },
            }
          },
        },
      },
    },
    author: {id: '1234'},
  })
  expect(send).toHaveBeenCalledTimes(1)
})
