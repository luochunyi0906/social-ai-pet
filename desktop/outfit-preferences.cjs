const fs = require('node:fs/promises');
const { readdirSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const catalogue = path.join(__dirname, 'outfits');
const defaultOutfit = 'default';
const outfitIds = new Set([defaultOutfit]);
for (const filename of readdirSync(catalogue)) {
  if (!/^[a-z][a-z0-9-]*\.json$/.test(filename)) continue;
  try {
    const outfit = require(path.join(catalogue, filename));
    if (outfit?.id === path.basename(filename, '.json') && outfit.kind === 'full-character') outfitIds.add(outfit.id);
  } catch {
    console.warn('跳过无法读取的装扮配置。', filename);
  }
}

function outfitPreferences(directory) {
  const target = path.join(directory, 'outfit-preference.json');
  let writes = Promise.resolve();

  async function read() {
    await writes;
    try {
      const { version, outfitId } = JSON.parse(await fs.readFile(target, 'utf8'));
      if (version === 1 && outfitIds.has(outfitId)) return { outfitId };
      return { outfitId: defaultOutfit, warning: '已保存的套装在当前版本不可用，已展示默认装扮。' };
    } catch (error) {
      if (error.code === 'ENOENT') return { outfitId: defaultOutfit };
      return { outfitId: defaultOutfit, warning: '无法读取装扮偏好，已展示默认装扮。' };
    }
  }

  function save(outfitId) {
    if (!outfitIds.has(outfitId)) throw Error('该套装没有登记或已不可用。');
    const task = writes.then(async () => {
      await fs.mkdir(directory, { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temp, JSON.stringify({ version: 1, outfitId }) + '\n', { flag: 'wx', mode: 0o600 });
        await fs.rename(temp, target);
      } finally {
        await fs.rm(temp, { force: true });
      }
      return { outfitId };
    });
    writes = task.catch(() => {});
    return task;
  }

  return { read, save, flush: () => writes };
}
module.exports = { outfitPreferences };
