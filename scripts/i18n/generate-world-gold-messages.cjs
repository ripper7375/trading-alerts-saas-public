/** Regenerate the route's small synchronous dictionaries from canonical locale JSON. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'lib/i18n/dictionaries');
const messages = {};
for (const file of fs
  .readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()) {
  const dictionary = JSON.parse(
    fs.readFileSync(path.join(directory, file), 'utf8')
  );
  messages[file.slice(0, -5)] = Object.fromEntries(
    Object.entries(dictionary).filter(([key]) => key.startsWith('worldGold.'))
  );
}
fs.writeFileSync(
  path.join(root, 'lib/i18n/world-gold-messages.json'),
  JSON.stringify(messages, null, 2) + '\n'
);
