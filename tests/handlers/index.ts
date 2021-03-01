import {handlers as kifHandlers} from './kif'
import {handlers as blogHandlers} from './blog'
import {handlers as discordHandlers} from './discord'
import {handlers as onboardingHandlers} from './onboarding'

const allHandlers = [
  ...kifHandlers,
  ...blogHandlers,
  ...discordHandlers,
  ...onboardingHandlers,
]

export {allHandlers as handlers}
