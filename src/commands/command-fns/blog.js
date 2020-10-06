const got = require('got')
const {default: matchSorter} = require('match-sorter')
const {getCommandArgs} = require('../utils')

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
    keys: ['title', 'description', 'categories', 'keywords'],
  })
}

async function blog(message) {
  const args = getCommandArgs(message.content).trim()
  let articles

  try {
    articles = await fetchArticles()
  } catch (error) {
    return message.channel.send(
      `Something went wrong retrieving the list of articles 😬`,
    )
  }

  if (args === 'last') {
    const lastArticles = articles.slice(0, 10)
    message.channel.send(`This is the list of the last 10 articles on the blog:
${printArticles(lastArticles)}`)
  } else if (args) {
    const filteredArticles = searchArticles(articles, args)
    if (filteredArticles.length === 0) {
      message.channel.send(
        `😟 Unfortunately there is no article matching your search. Could you try again 😀?`,
      )
    } else if (filteredArticles.length === 1) {
      message.channel.send(`${filteredArticles[0].productionUrl}`)
    } else {
      const searchMessage = `
This is the list of the articles matching your search 💻:
${printArticles(filteredArticles)}`.trim()
      if (filteredArticles.length > 10) {
        return message.channel.send(
          `
There are too many results for your search. Here are the top 10:
${printArticles(filteredArticles.slice(0, 10))}
            `.trim(),
        )
      }

      message.channel.send(searchMessage)
    }
  } else {
    message.channel.send(
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
