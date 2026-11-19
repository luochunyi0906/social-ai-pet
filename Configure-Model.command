#!/bin/zsh
set -e
cd "$(dirname "$0")"
umask 077
if [[ -d "$PWD/release/看山有伴.app" || -d "$PWD/看山有伴.app" ]]; then
  kanshan_config_dir="${KANSHAN_DATA_DIR:-$HOME/Library/Application Support/看山有伴-林间预览}"
  mkdir -p "$kanshan_config_dir"
  kanshan_model_file="$kanshan_config_dir/model.env"
else
  kanshan_model_file="$PWD/.env"
fi
if [[ ! -f "$kanshan_model_file" ]]; then
  cp .env.example "$kanshan_model_file"
fi
exec /usr/bin/open -e "$kanshan_model_file"
