import type * as TDiscord from 'discord.js'
import got from 'got'
import {matchSorter} from 'match-sorter'
import {getCommandArgs, sendBotMessageReply} from '../utils'

async function fetchArticles(): Promise<Array<Article>> {
  const response = await got('https://kentcdodds.com/blog.json')

  return JSON.parse(response.body)
}

type Article = {
  title: string
  categories: string
  description: string
  keywords: string
  productionUrl: string
}

function printArticles(articles: Array<Article>) {
  return articles
    .map(article => `- ${article.title}\n  <${article.productionUrl}>`)
    .join('\n')
}

function searchArticles(articles: Array<Article>, searchText: string) {
  return matchSorter(articles, searchText, {
    keys: [
      {threshold: matchSorter.rankings.MATCHES, key: 'title'},
      {threshold: matchSorter.rankings.WORD_STARTS_WITH, key: 'description'},
      {threshold: matchSorter.rankings.WORD_STARTS_WITH, key: 'categories'},
      {threshold: matchSorter.rankings.WORD_STARTS_WITH, key: 'keywords'},
    ],
  })
}

async function blog(message: TDiscord.Message) {
  const args = getCommandArgs(message.content).trim()
  let articles: Array<Article>

  try {
    articles = await fetchArticles()
  } catch {
    return message.channel.send(
      `Something went wrong retrieving the list of articles 😬. Try searching here: <https://kentcdodds.com/blog>`,
    )
  }

  if (args === 'latest') {
    // The articles are already sorted by published date
    return message.channel.send(`${articles[0].productionUrl}`)
  } else if (args === 'last') {
    const lastArticles = articles.slice(0, 10)
    return sendBotMessageReply(
      message,
      `
This is the list of the last 10 articles on the blog:
${printArticles(lastArticles)}
      `.trim(),
    )
  } else if (args === 'random') {
    const randomIndex = Math.floor(Math.random() * (articles.length - 0) + 0)
    return message.channel.send(`${articles[randomIndex].productionUrl}`)
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
blog.help = (message: TDiscord.Message) => {
  const commandsList = [
    `- Send \`?blog last\` for the last 10 articles.`,
    `- Send \`?blog latest\` for the latest published article.`,
    `- Send \`?blog random\` to get a random article.`,
    `- Send \`?blog your search string\` to find articles by categories, keyword, title and description.`,
  ]
  return message.channel.send(
    `
This is the list of the available commands:
${commandsList.join('\n')}
    `.trim(),
  )
}

export {blog}
