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

/**
 * The name will be lowercased and the first channel that includes the given
 * name will be returned
 * @param {*} guild the guild to find the channel in
 * @param {{name: string, type: 'text' | 'voice'}} searchOptions
 */
function getChannel(guild, {name, type = 'text'}) {
  return guild.channels.cache.find(
    ch =>
      ch.name.toLowerCase().includes(name.toLowerCase()) && type === ch.type,
  )
}

/**
 * The name will be lowercased and the first channel with a lowercased name that
 * equals it will be returned.
 * @param {*} guild the guild to find the role in
 * @param {{name: string}} searchOptions
 */
function getRole(guild, {name}) {
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === name.toLowerCase(),
  )
}

module.exports = {
  sleep,
  getSend,
  getMemberIdFromChannel,
  getBotMessages,
  getChannel,
  getRole,
}
