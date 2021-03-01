/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import path from 'path'
import Discord from 'discord.js'
import dotenv from 'dotenv'
import {cleanupGuildOnInterval, getChannel} from './utils'
import {onboarding, commands, clubApplication, admin} from './setup'

dotenv.config({
  path: path.join(__dirname, '..', `/.env.local`),
})

const client = new Discord.Client()

console.log('logging in')
void client.login(process.env.DISCORD_BOT_TOKEN)

const getKcdGuild = () => client.guilds.cache.find(({name}) => name === 'KCD')
const getKent = () =>
  getKcdGuild()?.members.cache.find(
    ({user: {username, discriminator}}) =>
      username === 'kentcdodds' && discriminator === '0001',
  )

client.on('ready', async () => {
  console.log('ready to go')
  // commands.setup(client)
  const kcd = getKcdGuild()
  if (!kcd) throw new Error('Could not find KCD guild')

  console.log(kcd.emojis.cache)
  // console.log(kcd.emojis.cache.find(({name}) => '✋' === name))
  // const upcomingMeetups = getChannel(kcd, {name: 'upcoming-meetups'})
  // clubApplication.setup(client)
  // admin.setup(client)
  // onboarding.setup(client)
  // client.on('guildMemberUpdate', admin.handleGuildMemberUpdate)
  // client.on('message', onboarding.handleNewMessage)
  // client.on('messageUpdate', onboarding.handleUpdatedMessage)

  // onboarding.handleNewMember(getKent())

  // cleanupGuildOnInterval(client, guild => onboarding.cleanup(guild), 5000)
})
