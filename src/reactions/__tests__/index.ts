/* eslint-disable @typescript-eslint/no-var-requires */
import {makeFakeClient, waitUntil} from 'test-utils'
import {setup} from '../'

async function setupTest({
  content = 'Some random message',
  reactionName,
}: {
  content?: string
  reactionName: string
}) {
  const utils = await makeFakeClient()
  const {
    client,
    defaultChannels: {generalChannel},
    kody,
    hannah,
    sendFromUser,
    reactFromUser,
  } = utils
  setup(client)
  const message = sendFromUser({
    user: kody,
    channel: generalChannel,
    content,
  })

  reactFromUser({user: hannah, reactionName, message})

  await waitUntil(() => {
    // the bot removes the reaction
    expect(message.reactions.cache.size).toBe(0)
  })
  return utils
}

test('bot-ask sends the message author the ask reply', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `I have a question, but I'm not giving enough details`,
    reactionName: 'bot-ask',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, We appreciate your question and we want to help you. Could you please give us more details? Please follow the guidelines in <https://kcd.im/ask> (especially the part about making a <https://kcd.im/repro>) and then we'll be able to answer your question.`,
  )
})

test('bot-office-hours sends the message author the office-hours reply', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `I have a question that Kent can answer but doesn't have time right now`,
    reactionName: 'bot-office-hours',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, If you don't get a satisfactory answer here, then you can feel free to ask Kent during his <https://kcd.im/office-hours> in <#🏫-kcd-office-hours>. To do so, formulate your question to make sure it's clear (follow the guildelines in <https://kcd.im/ask>) and a <https://kcd.im/repro> helps a lot if applicable. Then post it to <#🏫-kcd-office-hours> or join the meeting and ask live. Kent streams/records his office hours on YouTube so even if you can't make it in person, you should be able to watch his answer later.`,
  )
})

test('bot-dontasktoask sends the message author dontasktoask.com', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `Can I ask a question?`,
    reactionName: 'bot-dontasktoask',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, We're happy to answer your questions! You don't need to bother asking. Learn more: <https://dontasktoask.com>`,
  )
})

test('bot-help sends the reacting user a message in talk-to-bots with info on the reaction emoji', async () => {
  const {
    defaultChannels: {talkToBotsChannel},
  } = await setupTest({
    reactionName: 'bot-help',
  })

  expect(talkToBotsChannel.lastMessage?.content).toMatchInlineSnapshot(`
    <@!hannah> Here are the available bot reactions:

    - bot-help: Lists available bot reactions
    - bot-ask: Sends a reply to the message author explaining how to improve their question
    - bot-office-hours: Sends a reply to the message author explaining how to ask their question during Office Hours.
    - bot-dontasktoask: Sends a reply to the message author explaining that they don't need to ask to ask.
  `)
})
