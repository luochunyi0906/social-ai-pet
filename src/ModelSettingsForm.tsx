import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  unwrap, type ModelCredentialKey, type ModelSettingKey, type ModelSettingsPatch,
  type ModelSettingsResult, type ModelSettingsView,
} from './types';
import './model-settings.css';

const bridge = window.kanshan;
const providers = {
  MODEL_PROVIDER: [['zhida', '知乎直答'], ['openai-compatible', 'OpenAI 兼容 API']],
  CHAT_PROVIDER: [['zhida', '知乎直答'], ['existing', '使用投喂模型'], ['ollama', '本机 Ollama'], ['llama.cpp', '本机 llama.cpp']],
  SEARCH_PROVIDER: [['zhihu', '知乎开放平台'], ['brave', 'Brave Search'], ['bing-rss', 'Bing RSS（实验）']],
  ZHIDA_MODEL: [['zhida-fast-1p5', '快速档'], ['zhida-thinking-1p5', '思考档']],
};

export function ModelSettingsForm({ busy, onSaving, onSaved }: {
  busy: boolean;
  onSaving: (saving: boolean) => void;
  onSaved: (result: ModelSettingsResult) => void;
}) {
  const [settings, setSettings] = useState<ModelSettingsView>();
  const [draft, setDraft] = useState<ModelSettingsPatch>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    if (bridge) {
      void unwrap(bridge.modelSettings()).then(result => {
        if (active.current) setSettings(result);
      }).catch(reason => {
        if (active.current) setError((reason as Error).message);
      });
    }
    return () => { active.current = false; };
  }, []);

  function edit(key: ModelSettingKey | ModelCredentialKey, value: string) {
    setDraft(old => {
      const next = { ...old };
      if (value === settings?.values[key as ModelSettingKey] || (!value && !Object.hasOwn(settings?.values ?? {}, key))) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setNotice('');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bridge || busy || saving || !Object.keys(draft).length) return;
    setSaving(true);
    onSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await unwrap(bridge.saveModelSettings(draft));
      onSaved(result);
      if (!active.current) return;
      setSettings(result.settings);
      setDraft({});
      setNotice('已保存。新的请求会使用这份配置。');
    } catch (reason) {
      if (active.current) setError((reason as Error).message);
    } finally {
      if (active.current) {
        setSaving(false);
        onSaving(false);
      }
    }
  }

  const value = (key: ModelSettingKey) => draft[key] ?? settings?.values[key] ?? '';
  function select(key: keyof typeof providers, label: string) {
    const options = providers[key];
    return <label>{label}<select value={value(key)} onChange={event => edit(key, event.target.value)}>
      {!options.some(([option]) => option === value(key)) && <option value={value(key)} disabled>请选择服务</option>}
      {options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}
    </select></label>;
  }
  function input(key: ModelSettingKey, label: string, placeholder: string, maxLength: number) {
    return <label>{label}<input value={value(key)} placeholder={placeholder} maxLength={maxLength}
      autoComplete="off" spellCheck={false} onChange={event => edit(key, event.target.value)}/></label>;
  }
  function password(key: ModelCredentialKey, label: string) {
    return <label>{label}<input type="password" maxLength={4096} value={draft[key] ?? ''}
      autoComplete="off" spellCheck={false}
      placeholder={settings?.hasCredential[key] ? '已设置，留空沿用现有密钥' : '输入访问密钥'}
      onChange={event => edit(key, event.target.value)}/></label>;
  }

  const chatProvider = value('CHAT_PROVIDER');
  const searchProvider = value('SEARCH_PROVIDER');
  const zhida = value('MODEL_PROVIDER') === 'zhida' || chatProvider === 'zhida';
  const compatible = value('MODEL_PROVIDER') === 'openai-compatible';
  const local = chatProvider === 'ollama' || chatProvider === 'llama.cpp';

  return <form className="model-settings-form" onSubmit={event => void save(event)} aria-label="模型与 API 配置">
    <h3>模型与 API 配置</h3>
    <p>保存后立即生效。密钥保存在这台 Mac，保存时不会调用接口。</p>
    {settings ? <fieldset disabled={busy || saving}>
      <div className="model-settings-grid">
        {select('MODEL_PROVIDER', '投喂模型')}
        {select('CHAT_PROVIDER', '文字聊天')}
        {select('SEARCH_PROVIDER', '内容检索')}
        {zhida && select('ZHIDA_MODEL', '知乎直答模型')}
      </div>
      {compatible && <div className="model-settings-group">
        <h4>OpenAI 兼容 API</h4>
        {input('MODEL_BASE_URL', 'API 地址', 'https://api.openai.com/v1', 512)}
        {input('MODEL_NAME', '模型 ID', '填写服务提供的模型 ID', 200)}
        {password('MODEL_API_KEY', 'API 密钥')}
      </div>}
      {local && <div className="model-settings-group">
        <h4>本机聊天服务</h4>
        {input('CHAT_BASE_URL', '本机服务地址',
          chatProvider === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080', 512)}
        {input('CHAT_MODEL', '本机模型 ID', 'qwen3.5:9b', 150)}
      </div>}
      <div className="model-settings-group">
        {password('ZHIHU_ACCESS_SECRET', '知乎 Access Secret')}
        <small>知乎直答、搜索和热榜使用这份凭据。</small>
      </div>
      {searchProvider === 'brave' && <div className="model-settings-group">
        {password('SEARCH_API_KEY', 'Brave Search API 密钥')}
      </div>}
      <button type="submit" className="primary" disabled={!Object.keys(draft).length}>
        {saving ? '正在保存…' : '保存配置'}
      </button>
    </fieldset> : !error && <p role="status">{bridge ? '正在读取模型配置…' : '请在桌面应用中配置模型。'}</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p className="model-settings-saved" role="status">{notice}</p>}
  </form>;
}
