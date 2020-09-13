export function dedupeMessages(message, client) {
  const messagesFilter = msg => {
    return (
      msg.content.toLowerCase() === message.content.toLowerCase() &&
      msg.author === message.author &&
      msg.content.length > 50
    )
  }

  message.channel
    .awaitMessages(messagesFilter, {
      maxMatches: 1,
      time: 1800000, // 30 minutes
    })
    .then(collected => {
      collected.last().delete()
      client.channels
        .get('#🤖-talk-to-bots')
        .send(
          `Greetings ${message.author}, I deleted a duplicate message, please give it time for users to respond. If you think your message is better suited in another channel please delete then repost. Thank you`,
        )
    })
    .catch(console.error)
}
