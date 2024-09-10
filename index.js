const crypto = require('crypto')
const { Optimizer } = require('@parcel/plugin')
const cheerio = require('cheerio')
require('dotenv').config()

const sha256 = x =>
  crypto.createHash('sha256').update(x, 'utf8').digest('base64')

const buildCspContents = config => {
  let buff = []
  for (const key in config) {
    buff.push(`${key} ${config[key]}`)
  }
  return buff.join(';') + ';'
}

module.exports = new Optimizer({
  async loadConfig({ config }) {
    let { contents } = await config.getConfig(['.csprc.json', '.csprc'])
    for (const key in contents) {
      const envVarsFound = contents[key].matchAll(
        /(?<full>\$ENV\.(?<key>\w*))/g
      )
      let result = envVarsFound.next()
      while (!result.done) {
        const regexResult = result.value

        contents[key] = contents[key].replace(
          regexResult.groups['full'],
          process.env[regexResult.groups['key']]
        )

        result = envVarsFound.next()
      }
    }
    return contents
  },
  async optimize({ contents, map, config }) {
    const configCopy = { ...config }
    const scriptSrc = config['script-src'] || []

    const $ = cheerio.load(contents)

    // find scripts that have inline contents
    $('script').map(function () {
      const html = $(this).html()
      // Ensure the inline script isn't just whitespace
      if (html.trim()) {
        const hash = `sha256-${sha256(html)}`
        scriptSrc.push(`'${hash}'`)
        $(this).attr('integrity', hash)
      }
      return this
    })

    configCopy['script-src'] = scriptSrc.join(' ')

    $('head').prepend(
      `<meta http-equiv="Content-Security-Policy" content="${buildCspContents(
        configCopy
      )}"/>`
    )

    return {
      contents: $.html(),
      map,
    }
  },
})
