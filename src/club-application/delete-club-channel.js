const {getSend, sleep} = require('./utils')

async function deleteClubChannel(channel, reason) {
  const send = getSend(channel)

  await send(
    `
This channel is getting deleted for the following reason: ${reason}

Goodbye 👋
    `.trim(),
  )

  // wait for 3 seconds so folks can read the messages before it's deleted
  // note: don't do 5 seconds or more because that's how long the interval is set to
  await sleep(3000)
  await channel.delete(reason)
}

module.exports = {deleteClubChannel}
