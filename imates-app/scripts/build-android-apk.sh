#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${PROJECT_ROOT}/android"
APK_SOURCE="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
BUILD_CHANNEL="${1:-internal}"

case "${BUILD_CHANNEL}" in
  internal)
    APP_ENV="RELEASE"
    BUILD_CHANNEL_ENV="INTERNAL"
    APK_OUTPUT="${PROJECT_ROOT}/imates-app-internal.apk"
    ;;
  release)
    APP_ENV="RELEASE"
    BUILD_CHANNEL_ENV="RELEASE"
    APK_OUTPUT="${PROJECT_ROOT}/imates-app-release.apk"
    ;;
  *)
    echo "用法：$0 [internal|release]" >&2
    exit 1
    ;;
esac

cd "${PROJECT_ROOT}"

command -v node >/dev/null || { echo "错误：未安装 Node.js" >&2; exit 1; }
command -v npm >/dev/null || { echo "错误：未安装 npm" >&2; exit 1; }
command -v java >/dev/null || { echo "错误：未安装 JDK" >&2; exit 1; }

if [[ ! -d node_modules ]]; then
  npm ci
fi

npx expo install --check
npm run build:pdf-explore-viewer
npx tsc --noEmit

if [[ ! -d "${ANDROID_DIR}" ]]; then
  npx expo prebuild --platform android --no-install
fi

if [[ ! -f "${ANDROID_DIR}/local.properties" ]]; then
  SDK_PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"

  if [[ -z "${SDK_PATH}" && "$(uname -s)" == "Darwin" ]]; then
    SDK_PATH="${HOME}/Library/Android/sdk"
  fi

  if [[ -z "${SDK_PATH}" || ! -d "${SDK_PATH}" ]]; then
    echo "错误：找不到 Android SDK，请设置 ANDROID_HOME。" >&2
    exit 1
  fi

  printf 'sdk.dir=%s\n' "${SDK_PATH}" > "${ANDROID_DIR}/local.properties"
fi

cd "${ANDROID_DIR}"
# Gradle 不会自动把环境变量变化视为 Metro bundle 输入，删除指定构建产物以强制重新打包 JS。
rm -f \
  app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle \
  app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map
NODE_ENV=production \
EXPO_PUBLIC_APP_ENV="${APP_ENV}" \
EXPO_PUBLIC_BUILD_CHANNEL="${BUILD_CHANNEL_ENV}" \
./gradlew assembleRelease

cp "${APK_SOURCE}" "${APK_OUTPUT}"

echo
echo "构建渠道：${BUILD_CHANNEL_ENV}，接口环境：${APP_ENV}"
echo "APK 已生成：${APK_OUTPUT}"
ls -lh "${APK_OUTPUT}"
shasum -a 256 "${APK_OUTPUT}"
