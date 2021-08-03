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
    defaultChannels: {generalChannel, botLogsChannel},
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

  // bot logs the fact the reaction was added, so wait for that log to happen
  await waitUntil(() => {
    expect(botLogsChannel.messages.cache.size).toBe(1)
  })
  return utils
}

test('botask sends the message author the ask reply', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `I have a question, but I'm not giving enough details`,
    reactionName: 'botask',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, We appreciate your question and we'll do our best to help you when we can. Could you please give us more details? Please follow the guidelines in <https://kcd.im/ask> (especially the part about making a <https://kcd.im/repro>) and then we'll be able to answer your question.`,
  )
})

test('botofficehours sends the message author the office-hours reply', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `I have a question that Kent can answer but doesn't have time right now`,
    reactionName: 'botofficehours',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, If you don't get a satisfactory answer here, feel free to ask Kent during his <https://kcd.im/office-hours> in <#🏫-kcd-office-hours>. To do so, formulate your question to make sure it's clear (follow the guidelines in <https://kcd.im/ask>) and a <https://kcd.im/repro> helps a lot if applicable. Then post it to <#🏫-kcd-office-hours> or join the meeting and ask live. Kent streams/records his office hours on YouTube so even if you can't make it in person, you should be able to watch his answer later.`,
  )
})

test('botdontasktoask sends the message author dontasktoask.com', async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `Can I ask a question?`,
    reactionName: 'botdontasktoask',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, We're happy to answer your questions if we can, so you don't need to ask if you can ask. Learn more: <https://dontasktoask.com>`,
  )
})

test(`botdouble sends the message author an explanation that they shouldn't post the same thing twice`, async () => {
  const {
    defaultChannels: {generalChannel},
  } = await setupTest({
    content: `I already said this`,
    reactionName: 'botdouble',
  })

  expect(generalChannel.lastMessage?.content).toMatchInlineSnapshot(
    `<@!kody>, Please avoid posting the same thing in multiple channels. Choose the best channel, and wait for a response there. Please delete the other message to avoid fragmenting the answers and causing confusion. Thanks!`,
  )
})

test('bothelp sends the reacting user a message in talk-to-bots with info on the reaction emoji', async () => {
  const {
    defaultChannels: {talkToBotsChannel},
  } = await setupTest({
    reactionName: 'bothelp',
  })

  expect(talkToBotsChannel.lastMessage?.content).toMatchInlineSnapshot(`

      <@!hannah> Here are the available bot reactions:

      - bothelp: Lists available bot reactions.
      - botask: Sends a reply to the message author explaining how to improve their question.
      - botofficehours: Sends a reply to the message author explaining how to ask their question during Office Hours.
      - botdontasktoask: Sends a reply to the message author explaining that they don't need to ask to ask.
      - botdouble: Sends a reply to the message author explaining that they shouldn't ask the same question twice.
      - botgender: Sends a reply to the message author asking them to use gender neutral terms when addressing Discord members.
  `)
})

test('botgender sends the user a message in the #bot-messages channel asking them to use gender neutral terms to address Discord members', async () => {
  const {
    defaultChannels: {botMessagesChannel},
  } = await setupTest({
    content: `Hi guys`,
    reactionName: 'botgender',
  })

  const botMsg = botMessagesChannel.lastMessage
  expect(botMsg?.content).toMatchInlineSnapshot(`
    <@!kody> We want all our community members to feel included and using gender neutral words helps a lot. Please edit your message (<https://discordapp.com/channels/:guildId/:channelId/:messageId>) using "friends", "people", "folks", or "everyone" instead of "guys", or similar. Read more here: https://kcd.im/coc.

    React with :botconfirm: to confirm you understand, so this message can be automatically deleted.
  `)

  expect(botMsg?.reactions.cache.get('botconfirm')).toBeTruthy()
})

test('botgender reply is deleted only when the replied user reacts with :botconfirm:', async () => {
  // In the bot-messages channel there is a message generated by the botgender replying
  // to <@!hannah> asking them to use gender neutral words:
  const utils = await makeFakeClient()
  const {
    client,
    defaultChannels: {botMessagesChannel, botLogsChannel},
    marty,
    kody,
    hannah,
    sendFromUser,
    reactFromUser,
  } = utils
  setup(client)
  const message = sendFromUser({
    user: kody,
    channel: botMessagesChannel,
    content: `<@!${hannah.id}> Please use gender neutral words... (this is not the actual text, but it is not relevant for this test)`,
  })

  // Add a checkmark, which is normally done by the botgender bot when sending the message.
  // For this test it doesn't really matter who puts the botgender reaction on it.
  reactFromUser({user: marty, message, emoji: {name: 'botconfirm'}})
  expect(botMessagesChannel.messages.cache.size).toBe(1)
  await waitUntil(() => {
    expect(botLogsChannel.messages.cache.size).toBe(1)
  })

  // Some user other than <@!hannah> reacts on it with :botconfirm: so the message should not be deleted.
  reactFromUser({user: kody, message, emoji: {name: 'botconfirm'}})
  expect(botMessagesChannel.messages.cache.size).toBe(1)
  await waitUntil(() => {
    expect(botLogsChannel.messages.cache.size).toBe(2)
  })

  // <@!hannah> reacts on it (confirms) with :botconfirm: so the message will be deleted.
  reactFromUser({user: hannah, message, emoji: {name: 'botconfirm'}})
  await waitUntil(() => {
    expect(botMessagesChannel.messages.cache.size).toBe(0)
  })
  await waitUntil(() => {
    expect(botLogsChannel.messages.cache.size).toBe(3)
  })
})
