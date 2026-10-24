// Prints the app source that SideStore reads to list Beyond and offer its updates on the phone.
// Usage: node scripts/make-source.mjs <owner/repo> <version> <ipa size in bytes>
const [repository, version, size] = process.argv.slice(2);
if (!repository || !version || !size) {
  console.error('usage: make-source.mjs <owner/repo> <version> <size>');
  process.exit(1);
}

const downloads = `https://github.com/${repository}/releases/latest/download`;
const date = new Date().toISOString();
const description = 'Training, nutrition and progress in one minimal app. Your data stays on the iPhone.';

const source = {
  name: 'Beyond',
  identifier: 'app.beyond.source',
  sourceURL: `${downloads}/source.json`,
  apps: [
    {
      name: 'Beyond',
      bundleIdentifier: 'app.beyond.fitness',
      developerName: 'Beyond',
      version,
      versionDate: date,
      versionDescription: `Build ${version}`,
      beta: false,
      size: Number(size),
      localizedDescription: description,
      iconURL: `https://raw.githubusercontent.com/${repository}/main/assets/icon.png`,
      tintColor: '37E5F3',
      downloadURL: `${downloads}/Beyond.ipa`,
      screenshotURLs: [],
      versions: [
        {
          version,
          date,
          localizedDescription: `Build ${version}`,
          downloadURL: `${downloads}/Beyond.ipa`,
          size: Number(size),
        },
      ],
      permissions: [],
    },
  ],
  news: [],
};

console.log(JSON.stringify(source, null, 2));
