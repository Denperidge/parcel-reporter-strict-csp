# parcel-reporter-strict-csp

A [Parcel 2.0+](https://parceljs.org/) Parcel 2 plugin automatically generating a strict script-src Content-Security-Policy

It automatically calculates hashes for your scripts, appending those to `<script integrity="...">` and CSP `<meta http-equiv="Content-Security-Policy" content="..."/>` so that browsers will run it.

## How-to
### Use as plugin
1. Install the plugin

```bash
# Install using npm
npm install parcel-reporter-strict-csp

# Alternatively, install using yarn
yarn add parcel-reporter-strict-csp
```

2. Now we'll tell Parcel to use the plugin. Create/edit your `.parcelrc` as follows:
  ```json
  {
    "extends": ["@parcel/config-default"],
    "reporters": ["...", "parcel-reporter-strict-csp"]
  }
  ```
  > **Note**: the `"..."` is important it tells parcel to do all the other stuff it would normally to do optimize. This just tacks on our new plugin at the end.

3. Add a CSP meta element to your HTML files
  ```html
  <head>
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; base-uri 'none';"
    />
    <script src="index.js"></script>
  </head>
  ```
  > **Note:** Adapt the CSP as wanted!
  > If you add a script-src here already, this plugin will automatically add the hashes to it.
  > Otherwise, the plugin will add a new script-src key for you

4. Done! After each build, the plugin will adapt .html files

```html
<!-- Example output -->
<meta
  http-equiv="Content-Security-Policy"
  content="object-src 'none'; base-uri 'none'; script-src 'sha256-l0pssYvwZ5XoYtCOykG2S8AI2G4VgXJ8KAN+vpj5Tdd='"
/>
<script
  src="/index.8ce62db9.js"
  type="module"
  integrity="sha256-l0pssYvwZ5XoYtCOykG2S8AI2G4VgXJ8KAN+vpj5Tdd=">
</script>
```

### Build locally
This requires [Git](https://git-scm.com/), [Node.js](https://nodejs.org/en) & [Yarn](https://yarnpkg.com/getting-started/install) to be intalled
```bash
# Clone repository & change dir
git clone https://github.com/Denperidge/parcel-reporter-strict-csp.git
cd parcel-reporter-strict-csp

# Install requirements
yarn install

# Build once
yarn build

# Watch for changes
yarn watch

# Enable yarn link (https://classic.yarnpkg.com/lang/en/docs/cli/link/)
# This allows you to use your local parcel-reporter-strict-csp in another local repository
yarn link
cd ~/MyOtherProject
yarn link parcel-reporter-strict-csp
# From now on, imports for parcel-reporter-strict-csp will resolve to your local copy
# See https://classic.yarnpkg.com/en/docs/cli/unlink to unlink
```

## Explanation

### Why a parcel CSP plugin is necessary
*Note: this section is from Henrik Joreteg's [parcel-optimizer-csp](www.npmjs.com/package/parcel-optimizer-csp) README, which holds a good explanation of the need for hash-based csp in static webapps*

We have an inline script for [Xchart.com](https://xchart.com/) that registers global error handlers. We do this as inline script, because if there's an error with loading a JS file required to run the app we want to know about it.

Another common reason would be inline scripts inserted for analytics.

**BUT** we're using a Content Security Policy (CSP) to prevent malicious scripts from being injected in any way.

CSP's `script-src` is one of the main reasons to use a CSP. [It specifies _valid_ sources for JavaScript](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src) and so, can completely prevent XSS (Cross-site scripting).

But, one of the tricky things people quickly notice is that if you have an inline snippet in the HTML that you pass to Parcel, like this:

```html
<script>
  console.log("I might be an analytics snippet or something");
</script>
```

This code will not run when you've specified a `script-src` unless you've listed: `'unsafe-inline'` which... kind of negates the whole point of setting a `script-src` to begin with.

If you're using CSP to prevent injected scripts, you can either specify a `nonce` or a hash of all the allowed scripts. A `nonce` is supposed to be unique from the server for each render, that doesn't work so well if you are building a PWA or static site (JAM Stack) when you may not have a server rendering on each request.

The other option is to calculate and specify a hash of each inline script that is allows to run: **That's the main reason this plugin exists**.

### Why is it a Reporter plugin?

I tried optimizer, but that doesn't have the final filenames in the HTML (thus it only works for inline scripts). I tried packager, but you can only use one, and I don't want the only packager to be something that isn't meant to be a packager. Reporter it is! Even if it still required me to replace `.getCode()` with some `readFileSync`'s.

## Credits

This plugin is a hard fork from [parcel-optimizer-csp](www.npmjs.com/package/parcel-optimizer-csp). Check out [@HenrikJoreteg](http://twitter.com/henrikjoreteg) on twitter.

## License

This project is licensed under the [MIT license](LICENSE).
