// Command purpose:
// to automate management of learning clubs https://kcd.im/clubs
const {getArgs} = require('../../command-regex')
const {createClub} = require('./create')

async function clubs(message) {
  const subcommand = getArgs(message.content)
  if (subcommand.startsWith('create')) {
    return createClub(message)
  }
}
clubs.description = 'Interact with the learning clubs'

// handle reactions to open clubs
// ✋ - add to role (removing reaction removes role)
// - Once there are 12, then delete any new ractions
// 🏁 - prevent new people from joining (only captain/owner/moderators/admins can do this)
// - Edit message to say it's started already, encourage them to copy and start a new one themselves

// Make it easy to scan to know which clubs are full and which are still open for new members

module.exports = clubs
