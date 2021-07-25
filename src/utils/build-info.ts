const startDate = new Date()

type BuildInfo = {
  buildTime?: number
  commit?: {
    isDeployCommit: 'Unknown' | true
    sha: string
    author: string
    date: string
    message: string
    link: string
  }
}

let buildInfo: BuildInfo = {}
try {
  buildInfo = require('../../build-info.json')
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

function getAppropriateTimeframe(ms: number) {
  const fix = (n: number, precision = 0) => Number(n.toFixed(precision))
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

function getBuildTimeInfo() {
  if (buildInfo.buildTime) {
    const buildDate = new Date(buildInfo.buildTime)
    const relativeDeployTime = getAppropriateTimeframe(
      buildInfo.buildTime - Date.now(),
    )
    return `${buildDate.toUTCString()} (${relativeDeployTime})`
  } else {
    return 'Unknown'
  }
}

function getStartTimeInfo() {
  const relativeStartTime = getAppropriateTimeframe(
    startDate.getTime() - Date.now(),
  )
  return `${startDate.toUTCString()} (${relativeStartTime})`
}

function getCommitInfo() {
  try {
    const {commit} = buildInfo
    if (!commit) return null

    const commitDate = new Date(commit.date)
    const relativeCommitDate = getAppropriateTimeframe(
      commitDate.getTime() - Date.now(),
    )
    return {
      author: commit.author,
      date: `${commitDate.toUTCString()} (${relativeCommitDate})`,
      message: `${commit.message.trim().split('\n')[0]}`,
      link: commit.link,
    }
  } catch {
    return null
  }
}

export {getBuildTimeInfo, getStartTimeInfo, getCommitInfo}
