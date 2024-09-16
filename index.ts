import * as crypto from "crypto";
import { Reporter } from "@parcel/plugin";
import { FileSystem } from "@parcel/fs/lib/types";
import * as cheerio from "cheerio";

const sha256 = x =>
  crypto.createHash('sha256').update(x, 'utf8').digest('base64')

const calculateAndPushHash = (content: string, destArray: string[]) => {
  const hash = `sha256-${sha256(content)}`
  destArray.push(`'${hash}'`)
  //$(cheerioElement).attr('integrity', hash)
}

function addToHtmlMetaCsp($: cheerio.CheerioAPI, key: string, value:string) {
  const cspElem = $("meta[http-equiv='Content-Security-Policy']");
  const originalCsp = cspElem.attr("content");
  let newCsp = "";

  if (!originalCsp) {
    throw new Error("parcel-reporter-strict-csp requires a <meta http-equiv=\"Content-Security-Policy\" content=\"\">  to be present in your HTML!")
  }

  if (originalCsp.includes(key)) {
    newCsp = originalCsp.replace(key, `${key} ${value}`);
  } else {
    if (originalCsp.trim().endsWith(";")) {
      newCsp = `${originalCsp} ${key} ${value}`
    } else {
      newCsp = `${originalCsp}; ${key} ${value}`
    }
  }

  cspElem.attr("content", newCsp)
}

const getAssetUrl = ($: cheerio.CheerioAPI, elem:cheerio.Element, attr: string, ignoreHost?:string) => {
  const url = $(elem).attr(attr);
  if (!url) {
    throw new Error(`Could not get ${attr} from ${$(elem).html()}`)
  }
  // TODO try with non-ignored url
  if (ignoreHost) {
    return url.replace(ignoreHost, "")
  } else {
    return url;
  }
}

const parseHtml = (fs:FileSystem, htmlContents: string, distDir: string, ignoreHost?:string) => {
  const $ = cheerio.load(htmlContents);

  $("script").map(function () {
    const scriptSrc = getAssetUrl($, this, "src", ignoreHost);
    const data = fs.readFileSync(distDir + scriptSrc).toString("utf-8")
    const hash = `sha256-${sha256(data)}`;
    $(this).attr('integrity', hash)
    addToHtmlMetaCsp($, "script-src", `'${hash}'`)
    return this
  });

  const html = $.html();
  if (!html) {
    throw new Error("UGH")
  }
  return {html}
  
}

module.exports = new Reporter({
  async report({ event, options, logger }) {
    if (event.type != 'buildSuccess') {
      return
    }

    const htmlBundles = event.bundleGraph.getBundles().filter((bundle) => bundle.type == "html");
    
    for (const bundle of htmlBundles) {
      const bundleEntry = await bundle.getMainEntry();
      if (!bundleEntry) {
        throw new Error(`Could not get main entry of ${bundle.filePath}`)
      }

      const distDir = bundle.target.distDir + "/";
      const ignoreHost = bundle.target.publicUrl;

      const data = parseHtml(options.outputFS, options.outputFS.readFileSync(bundle.filePath).toString("utf-8"), distDir, ignoreHost);
      
      options.outputFS.writeFile(bundle.filePath, data.html, {});
    }
  },
})
