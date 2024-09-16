import * as crypto from "crypto";
import { Reporter } from "@parcel/plugin";
const cheerio = require('cheerio')
const path = require('path')

const sha256 = x =>
  crypto.createHash('sha256').update(x, 'utf8').digest('base64')

const waitForFile = (filename: string) => {
  return new Promise(function (resolve, reject) {
    let attempt = 0
    const interval = setInterval(function () {
      if (attempt >= 3) {
        clearInterval(interval)
        //throw new Error(`${filename} could not be read after ${attempt} attempts`);
      }
      /*
      if (fs.existsSync(filename)) {
        clearInterval(interval)
        resolve(fs.readFileSync(filename, { encoding: 'utf-8' }))
      } else {
        attempt++
      }
      */
    }, 1200)
  })
}

const buildCspContents = (config: {[key:string]:string}) => {
  let buff: string[] = []
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

module.exports = new Reporter({
  async report({ event, options, logger }) {
    if (event.type != 'buildSuccess') {
      return
    }

    for (const bundle of event.bundleGraph.getBundles()) {
      console.log("@@")
      console.log(bundle)
    }

    process.exit()
  },
})
