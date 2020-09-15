// Command purpose:
// provide information about the bot itself

const redent = require('redent')

let buildInfo = {}
try {
  buildInfo = require('../../../build-info.json')
} catch {
  // no build info
}

const rtf = new Intl.RelativeTimeFormat('en', {style: 'long', numeric: 'auto'})

const second = 1000
const minute = second * 60
const hour = minute * 60
const day = hour * 24
const week = day * 7
const month = day * 30
const quarter = month * 3
const year = day * 365.25

function getAppropriateTimeframe(ms) {
  const fix = (n, precision = 0) => Number(n.toFixed(precision))
  const abs = Math.abs(ms)

  if (abs > year) return rtf.format(fix(ms / year, 2), 'year')
  if (abs > quarter) return rtf.format(fix(ms / quarter, 2), 'quarter')
  if (abs > month) return rtf.format(fix(ms / month, 2), 'month')
  if (abs > week) return rtf.format(fix(ms / week, 1), 'week')
  if (abs > day) return rtf.format(fix(ms / day, 1), 'day')
  if (abs > hour) return rtf.format(fix(ms / hour), 'hour')
  if (abs > minute) return rtf.format(fix(ms / minute), 'minute')

  return rtf.format(fix(ms / second), 'second')
}

function getDeployTimeLine() {
  if (buildInfo.buildTime) {
    const buildDate = new Date(buildInfo.buildTime)
    const relativeDeployTime = getAppropriateTimeframe(
      buildInfo.buildTime - Date.now(),
    )
    return `Deployed at: ${buildDate.toUTCString()} (${relativeDeployTime})`
  } else {
    return `Deployed at: Unknown`
  }
}

function getCommitLine() {
  const {commit} = buildInfo
  if (!commit) return `Commit: info unavailable`

  const commitDate = new Date(commit.date)
  const relativeCommitDate = getAppropriateTimeframe(commitDate - Date.now())

  return `
Commit:
  author: ${commit.author}
  date: ${commitDate.toUTCString()} (${relativeCommitDate})
  message: ${commit.message.trim().split('\n')[0]}
  link: <${commit.link}>
  `.trim()
}

async function info(message) {
  const result = await message.channel.send(
    `
Here's some info about the currently running bot:

${redent([getDeployTimeLine(), getCommitLine()].join('\n'), 2)}
  `.trim(),
  )
  return result
}
info.description = 'Gives information about the bot (deploy date etc.)'

module.exports = info
