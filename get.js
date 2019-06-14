const axios = require('axios');
const parseString = require('xml2js').parseString;

const hatenaAPIUser = '<USER_ID>';
const hatenaAPIPassword = '<API_KEY>';
const entryUrl = `https://blog.hatena.ne.jp/<USER_ID>/<BLOG_ID>/atom/entry`;

const creds = `${hatenaAPIUser}:${hatenaAPIPassword}`;
const encoded = Buffer.from(creds).toString('base64');
const authorizationHeader = `Basic ${encoded}`;

/**
 * Promise based timeout
 * @param {number} msec wait milliseconds
 */
function wait(msec) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, msec);
  });
}

/**
 * Promise based XML->JSON Parser
 * @param {object} data XML Data
 */
function parseStringPromise(data) {
  return new Promise((resolve, reject) => {
    parseString(data, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

/**
 * Get all Hatena entries recursively
 * @param {string} url Entry URL
 */
async function getAllEntries(url) {
  console.log('fetching:', url);
  const entries = await axios.get(url, {
    headers: {
      Authorization: authorizationHeader,
    },
  });

  const {
    feed: { entry, link },
  } = await parseStringPromise(entries.data);

  const next = link.find(l => l.$.rel === 'next');

  const parsedEntries = entry
    .filter(e => {
      const {
        'app:control': [
          {
            'app:draft': [isDraft],
          },
        ],
      } = e;
      return !(isDraft === 'yes');
    })
    .map(e => {
      const categories = e.category ? e.category : [];

      return {
        id: e.id[0],
        title: e.title[0],
        url: e.link[1].$.href,
        published: e.published[0],
        publishedAt: new Date(e.published[0]).getTime(),
        updated: e.updated[0],
        updatedAt: new Date(e.updated[0]).getTime(),
        summary: e.summary[0]._,
        categories: categories.map(c => c.$.term),
      };
    });

  if (next) {
    // recursively fetch if 'next' exists
    const nextHref = next.$.href;
    await wait(500);
    const nextEntries = await getAllEntries(nextHref);
    return [...parsedEntries, ...nextEntries];
  } else {
    return parsedEntries;
  }
}

getAllEntries(entryUrl).then(console.log);
