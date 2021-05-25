import type * as TDiscord from 'discord.js'
import {
  getSend,
  getMember,
  getBotMessages,
  welcomeChannelPrefix,
  editErrorMessagePrefix,
  getMessageContents,
  getMemberIdFromChannel,
  isCommand,
  isTextChannel,
  isActionOnlyStep,
  isRegularStep,
  botLog,
} from './utils'
import {getSteps, getAnswers, getCurrentStep, firstStep} from './steps'
import {deleteWelcomeChannel} from './delete-welcome-channel'

async function handleNewMessage(message: TDiscord.Message) {
  const {channel, guild} = message
  if (!guild) return
  if (!isTextChannel(channel)) return

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
  const memberId = getMemberIdFromChannel(channel)
  if (message.author.id !== memberId) return null

  const member = getMember(guild, memberId)
  if (!member) return

  // if they're asking for help, let Kent know in a bot log
  if (message.content.toLowerCase().split(/\s/).includes('help')) {
    void botLog(guild, () => {
      const kent = guild.members.cache.find(
        ({user: {username, discriminator}}) =>
          username === 'kentcdodds' && discriminator === '0001',
      )
      return `Hey ${kent}, ${member} is asking for help in ${channel}`
    })
  }

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
    await send(await getMessageContents(firstStep.feedback, answers, member))
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

  // @ts-expect-error TODO: make validate return the answer value
  answers[currentStep.name] = message.content
  if (currentStep.feedback) {
    await send(await getMessageContents(currentStep.feedback, answers, member))
  }

  await currentStep.action?.({answers, member, channel, isEdit: false})

  // run action-only steps
  let currentStepIndex = steps.indexOf(currentStep)
  while (currentStepIndex < steps.length) {
    const actionOnlyStep = steps[currentStepIndex + 1]
    if (!isActionOnlyStep(actionOnlyStep)) break
    currentStepIndex = currentStepIndex + 1
    // we want these run one at a time, not in parallel
    // eslint-disable-next-line no-await-in-loop
    await actionOnlyStep.action({answers, member, channel, isEdit: false})
  }

  // run next question step without an answer
  const nextStep = steps
    .slice(currentStepIndex + 1)
    .filter(isRegularStep)
    .find(step => !answers.hasOwnProperty(step.name))
  if (nextStep) {
    await send(await getMessageContents(nextStep.question, answers, member))
  }
}

export {handleNewMessage}
