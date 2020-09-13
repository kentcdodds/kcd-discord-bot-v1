export function dedupeMessages(client) {
  client.on('message', message => {
    const getMessages = msg => {
      return (
        msg.content.toLowerCase() === message.content.toLowerCase() &&
        msg.author === message.author
      )
    }

    message.channel
      .awaitMessages(getMessages, {
        maxMatches: 1,
        time: 10 * 1000,
      })
      .then(collected => collected.last().delete())
      .catch(console.error)

    client.channels
      .get() //! I dont know the Bot Channels ID
      .send(
        `Greetings ${message.author}, I deleted a duplicate message, please give it time for users to respond. If you think your message is better suited in another channel please delete then repost. Thank you`,
      )
  })
}
