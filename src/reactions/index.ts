import type * as TDiscord from 'discord.js'
import reactions from './reactions'

async function handleNewReaction(messageReaction: TDiscord.MessageReaction) {
  if (messageReaction.partial) {
    try {
      await messageReaction.fetch()
    } catch (error: unknown) {
      console.error('Something went wrong when fetching the message: ', error)
      return
    }
  }
  const guild = messageReaction.message.guild
  if (!guild) return

  const emoji = messageReaction.emoji

  const reactionFn = reactions[emoji.name]
  if (!reactionFn) return

  await reactionFn(messageReaction)

  //TODO Get rid of this
  if (emoji.name === '✅') return

  //TODO Move this to the actual reaction function?!
  await messageReaction.remove()
}

function setup(client: TDiscord.Client) {
  client.on('messageReactionAdd', messageReaction => {
    // eslint-disable-next-line no-void
    void handleNewReaction(messageReaction)
  })
}

export {handleNewReaction, setup}
