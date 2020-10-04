const got = require('got')
const {getCommandArgs} = require('../utils')

async function fetchArticles() {
  const response = await got('https://kentcdodds.com/blog.json')

  return JSON.parse(response.body)
}

function printArticles(articles) {
  return articles
    .map(article => {
      return `- ${article.title}
  <${article.productionUrl}>`
    })
    .join('\n')
}

function searchArticles(articles, searchText) {
  const regex = new RegExp(searchText, 'ig')
  return articles.filter(
    article =>
      article.title.match(regex) ||
      article.description.match(regex) ||
      article.categories.find(category => category.match(regex)) ||
      article.keywords.find(keyword => keyword.match(regex)),
  )
}

async function blog(message) {
  const args = getCommandArgs(message.content).trim()
  let articles

  try {
    articles = await fetchArticles()
  } catch (error) {
    return message.channel.send(
      `🤯 Something went wront retrieving the list of articles. Could you try in a few minutes?😀?`,
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
      const searchMessage = `This is the list of the articles matching your search 💻:
${printArticles(filteredArticles)}`
      if (searchMessage.length >= 2000) {
        return message.channel
          .send(`There are too many resuts for your search. I'll show you only the last 10 articles:
${printArticles(filteredArticles.slice(0, 10))}`)
      }

      message.channel.send(searchMessage)
    }
  } else {
    message.channel.send(
      `Sorry you should specify a text to search through articles 😫`,
    )
  }
}
blog.description = 'Show the articles published by Kent on his blog'
blog.help = message => {
  const commandsList = [
    `- Send \`?blog last\` for showing the last 10 articles on Kent's blog.`,
    `- Send \`?blog your search string\` to search some articles by categories, keyword, title and description.`,
  ]
  return message.channel.send(
    `
This is the list of the available commands:
${commandsList.join('\n')}
    `.trim(),
  )
}

module.exports = blog
