import type * as TDiscord from 'discord.js'
import {
  getSend,
  getBotMessages,
  welcomeChannelPrefix,
  getMessageContents,
  getMember,
  editErrorMessagePrefix,
  isCommand,
  getMemberIdFromChannel,
  isTextChannel,
  isRegularStep,
  Answers,
} from './utils'
import {getSteps, getAnswers} from './steps'

// eslint-disable-next-line complexity
async function handleUpdatedMessage(
  oldMessage: TDiscord.Message | TDiscord.PartialMessage,
  newMessage: TDiscord.Message | TDiscord.PartialMessage,
) {
  if (newMessage.partial) {
    newMessage = await newMessage.fetch()
  }
  if (oldMessage.partial) {
    oldMessage = await oldMessage.fetch()
  }

  const {channel, author} = newMessage

  if (!isTextChannel(channel) || !newMessage.content) return

  const send = getSend(channel)

  // must be a welcome channel
  if (!channel.name.startsWith(welcomeChannelPrefix)) return

  // allow commands to be handled somewhere else
  if (isCommand(newMessage.content)) return

  // message must have been sent from the new member
  const memberId = getMemberIdFromChannel(channel)
  if (author.id !== memberId) return null

  const member = getMember(newMessage.guild, memberId)
  if (!member) return

  const steps = getSteps(member)

  const messages = Array.from((await channel.messages.fetch()).values())
  const botMessages = getBotMessages(messages)
  const previousAnswers = getAnswers(botMessages, member)
  const messageAfterEditedMessage = messages[messages.indexOf(newMessage) - 1]
  if (!messageAfterEditedMessage) return

  const editedStep = steps
    .filter(isRegularStep)
    .find(s => s.getAnswer(messageAfterEditedMessage.content, member))
  if (!editedStep) return

  const error = await editedStep.validate({
    message: newMessage,
    answers: previousAnswers,
  })
  if (error) {
    await send(`${editErrorMessagePrefix} ${error}`)
    return
  }

  const promises: Array<Promise<unknown>> = []

  // get the error message we printed previously due to any bad edits
  const stepErrorMessage = await editedStep.validate({
    message: oldMessage,
    answers: previousAnswers,
  })
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  const editErrorMessagesToDelete = stepErrorMessage
    ? editErrorMessages.filter(({content}) =>
        content.includes(stepErrorMessage),
      )
    : []
  promises.push(
    ...editErrorMessagesToDelete.map(m =>
      m.delete({reason: 'Edit error resolved.'}),
    ),
  )

  const answers: Answers = {...previousAnswers}
  // @ts-expect-error TODO: make validate return the answer value
  answers[editedStep.name] = newMessage.content

  const contentAndMessages = []
  for (const step of steps.filter(isRegularStep)) {
    contentAndMessages.push(
      [
        // eslint-disable-next-line no-await-in-loop
        await getMessageContents(step.question, answers, member),
        messages.find(msg => {
          if (step.isQuestionMessage) {
            return step.isQuestionMessage(msg.content)
          } else {
            return step.question === msg.content
          }
        }),
      ] as const,
      [
        // eslint-disable-next-line no-await-in-loop
        await getMessageContents(step.feedback, answers, member),
        messages.find(msg => step.getAnswer(msg.content, member)),
        step,
      ] as const,
    )
  }
  for (const [newContent, msg, step] of contentAndMessages) {
    if (msg && msg.content !== newContent) {
      promises.push(
        (async () => {
          await msg.edit(newContent)
          await step?.action?.({
            answers,
            member,
            channel,
            isEdit: true,
          })
        })(),
      )
    }
  }

  await Promise.all(promises)

  if (editErrorMessages.length === editErrorMessagesToDelete.length) {
    const currentStep = steps
      .filter(isRegularStep)
      .find(step => !answers.hasOwnProperty(step.name))
    if (currentStep) {
      await send(`Thanks for fixing things up, now we can continue.`)
      await send(
        await getMessageContents(currentStep.question, answers, member),
      )
    }
  }
}

export {handleUpdatedMessage}
