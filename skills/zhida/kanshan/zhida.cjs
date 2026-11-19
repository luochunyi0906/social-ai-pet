const { ModelError, requestCompletion } = require('../../../desktop/model.cjs');

const endpoint = 'https://developer.zhihu.com/v1/chat/completions';
const models = new Set(['zhida-fast-1p5', 'zhida-thinking-1p5']);
const roles = new Set(['system', 'user', 'assistant']);

async function run({ messages }, { config, signal, timeoutMs, fetchImpl, onDelta }) {
  if (config?.provider !== 'zhida' || config.endpoint !== endpoint || !models.has(config.model)) {
    throw new ModelError('configuration', '知乎直答 Skill 的模型或服务地址无效。');
  }
  if (!Array.isArray(messages) || messages.at(-1)?.role !== 'user' ||
      !Array.from(messages).every(message => roles.has(message?.role) &&
        typeof message.content === 'string' && message.content.trim())) {
    throw new ModelError('invalid_input', '知乎直答 Skill 需要按顺序提供有效的会话消息。');
  }
  const context = messages.map(({ role, content }) => ({ role, content }));
  return requestCompletion(context, {
    config: { ...config, tokenParameter: 'none', jsonMode: false },
    signal,
    timeoutMs,
    fetchImpl,
    onDelta
  });
}

module.exports = { run };
