// Command purpose:
// to automate management of learning clubs https://kcd.im/clubs
const {getCommandArgs} = require('../../utils')
const {createClub} = require('./create')

async function clubs(message) {
  const subcommand = getCommandArgs(message.content)
  if (subcommand.startsWith('create')) {
    return createClub(message)
  }
}
clubs.description =
  'Create a club with `?clubs create LINK_TO_GOOGLE_FORM` (learn more: https://kcd.im/clubs)'

module.exports = clubs
