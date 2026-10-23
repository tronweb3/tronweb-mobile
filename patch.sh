#!/bin/bash
set -euo pipefail

echo "-------------start build tronweb.js--------------"

rimraf tmp && mkdir tmp && cd tmp/
git clone -b v6.4.0 https://github.com/tronprotocol/tronweb
cd tronweb
path=$(dirname $(dirname "$PWD"))
cp -r "$path/tronweb-diff.patch" tronweb-diff.patch
git apply tronweb-diff.patch

npx -y npm@10.9.2 ci

echo "-------------end build tronweb.js--------------"

echo "-------------start md5 compare--------------"

md5_local="303a21a9e4f7323d7cacf780ba070efb"
if which md5 >/dev/null 2>&1; then
    md5_new=$(md5 -q ./dist/TronWeb.js)
else
    md5_new=$(md5sum ./dist/TronWeb.js | cut -d ' ' -f 1)
fi

if [ "$md5_local" == "$md5_new" ] ; then
  echo -e "\033[32m TronWeb.js md5 hash equal \033[0m"
  destDir="$path/dist"
  if [ ! -d "$destDir" ]; then
    mkdir -p "$destDir"
  fi
  cp -r ./dist/TronWeb.js "$destDir/TronWeb.js"
  cd "$path"
  rimraf build
  pnpm run build
else
  echo -e "\033[31m TronWeb.js md5 hash not match \033[0m"
  echo "expected: $md5_local"
  echo "actual:   $md5_new"
  exit 1
fi

echo "-------------end md5 compare--------------"

cd "$path"
rm -rf tmp