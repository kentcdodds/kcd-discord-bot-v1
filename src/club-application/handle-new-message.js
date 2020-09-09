const {
  getSend,
  getBotMessages,
  newClubChannelPrefix,
  editErrorMessagePrefix,
  getMessageContents,
  getCaptainFromChannel,
} = require('./utils')
const {getSteps, getAnswers, getCurrentStep} = require('./steps')
const {deleteClubChannel} = require('./delete-club-channel')

async function handleNewMessage(message) {
  const {channel} = message
  const send = getSend(channel)

  // must be a new club
  if (!channel.name.startsWith(newClubChannelPrefix)) return

  const messages = Array.from((await channel.messages.fetch()).values())
  const captain = getCaptainFromChannel(message.channel)

  if (
    message.author.id === captain.id &&
    message.content.toLowerCase() === 'delete'
  ) {
    return deleteClubChannel(channel, 'Requested by the captain')
  }

  const firstQuestionContent = await getMessageContents(
    getSteps()[0].question,
    {},
    captain,
  )

  // if we haven't sent the first question, send it now
  if (!messages.some(msg => msg.content === firstQuestionContent)) {
    await send(firstQuestionContent)
    return
  }

  // message must have been sent from the captain
  if (message.author.id !== captain.id) return

  const steps = getSteps(captain)

  const botMessages = getBotMessages(messages)
  const editErrorMessages = botMessages.filter(({content}) =>
    content.startsWith(editErrorMessagePrefix),
  )
  if (editErrorMessages.length) {
    await send(
      `There are existing errors with your previous answers, please edit your answer above before continuing.`,
    )
    return
  }

  const answers = getAnswers(botMessages, captain)

  // find the first step with no answer
  const currentStep = getCurrentStep(steps, answers)

  if (!currentStep) {
    // there aren't any answers yet, so let's send the first feedback
    await send(await getMessageContents(steps[0].feedback, answers, captain))
    return
  }

  const currentStepQuestionContent = await getMessageContents(
    currentStep.question,
    answers,
    captain,
  )
  const questionHasBeenAsked = botMessages.find(
    ({content}) => currentStepQuestionContent === content,
  )
  if (!questionHasBeenAsked) {
    await send(currentStepQuestionContent)
    return
  }

  const error = await currentStep.validate({message, answers})
  if (error) {
    await send(error)
    return
  }

  answers[currentStep.name] = message.content
  if (currentStep.feedback) {
    await send(await getMessageContents(currentStep.feedback, answers, captain))
  }

  await currentStep.action?.({answers, member: captain, channel, isEdit: false})

  // run action-only steps
  let currentStepIndex = steps.indexOf(currentStep)
  while (steps[currentStepIndex + 1]?.actionOnlyStep) {
    currentStepIndex = currentStepIndex + 1
    const actionOnlyStep = steps[currentStepIndex]
    // we want these run one at a time, not in parallel
    // eslint-disable-next-line no-await-in-loop
    await actionOnlyStep.action({
      answers,
      member: captain,
      channel,
      isEdit: false,
    })
  }

  // run next question step without an answer
  const nextStep = steps
    .slice(currentStepIndex + 1)
    .find(step => !answers.hasOwnProperty(step.name))
  if (nextStep) {
    await send(await getMessageContents(nextStep.question, answers, captain))
  }
}

module.exports = {handleNewMessage}
