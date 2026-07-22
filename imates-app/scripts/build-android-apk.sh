#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${PROJECT_ROOT}/android"
APK_SOURCE="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
REQUESTED_VARIANT="${1:-all}"

case "${REQUESTED_VARIANT}" in
  all|development|internal|release) ;;
  *)
    echo "用法：$0 [all|release|internal|development]" >&2
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
  EXPO_PUBLIC_BUILD_CHANNEL=RELEASE npx expo prebuild --platform android --no-install
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

build_variant() {
  local variant="$1"
  local app_env
  local build_channel
  local application_id
  local app_name
  local apk_output

  case "${variant}" in
    release)
      app_env="RELEASE"
      build_channel="RELEASE"
      application_id="com.cosinetech.imates.edu"
      app_name="手机学伴"
      apk_output="${PROJECT_ROOT}/手机学伴.apk"
      ;;
    internal)
      app_env="RELEASE"
      build_channel="INTERNAL"
      application_id="com.cosinetech.imates.edu.internal"
      app_name="手机学伴内测版"
      apk_output="${PROJECT_ROOT}/手机学伴内测版.apk"
      ;;
    development)
      app_env="INTERNAL_TEST"
      build_channel="DEVELOPMENT"
      application_id="com.cosinetech.imates.edu.development"
      app_name="手机学伴开发版"
      apk_output="${PROJECT_ROOT}/手机学伴开发版.apk"
      ;;
  esac

  echo
  echo "开始构建：${app_name} (${application_id})"
  (
    cd "${ANDROID_DIR}"
    # 环境变量不是 Gradle 的声明式输入，精确删除 JS 产物以确保每一版重新内联环境配置。
    rm -f \
      app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle \
      app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map
    NODE_ENV=production \
    EXPO_PUBLIC_APP_ENV="${app_env}" \
    EXPO_PUBLIC_BUILD_CHANNEL="${build_channel}" \
    ./gradlew \
      -Pimates.applicationId="${application_id}" \
      -Pimates.appName="${app_name}" \
      assembleRelease
  )

  cp "${APK_SOURCE}" "${apk_output}"
  echo "构建渠道：${build_channel}，接口环境：${app_env}"
  echo "应用包名：${application_id}"
  echo "APK 已生成：${apk_output}"
  ls -lh "${apk_output}"
  shasum -a 256 "${apk_output}"
}

if [[ "${REQUESTED_VARIANT}" == "all" ]]; then
  build_variant release
  build_variant internal
  build_variant development
else
  build_variant "${REQUESTED_VARIANT}"
fi
