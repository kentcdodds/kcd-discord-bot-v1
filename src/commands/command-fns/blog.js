const got = require('got')
const {default: matchSorter} = require('match-sorter')
const {getCommandArgs, sendBotMessageReply} = require('../utils')

async function fetchArticles() {
  const response = await got('https://kentcdodds.com/blog.json')

  return JSON.parse(response.body)
}

function printArticles(articles) {
  return articles
    .map(article => `- ${article.title}\n  <${article.productionUrl}>`)
    .join('\n')
}

function searchArticles(articles, searchText) {
  return matchSorter(articles, searchText, {
    keys: [
      {threshold: matchSorter.rankings.STARTS_WITH, key: 'categories'},
      {threshold: matchSorter.rankings.STARTS_WITH, key: 'keywords'},
      'title',
      'description',
    ],
    threshold: matchSorter.rankings.CONTAINS,
  })
}

async function blog(message) {
  const args = getCommandArgs(message.content).trim()
  let articles

  try {
    articles = await fetchArticles()
  } catch (error) {
    return message.channel.send(
      `Something went wrong retrieving the list of articles 😬. Try searching here: <https://kentcdodds.com/blog>`,
    )
  }

  if (args === 'last') {
    const lastArticles = articles.slice(0, 10)
    return sendBotMessageReply(
      message,
      `
This is the list of the last 10 articles on the blog:
${printArticles(lastArticles)}
      `.trim(),
    )
  } else if (args) {
    const filteredArticles = searchArticles(articles, args)
    if (filteredArticles.length === 0) {
      return message.channel.send(
        `Unfortunately there is no article matching "${args}" 😟. Try searching here: <https://kentcdodds.com/blog>`,
      )
    } else if (filteredArticles.length === 1) {
      return message.channel.send(`${filteredArticles[0].productionUrl}`)
    } else {
      if (filteredArticles.length > 10) {
        return sendBotMessageReply(
          message,
          `
There are too many results for "${args}". Here are the top 10:
${printArticles(filteredArticles.slice(0, 10))}
            `.trim(),
        )
      }
      return sendBotMessageReply(
        message,
        `
This is the list of the articles matching "${args}" 💻:
${printArticles(filteredArticles)}
        `.trim(),
      )
    }
  } else {
    return message.channel.send(
      `A search term is required. For example: \`?blog state management\``,
    )
  }
}
blog.description = `Find articles on Kent's blog: <https://kentcdodds.com/blog>`
blog.help = message => {
  const commandsList = [
    `- Send \`?blog last\` for the last 10 articles.`,
    `- Send \`?blog your search string\` to find articles by categories, keyword, title and description.`,
  ]
  return message.channel.send(
    `
This is the list of the available commands:
${commandsList.join('\n')}
    `.trim(),
  )
}

module.exports = blog
