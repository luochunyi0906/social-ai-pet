const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

function listening(publish, { delay = 420 } = {}) {
 let state = { output: 'unknown', mode: 'off', cue: 0, changedAt: 0, route: 0 };
 let latest, seated, timeout, processHandle;
 const snapshot = () => state;
 function set(next) {
  if (Object.keys(next).every(key => state[key] === next[key])) return;
  state = { ...state, ...next };
  publish(state);
 }
 function receive(sample) {
  if (!sample || !Number.isSafeInteger(sample.device) || sample.device < 0 ||
      !['headphones', 'other', 'unknown'].includes(sample.output)) return;
  const signature = sample.output + ':' + sample.device;
  if (signature === latest) return;
  const wasHeadphones = state.output === 'headphones';
  latest = signature;
  set({ output: sample.output, route: state.route + 1 });
  clearTimeout(timeout);
  timeout = setTimeout(() => {
   if (signature === seated) return;
   const leavingHeadphones=wasHeadphones||seated?.startsWith('headphones:');
   seated = signature;
   if (sample.output === 'headphones') {
    if (state.mode === 'off') set({ mode: 'auto', cue: state.cue + 1, changedAt: Date.now() });
   } else if (state.mode === 'auto' || (leavingHeadphones && state.mode === 'manual')) {
    set({ mode: 'off', changedAt: Date.now() });
   }
  }, delay);
  timeout.unref?.();
 }
 function choose(mode) {
  if (mode !== 'manual' && mode !== 'off') throw Error('陪听操作无效。');
  if (mode === 'off') {
   clearTimeout(timeout);
   seated = latest;
  }
  if (mode !== state.mode) set({ mode, cue: state.cue + (mode === 'manual' ? 1 : 0), changedAt: Date.now() });
  return snapshot();
 }
 function start() {
  if (process.platform !== 'darwin' || processHandle) return;
  const executable = path.join(__dirname, 'native', 'audio-output');
  if (!fs.existsSync(executable)) return;
  const helper = require('node:child_process').spawn(executable, [], { stdio: ['ignore', 'pipe', 'ignore'] });
  processHandle = helper;
  const lines = readline.createInterface({ input: helper.stdout });
  lines.on('line', line => {
   if (processHandle !== helper || line.length > 160) return;
   try { receive(JSON.parse(line)); } catch {}
  });
  const ended = () => {
   lines.close();
   if (processHandle !== helper) return;
   processHandle = undefined;
   receive({ device: 0, output: 'unknown' });
  };
  helper.once('error', ended);
  helper.once('close', ended);
 }
 function stop() {
  clearTimeout(timeout);
  const helper = processHandle;
  processHandle = undefined;
  helper?.kill();
 }
 return { snapshot, receive, choose, start, stop };
}

module.exports = { listening };
