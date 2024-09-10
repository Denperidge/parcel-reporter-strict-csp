const crypto = require('crypto')
const { Optimizer } = require('@parcel/plugin')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
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

const calculateAndPushHash = (cheerioElement, contentString, destArray) => {
  const hash = `sha256-${sha256(contentString)}`
  destArray.push(`'${hash}'`)
  cheerioElement.attr('integrity', hash)
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
    const distDir = process.env['DIST_DIR'] || 'dist/'
    /* The host defined here will be ignored when checking for local assets
       e.g. HOST=https://example.com
       <script src="https://example.com/index.js"" --> "distDir/index.js"
    */
    const ignoreHost = process.env['HOST'] || null

    const $ = cheerio.load(contents)

    // find scripts that have inline contents
    $('script').map(function () {
      const html = $(this).html()
      const src = $(this).attr('src')//.replace(ignoreHost, "")
      console.log(this)
      /*
      const src = originalSrc.includes(ignoreHost)
        ? originalSrc.replace(ignoreHost, '')
        : originalSrc
      */
      // If inline script with content aside from whitespace
      if (html.trim()) {
        calculateAndPushHash($(this), html, scriptSrc)
      }
      // If external script
      if (src) {
        // If local
        if (src.startsWith('/')) {
          const data = fs.readFileSync(path.join(distDir, src), {
            encoding: 'utf-8',
          })
          calculateAndPushHash($(this), data, scriptSrc)
        }
        if (src.startsWith("http")) {
          console.log(src.includes(ignoreHost))
          console.log(src)
        }
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
