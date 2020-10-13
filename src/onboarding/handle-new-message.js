const {
  getSend,
  getMember,
  getBotMessages,
  welcomeChannelPrefix,
  editErrorMessagePrefix,
  getMessageContents,
  getMemberIdFromChannel,
  isCommand,
} = require('./utils')
const {getSteps, getAnswers, getCurrentStep} = require('./steps')
const {deleteWelcomeChannel} = require('./delete-welcome-channel')

async function handleNewMessage(message) {
  const {channel} = message
  const send = getSend(channel)

  // must be a welcome channel
  // check for existance of the channel name because rollbar said our
  // bot ran into this being undefined several times. I'm not sure how though...
  if (!channel.name || !channel.name.startsWith(welcomeChannelPrefix)) return

  if (message.content.toLowerCase() === 'delete') {
    return deleteWelcomeChannel(channel, 'Requested by the member')
  }

  // allow commands to be handled somewhere else
  if (isCommand(message.content)) return

  // message must have been sent from the new member
  const memberId = getMemberIdFromChannel(message.channel)
  if (message.author.id !== memberId) return null

  const member = getMember(message.guild, memberId)
  if (!member) return

  const steps = getSteps(member)

  const messages = Array.from((await channel.messages.fetch()).values())
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

  const answers = getAnswers(botMessages, member)

  // find the first step with no answer
  const currentStep = getCurrentStep(steps, answers)

  if (!currentStep) {
    // there aren't any answers yet, so let's send the first feedback
    await send(await getMessageContents(steps[0].feedback, answers, member))
    return
  }

  const currentStepQuestionContent = await getMessageContents(
    currentStep.question,
    answers,
    member,
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
    await send(await getMessageContents(currentStep.feedback, answers, member))
  }

  await currentStep.action?.({answers, member, channel, isEdit: false})

  // run action-only steps
  let currentStepIndex = steps.indexOf(currentStep)
  while (steps[currentStepIndex + 1].actionOnlyStep) {
    currentStepIndex = currentStepIndex + 1
    const actionOnlyStep = steps[currentStepIndex]
    // we want these run one at a time, not in parallel
    // eslint-disable-next-line no-await-in-loop
    await actionOnlyStep.action({answers, member, channel, isEdit: false})
  }

  // run next question step without an answer
  const nextStep = steps
    .slice(currentStepIndex + 1)
    .find(step => !answers.hasOwnProperty(step.name))
  if (nextStep) {
    await send(await getMessageContents(nextStep.question, answers, member))
  }
}

module.exports = {handleNewMessage}
