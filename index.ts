import * as crypto from "crypto";
import { Reporter } from "@parcel/plugin";
import { FileSystem } from "@parcel/fs/lib/types";
import * as cheerio from "cheerio";

const sha256 = x =>
  crypto.createHash('sha256').update(x, 'utf8').digest('base64')

const calculateAndImplementAssetHash = ($:cheerio.CheerioAPI, elem:cheerio.Element, fs: FileSystem, filename: string, cspKey: string) => {
  // Read filename
  const data = fs.readFileSync(filename).toString("utf-8")
  const hash = `sha256-${sha256(data)}`;
  // Set element integrity attribute
  $(elem).attr('integrity', hash);
  addToHtmlMetaCsp($, cspKey, `'${hash}'`)
}

function addToHtmlMetaCsp($: cheerio.CheerioAPI, cspKey: string, value:string) {
  const cspElem = $("meta[http-equiv='Content-Security-Policy']");
  const originalCsp = cspElem.attr("content");
  let newCsp = "";

  if (!originalCsp) {
    throw new Error("parcel-reporter-strict-csp requires a <meta http-equiv=\"Content-Security-Policy\" content=\"\">  to be present in your HTML!")
  }

  if (originalCsp.includes(cspKey)) {
    newCsp = originalCsp.replace(cspKey, `${cspKey} ${value}`);
  } else {
    if (originalCsp.trim().endsWith(";")) {
      newCsp = `${originalCsp} ${cspKey} ${value}`
    } else {
      newCsp = `${originalCsp}; ${cspKey} ${value}`
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
    calculateAndImplementAssetHash($, this, fs, distDir + scriptSrc, "script-src")
    return this
  });

  /* TODO: doesn't work
  $("link[href$='.css']").map(function() {
    const cssHref = getAssetUrl($, this, "href", ignoreHost);
    calculateAndImplementAssetHash($, this, fs, distDir + cssHref, "style-src-elem");
  });
  */

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
