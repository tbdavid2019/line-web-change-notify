const AppleTracker = require('../app');

let trackerInstance = null;
let appPromise = null;

module.exports = async (req, res) => {
  try {
    if (!trackerInstance) {
      trackerInstance = new AppleTracker();
    }

    if (!appPromise) {
      appPromise = trackerInstance
        .init()
        .then((app) => app)
        .catch((error) => {
          appPromise = null;
          throw error;
        });
    }

    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};
