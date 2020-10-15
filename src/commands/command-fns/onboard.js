// Command purpose:
// for a moderator/admin/owner to send a user through onboarding
// useful if they end up in a weird situation where they never
// finished onboarding but were never kicked
const {listify} = require('../utils')
const {handleNewMember} = require('../../onboarding/handle-new-member')

const hasMemberRole = member => {
  return member.roles.cache.some(({name}) => {
    return name === 'Member'
  })
}

async function onboard(message) {
  const members = Array.from(message.mentions.members.values())
  const alreadyMembers = members.filter(hasMemberRole)
  if (alreadyMembers.length) {
    await message.channel.send(
      `Cannot onboard any member with the "Member" role: ${listify(
        alreadyMembers,
        {stringify: m => m.toString()},
      )}`,
    )
    return
  }
  const channels = await Promise.all(
    members.map(member => handleNewMember(member)),
  )
  await message.channel.send(
    `Started onboarding: ${listify(channels, {stringify: c => c.toString()})}`,
  )
}
onboard.description = 'Start onboarding for a given user: `?onboard @Username`'
onboard.authorize = message => {
  const authorizedRoles = ['Owner', 'Admin', 'Moderator']
  return message.member.roles.cache.some(({name}) =>
    authorizedRoles.includes(name),
  )
}

module.exports = onboard
