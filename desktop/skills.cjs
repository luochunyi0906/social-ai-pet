const zhidaManifest = require('../skills/zhida/manifest.json');
const zhida = require('../skills/zhida/kanshan/zhida.cjs');
const hotManifest = require('../skills/hot-list/manifest.json');
const hot = require('../skills/hot-list/kanshan/hot-list.cjs');
const answers = require('../skills/question-answers/index.cjs');
const recommendations = require('../skills/question-recommendations/index.cjs');
const { ModelError } = require('./model.cjs');

const registry = new Map([[zhidaManifest.id, zhida], [hotManifest.id, hot], ['question-answers',answers], ['question-recommendations',recommendations]]);

function registeredSkill(id) {
  return registry.has(id) ? id : undefined;
}

function runSkill(id, input, options) {
  const skill = registry.get(id);
  if (!skill) throw new ModelError('configuration', '所选桌宠技能未注册。');
  return skill.run(input, options);
}

module.exports = { registeredSkill, runSkill };
