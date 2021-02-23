import type {Client} from 'discord.js'
import onboarding from './onboarding'
import commands from './commands'
import admin from './admin'
import clubApplication from './club-application'
import privateChat from './private-chat'
import rollbar from './rollbar'
import meetup from './meetup'

function setup(client: Client) {
  onboarding.setup(client)
  commands.setup(client)
  admin.setup(client)
  clubApplication.setup(client)
  privateChat.setup(client)
  meetup.setup(client)
}

export {onboarding, commands, clubApplication, setup, rollbar, admin}
