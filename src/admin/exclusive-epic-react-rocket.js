const {getChannel} = require('./utils')

async function handleGuildMemberUpdate(oldMember, newMember) {
  const hasRocket = newMember.nickname?.includes('🚀')
  const isEpicReactMember = newMember.roles.cache.some(
    ({name}) => name === 'EpicReact Dev',
  )
  if (hasRocket && !isEpicReactMember) {
    await newMember.setNickname(newMember.nickname.replace(/🚀/g, '').trim())
    const botsChannel = getChannel(newMember.guild, {name: 'talk-to-bots'})
    await botsChannel.send(
      `
Hi ${newMember.user}, I noticed you tried to add a rocket to your nickname. I'm afraid you can't do this because you're discord account is not connected to your EpicReact.Dev account. Go to <https://epicreact.dev/discord> to make that connection.

If you don't have an https://EpicReact.Dev account, you should check it out. It's pretty great 😉 🚀
      `.trim(),
    )
  }
}

module.exports = {handleGuildMemberUpdate}
