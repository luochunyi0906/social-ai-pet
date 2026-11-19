#!/bin/zsh
set -eu

project_dir="${0:A:h}"
private_dir="${KANSHAN_LOCAL_DIR:-${project_dir}/../../.local-config}"
model_id="${KANSHAN_CHAT_MODEL:-qwen3.5:9b}"
model_file="${KANSHAN_CHAT_MODEL_FILE:-${private_dir}/kanshan-models/qwen3.5-9b-q4.gguf}"
runner="${KANSHAN_LLAMA_SERVER:-${private_dir}/kanshan-llama/llama-server}"
app_path="${project_dir}/release/看山有伴.app"
if [[ -d "${project_dir}/看山有伴.app" ]]; then app_path="${project_dir}/看山有伴.app"; fi
context="${KANSHAN_CHAT_CONTEXT:-4096}"
port="${KANSHAN_LLAMA_PORT:-17890}"
endpoint="http://127.0.0.1:${port}"
executable="${app_path}/Contents/MacOS/Kanshan"
[[ -x "$executable" ]] || { print -u2 '找不到已构建的看山有伴应用。'; exit 1; }

server_pid=''
cleanup(){
 if [[ -n "$server_pid" ]]; then
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
 fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! /usr/bin/curl -fsS --max-time 2 "${endpoint}/health" >/dev/null 2>&1; then
 [[ -x "$runner" && -f "$model_file" ]] || {
  print -u2 '找不到本机 llama-server 或 Qwen 模型。可在模型配置中选择 Ollama 或已有服务。'
  exit 1
 }
 umask 077
 log_file="$(mktemp -t kanshan-llama)"
 "$runner" --model "$model_file" --alias "$model_id" --host 127.0.0.1 --port "$port" \
  --ctx-size "$context" --parallel 1 --cache-ram 0 --reasoning off --no-context-shift --no-webui \
  --offline --cors-origins localhost --no-cors-credentials >"$log_file" 2>&1 &
 server_pid=$!
 print '刘看山正在加载本机模型…'
 for attempt in {1..90}; do
  if /usr/bin/curl -fsS --max-time 1 "${endpoint}/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then print -u2 "本机模型启动失败。日志位于 $log_file"; exit 1; fi
  sleep 1
 done
fi
/usr/bin/curl -fsS --max-time 3 "${endpoint}/v1/models" | /usr/bin/grep -Fq "\"id\":\"${model_id}\"" || {
 print -u2 '本机服务尚未就绪，或正在运行其他模型。请检查服务端口和模型名称。'
 exit 1
}
CHAT_PROVIDER=llama.cpp CHAT_MODEL="$model_id" CHAT_BASE_URL="$endpoint" CHAT_CONTEXT_TOKENS="$context" "$executable"
