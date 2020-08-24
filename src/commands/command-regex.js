const regex = /^\?(?<command>\S+?)($| )(?<args>(.|\n)*)/
const getArgs = string => string.match(regex)?.groups?.args ?? null

module.exports = {regex, getArgs}
