import {start} from './start'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: string
      DISCORD_BOT_TOKEN?: string
      CONVERT_KIT_API_KEY?: string
      CONVERT_KIT_API_SECRET?: string
      GIST_REPO_THANKS?: string
      GIST_BOT_TOKEN?: string
      VERIFIER_API_KEY?: string
      SENTRY_DSN?: string
    }
  }
}

start()

/*
eslint
  @typescript-eslint/no-namespace: "off"
*/
