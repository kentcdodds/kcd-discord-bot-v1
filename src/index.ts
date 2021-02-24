import type {Client} from 'discord.js'
// @ts-expect-error not converted yet
import * as onboarding from './onboarding'
import * as commands from './commands'
import * as admin from './admin'
import * as clubApplication from './club-application'
import * as privateChat from './private-chat'
import rollbar from './rollbar'
import * as meetup from './meetup'

function setup(client: Client) {
  onboarding.setup(client)
  commands.setup(client)
  admin.setup(client)
  clubApplication.setup(client)
  privateChat.setup(client)
  meetup.setup(client)
}

export {onboarding, commands, clubApplication, setup, rollbar, admin}
