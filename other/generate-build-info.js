const path = require('path')
const fs = require('fs')
const got = require('got')

const commit = process.env.SOURCE_VERSION

async function getCommit() {
  if (!commit) return
  try {
    const data = await got(
      `https://api.github.com/repos/kentcdodds/kcd-discord-bot/commits/${commit}`,
    ).json()
    return {
      isDeployCommit: commit === 'HEAD' ? 'Unknown' : true,
      sha: data.sha,
      author: data.commit.author.name,
      date: data.commit.author.date,
      message: data.commit.message,
      link: data.html_url,
    }
  } catch (error) {
    return `Unable to get git commit info: ${error.message}`
  }
}

const buildTime = Date.now()

async function go() {
  const buildInfo = {
    buildTime,
    commit: await getCommit(),
  }

  fs.writeFileSync(
    path.join(__dirname, '..', 'build-info.json'),
    JSON.stringify(buildInfo, null, 2),
  )
}
go()
