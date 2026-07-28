const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const writingPath = path.join(repoRoot, 'data', 'writing.json');
const seedDir = path.join(repoRoot, 'content', 'writing');

function seedWriting(options = {}) {
  const targetPath = options.writingPath || writingPath;
  const sourceDir = options.seedDir || seedDir;
  const data = fs.existsSync(targetPath)
    ? JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    : { articles: [] };

  if (!Array.isArray(data.articles)) data.articles = [];

  const seeds = fs.readdirSync(sourceDir)
    .filter(fileName => fileName.endsWith('.json'))
    .sort()
    .map(fileName => JSON.parse(fs.readFileSync(path.join(sourceDir, fileName), 'utf8')));

  const existingSlugs = new Set(data.articles.map(article => article.slug));
  const added = [];

  seeds.forEach(article => {
    if (!article.slug || existingSlugs.has(article.slug)) return;
    data.articles.unshift(article);
    existingSlugs.add(article.slug);
    added.push(article.slug);
  });

  if (added.length > 0) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  return { added, total: data.articles.length };
}

if (require.main === module) {
  const result = seedWriting();
  console.log(`[writing-seed] added=${result.added.length} total=${result.total}`);
}

module.exports = {
  seedWriting,
};
