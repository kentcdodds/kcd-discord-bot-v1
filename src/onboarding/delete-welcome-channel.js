const got = require('got')
const {
  getSubscriberEndpoint,
  CONVERT_KIT_API_SECRET,
  CONVERT_KIT_API_KEY,
  getBotMessages,
  getMemberId,
  getSend,
  sleep,
} = require('./utils')
const {getAnswers} = require('./steps')

async function deleteWelcomeChannel(channel, reason) {
  const send = getSend(channel)
  const memberId = getMemberId(channel)
  const member = channel.guild.members.cache.find(
    ({user}) => user.id === memberId,
  )

  const memberIsUnconfirmed =
    !member ||
    member.roles.cache.find(({name}) => name === 'Unconfirmed Member')
  await send(
    `
This channel is getting deleted for the following reason: ${reason}

Goodbye 👋
    `.trim(),
  )
  const promises = []
  if (memberIsUnconfirmed && member) {
    await send(
      `You're still an unconfirmed member so you'll be kicked from the server. But don't worry, you can try again later.`,
    )
    promises.push(
      member.kick(
        `Unconfirmed member with welcome channel deleted because: ${reason}`,
      ),
    )
  } else {
    // if they reacted with their preferred tech, update their info in convertkit
    // to reflect those preferences
    const messages = Array.from((await channel.messages.fetch()).values())
    const reactionMessage = getBotMessages(messages).find(({content}) =>
      /Click the icon of the tech/.test(content),
    )
    if (reactionMessage) {
      const interests = reactionMessage.reactions.cache
        // because the new member is the only one in the channel, the only
        // way we could have more than 1 reaction to a message is if the bot
        // listed it as an option AND the member selected it.
        // doing things this way helps us avoid having to call
        // `await reaction.users.fetch()` for every reaction
        .filter(({count}) => count > 1)
        .map(({emoji}) => emoji.name)
        // sort alphabetically
        .sort((a, z) => (a < z ? -1 : a > z ? 1 : 0))
        .join(',')

      if (interests.length) {
        const botMessages = getBotMessages(messages)
        const answers = getAnswers(botMessages, member)

        promises.push(
          (async () => {
            const {body: {subscribers: [subscriber] = []} = {}} = await got(
              getSubscriberEndpoint(answers.email),
              {
                responseType: 'json',
              },
            )
            if (!subscriber) {
              // they got deleted quickly or something
              return
            }

            try {
              await got.put(
                `https://api.convertkit.com/v3/subscribers/${subscriber.id}`,
                {
                  responseType: 'json',
                  json: {
                    api_key: CONVERT_KIT_API_KEY,
                    api_secret: CONVERT_KIT_API_SECRET,
                    fields: {tech_interests: interests},
                  },
                },
              )
            } catch (error) {
              // possibly a 404 because the subscriber was deleted
              console.error(
                `Error setting the subscriber's interests: `,
                {
                  interests,
                  subscriberId: subscriber.id,
                  memberId: member?.id,
                },
                error.message,
              )
            }
          })(),
        )
      }
    }
  }

  await Promise.all(promises)

  // wait for 3 seconds so folks can read the messages before it's deleted
  // note: don't do 5 seconds or more because that's how long the interval is set to
  await sleep(3000)
  await channel.delete(reason)
}

module.exports = {deleteWelcomeChannel}
