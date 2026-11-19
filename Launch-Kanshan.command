#!/bin/zsh
set -e
cd "$(dirname "$0")"
kanshan_app="$PWD/release/看山有伴.app"
if [[ ! -d "$kanshan_app" ]]; then
  echo '尚未生成Mac应用。请在项目目录运行 npm run package:mac。'
  read -r '?按回车退出。'
  exit 1
fi
exec /usr/bin/open "$kanshan_app"
