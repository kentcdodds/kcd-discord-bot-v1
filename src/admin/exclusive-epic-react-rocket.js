const {getChannel, getMember} = require('./utils')

async function handleGuildMemberUpdate(oldMember, newMember) {
  return handleMember(newMember)
}

async function handleMember(member) {
  if (!member) return
  const hasRocket = member.nickname?.includes('🚀')
  const isEpicReactMember = member.roles.cache.some(
    ({name}) => name === 'EpicReact Dev',
  )
  if (hasRocket && !isEpicReactMember) {
    await member.setNickname(member.nickname.replace(/🚀/g, '').trim())
    const botsChannel = getChannel(member.guild, {name: 'talk-to-bots'})
    await botsChannel.send(
      `
Hi ${member.user}, I noticed you added a rocket to your nickname. I'm afraid you can't do this because your discord account is not connected to your EpicReact.Dev account. Go to <https://epicreact.dev/discord> to make that connection.

If you don't have an https://EpicReact.Dev account, you should check it out. It's pretty great 😉 🚀
      `.trim(),
    )
  }
}

async function handleNewMessage(message) {
  return handleMember(getMember(message.guild, message.author.id))
}

module.exports = {handleGuildMemberUpdate, handleNewMessage}
