const DEFAULT_TIMEOUT = 120000; // 2 minutes

const isServerlessEnvironment = Boolean(
  process.env.VERCEL ||
    process.env.AWS_REGION ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.GCP_PROJECT
);

let configPromise = null;

async function getPuppeteerConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      if (isServerlessEnvironment) {
        const chromium = require("@sparticuz/chromium");
        const puppeteer =
          chromium.puppeteer || require("puppeteer-core");

        const executablePath =
          (await chromium.executablePath()) ||
          process.env.PUPPETEER_EXECUTABLE_PATH;

        return {
          puppeteer,
          launchOptions: {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
            protocolTimeout: DEFAULT_TIMEOUT,
          },
        };
      }

      const puppeteer = require("puppeteer");

      return {
        puppeteer,
        launchOptions: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          protocolTimeout: DEFAULT_TIMEOUT,
        },
      };
    })();
  }

  return configPromise;
}

module.exports = {
  getPuppeteerConfig,
};
