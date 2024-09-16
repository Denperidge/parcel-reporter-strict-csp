import * as crypto from "crypto";
import { Reporter } from "@parcel/plugin";
import { FileSystem } from "@parcel/fs/lib/types";
import * as cheerio from "cheerio";

const sha256 = x =>
  crypto.createHash('sha256').update(x, 'utf8').digest('base64')

const buildCspContents = (config: {[key:string]:string}) => {
  let buff: string[] = []
  for (const key in config) {
    buff.push(`${key} ${config[key]}`)
  }
  return buff.join(';') + ';'
}

const calculateAndPushHash = (content: string, destArray: string[]) => {
  const hash = `sha256-${sha256(content)}`
  destArray.push(`'${hash}'`)
  //$(cheerioElement).attr('integrity', hash)
}




const parseHtml = (fs:FileSystem, contents: string, hashes: {[key:string]: string}) => {
  const $ = cheerio.load(contents);
  const scriptHashes: string[] = []
    const distDir = process.env['DIST_DIR'] || 'dist/'
    /* The host defined here will be ignored when checking for local assets
       e.g. HOST=https://example.com
       <script src="https://example.com/index.js"" --> "distDir/index.js"
    */
    const ignoreHost = process.env['HOST'] || null

    $("script").map(function () {
      const scriptSrc = $(this).attr("src");
      if (scriptSrc) {
        const data = fs.readFileSync("dist" + scriptSrc).toString("utf-8")
        console.log(data)
        const hash = `sha256-${sha256(data)}`
        scriptHashes.push(`'${hash}'`)
        $(this).attr('integrity', hash)
      }
      return this
    })

    const html = $.html();
    if (!html) {
      throw new Error("UGH")
    }
    return {html, scriptHashes}
  
}

module.exports = new Reporter({
  async report({ event, options, logger }) {
    if (event.type != 'buildSuccess') {
      return
    }
    

    const filesJs = event.bundleGraph.getBundles().filter((bundle) => bundle.type == "js");
    const htmlBundles = event.bundleGraph.getBundles().filter((bundle) => bundle.type == "html");

    /*
    for (const bundle of filesJs) { 
      bundle.traverseAssets()
    }*/
    

    
    for (const bundle of htmlBundles) {
      const bundleEntry = await bundle.getMainEntry();
      if (!bundleEntry) {
        throw new Error(`Could not get main entry of ${bundle.filePath}`)
      }

      const hashes = {};
      for (const dependency of bundleEntry.getDependencies()) {
        const dependencyAsset = event.bundleGraph.getResolvedAsset(dependency, bundle)
        if (dependencyAsset) {
          if (dependencyAsset.type == "js") {
            //console.log(await dependencyAsset.getCode())
            hashes[dependency.id] = sha256(await dependencyAsset.getCode());
            
          }
        }
      }  

      //options.outputFS.writeFile("test", await bundleEntry.getCode(), {});

      
      // await bundleEntry.getCode() gives temp filenames

      const data = parseHtml(options.outputFS, options.outputFS.readFileSync(bundle.filePath).toString("utf-8"), hashes);
      
      options.outputFS.writeFile(bundle.filePath, data.html, {});
    }
  },
})
