#!/usr/bin/env bash
# Build the local web sources and an installable, debug-signed Android APK.
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -z "${JAVA_HOME:-}" && -x /workspace/android-jdk/bin/javac ]]; then
  export JAVA_HOME=/workspace/android-jdk
fi

if [[ ! -d node_modules ]]; then
  printf '%s\n' 'Install project dependencies first: npm ci' >&2
  exit 1
fi

# Respect an Android Studio SDK; the cloud setup uses the retained /workspace SDK.
if [[ -z "${ANDROID_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
elif [[ -z "${ANDROID_HOME:-}" && -d /workspace/android-sdk ]]; then
  export ANDROID_HOME=/workspace/android-sdk
elif [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Android/Sdk" ]]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME/platforms/android-35" ]]; then
  printf '%s\n' 'Android SDK Platform 35 is required. Set ANDROID_HOME to your SDK directory.' >&2
  exit 1
fi

if [[ "$ANDROID_HOME" == /workspace/android-sdk ]]; then
  export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/android-gradle}"
  export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/android-user}"
fi

# Java does not automatically use HTTPS_PROXY. Read only its host/port, without
# printing credentials or changing the inherited proxy/CA trust configuration.
proxy_args=()
while IFS= read -r arg; do
  [[ -n "$arg" ]] && proxy_args+=("$arg")
done < <(node --input-type=commonjs -e '
  const value = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (value) {
    const p = new URL(value);
    if (p.protocol === "http:" || p.protocol === "https:") {
      const port = p.port || (p.protocol === "https:" ? "443" : "80");
      for (const protocol of ["http", "https"]) {
        process.stdout.write(`-D${protocol}.proxyHost=${p.hostname}\n-D${protocol}.proxyPort=${port}\n`);
      }
    }
  }
')

npm run build
npx --no-install cap sync android
(
  cd android
  ./gradlew --no-daemon --max-workers=2 "${proxy_args[@]}" --console=plain assembleDebug
)
mkdir -p artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/mahub-kull-debug.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose artifacts/mahub-kull-debug.apk
printf '\n%s\n' 'Installable debug APK: artifacts/mahub-kull-debug.apk'
sha256sum artifacts/mahub-kull-debug.apk
