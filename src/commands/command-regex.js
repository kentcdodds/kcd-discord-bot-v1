const prodRegex = /^\?(?<command>\S+?)($| )(?<args>(.|\n)*)/
const devRegex = /^~(?<command>\S+?)($| )(?<args>(.|\n)*)/
const regex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
    ? prodRegex
    : devRegex
const getArgs = string => string.match(regex)?.groups?.args ?? null

module.exports = {regex, getArgs}
