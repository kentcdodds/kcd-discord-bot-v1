const sleep = t =>
  new Promise(resolve =>
    setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : t),
  )

const getSend = channel => async (...args) => {
  const result = await channel.send(...args)
  // wait a brief moment before continuing because channel.send doesn't
  // always resolve after the message is actually sent.
  await sleep(200)
  return result
}

const getBotMessages = messages =>
  messages.filter(({author, client}) => author.id === client.user.id)

function getMemberIdFromChannel(channel) {
  return (
    channel.topic.match(/Member ID: "(?<memberId>.*?)"/)?.groups?.memberId ??
    null
  )
}

module.exports = {
  sleep,
  getSend,
  getMemberIdFromChannel,
  getBotMessages,
}
