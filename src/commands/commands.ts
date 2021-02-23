import {meetup} from './command-fns/meetup'

export default {
  help: require('./command-fns/help'),
  kif: require('./command-fns/kif'),
  thanks: require('./command-fns/thanks'),
  clubs: require('./command-fns/clubs'),
  info: require('./command-fns/info'),
  'private-chat': require('./command-fns/private-chat'),
  blog: require('./command-fns/blog'),
  meetup,
}
