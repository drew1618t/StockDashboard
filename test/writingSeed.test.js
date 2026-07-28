const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { seedWriting } = require('../scripts/seed-writing');

test('writing seed adds missing articles without replacing runtime writing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-seed-'));
  const seedDir = path.join(root, 'seeds');
  const writingPath = path.join(root, 'writing.json');
  fs.mkdirSync(seedDir);
  fs.writeFileSync(
    writingPath,
    JSON.stringify({ articles: [{ slug: 'runtime-post', title: 'Runtime Post' }] })
  );
  fs.writeFileSync(
    path.join(seedDir, 'study.json'),
    JSON.stringify({ slug: 'study', title: 'Study' })
  );

  const first = seedWriting({ seedDir, writingPath });
  const second = seedWriting({ seedDir, writingPath });
  const stored = JSON.parse(fs.readFileSync(writingPath, 'utf8'));

  assert.deepEqual(first.added, ['study']);
  assert.deepEqual(second.added, []);
  assert.deepEqual(stored.articles.map(article => article.slug), ['study', 'runtime-post']);
});
