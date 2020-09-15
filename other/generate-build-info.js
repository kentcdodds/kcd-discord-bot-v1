const path = require('path')
const fs = require('fs')
const {execSync} = require('child_process')

const {repository} = require('../package.json')

function getCommit() {
  try {
    return execSync(
      `git log --pretty=format:"${repository.url}/commit/%h by %an %ar: %B" -n 1 --abbrev-commit`,
    )
      .toString()
      .trim()
  } catch (error) {
    return `Unable to get git commit info: ${error.message}`
  }
}

const buildTime = Date.now()

const buildInfo = {
  buildTime,
  commit: getCommit(),
}

fs.writeFileSync(
  path.join(__dirname, '..', 'build-info.json'),
  JSON.stringify(buildInfo, null, 2),
)
