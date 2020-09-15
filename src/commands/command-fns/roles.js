// Command purpose:
// to automate management of learning clubs https://kcd.im/clubs
const {getCommandArgs, getMember, listify, commandPrefix} = require('../utils')

const availableRoles = ['Notify: Kent Live', 'Notify: Office Hours']

function getAvailableRole(guild, roleName) {
  if (!roleName) return null
  return guild.roles.cache.find(
    r =>
      availableRoles.includes(r.name) &&
      r.name.toLowerCase().includes(roleName.toLowerCase()),
  )
}

async function roles(message) {
  const [action, ...rest] = getCommandArgs(message.content).split(' ')
  const roleName = rest?.join(' ')
  const requestedRole = getAvailableRole(message.guild, roleName)
  const member = getMember(message.guild, message.author.id)

  if (requestedRole && action?.toLowerCase() === 'add') {
    if (member.roles.cache.has(requestedRole.id)) {
      return message.channel.send(
        `${member.user}, you already have the role \`${requestedRole.name}\`.`,
      )
    } else {
      await member.roles.add(
        requestedRole,
        'Requested by the member via roles command',
      )
      return message.channel.send(
        `${member.user}, I've added you to \`${requestedRole.name}\`.`,
      )
    }
  } else if (requestedRole && action?.toLowerCase() === 'remove') {
    if (member.roles.cache.has(requestedRole.id)) {
      await member.roles.remove(
        requestedRole,
        'Requested by the member via roles command',
      )
      return message.channel.send(
        `${member.user}, I've removed you from \`${requestedRole.name}\`.`,
      )
    } else {
      return message.channel.send(
        `${member.user}, you don't have the role \`${requestedRole.name}\`.`,
      )
    }
  } else {
    return roles.help(message)
  }
}

const rolesDisplayList = listify(availableRoles)
roles.description = `Add or remove yourself from these roles: ${rolesDisplayList}`
roles.help = message =>
  message.channel.send(
    `
Add or remove yourself from these roles: ${rolesDisplayList}

Example:

${commandPrefix}roles add Kent Live
${commandPrefix}roles remove Office Hours
    `.trim(),
  )

module.exports = roles
