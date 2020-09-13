export function dedupeMessages(client) {
  client.on('message', message => {
    // this function can check whether the content of the message you pass is the same as this message
    const getMessages = msg => {
      return (
        msg.content.toLowerCase() == message.content.toLowerCase() &&
        msg.author === message.author
      )
    }

    message.channel
      .awaitMessages(getMessages, {
        maxMatches: 1,
        time: 10 * 1000,
      })
      .then(collected => {
        console.log(collected)
        // this function will be called when a message matches you filter
      })
      .catch(console.error)
  })
}
