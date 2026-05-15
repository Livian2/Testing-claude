# NL Belasting Pro — Android

Native Android wrapper of the Dutch tax calculator, built with **Capacitor**.
The entire UI is the same React/Vite app — Capacitor packages `dist/` into a
native `WebView` so it runs offline on any Android 7+ device.

JSON export/import (the "Exporteer" / "Importeer" buttons in the header)
works on Android out of the box, so you can move data freely between the
**web version** and the **Android app**.

---

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Node.js | ≥ 20 | Vite build + Capacitor CLI |
| Java JDK | 17 (or 21) | Gradle / Android build |
| Android Studio | latest stable | SDK install + emulator + signing UI |
| Android SDK | API 34 (or higher) | target platform |

Install on Ubuntu/Debian:

```bash
# Node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Java
sudo apt install -y openjdk-17-jdk

# Android Studio — download from https://developer.android.com/studio
# Use the first-run wizard to install the SDK to ~/Android/Sdk
```

Set environment vars (in `~/.bashrc` or `~/.zshrc`):

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## First-time setup

```bash
# 1. Install JS deps
npm install

# 2. Generate the Android Studio project (only run once - creates ./android/)
npm run cap:add

# 3. Build the web bundle and sync into the Android project
npm run cap:sync
```

After step 2, an `android/` folder appears containing a complete Android
Studio project. Capacitor regenerates `android/app/src/main/assets/public`
from `dist/` on each `cap:sync`, so you don't edit those files by hand.

---

## Configure the live-price proxy (important!)

The Portfolio tab fetches live prices from Yahoo Finance via `/api/finance/...`.
In the web version a proxy (vite/nginx) handles CORS, but inside an Android
WebView there is no proxy. Two options:

### Option A (recommended) — point at a deployed web instance

1. Deploy the web version on a server with Docker
   (see `../dutch-tax-calculator/`).
2. Create `.env` in this folder:

   ```
   VITE_API_BASE=https://tax.yourdomain.com
   ```

3. Rebuild: `npm run cap:sync`. The APK now hits your nginx, which
   reverse-proxies Yahoo. The Android app and web app share one backend.

### Option B — leave it empty

The calculator/prognose/etc. all work — only the live-price fetch in the
Portfolio tab will fail silently. Manual prices still work.

---

## Day-to-day development

```bash
# Run the web version in the browser (fast iteration)
npm run dev

# When ready to test on Android: rebuild + sync + launch
npm run cap:run
```

`cap:run` uses the first device returned by `adb devices`. Enable USB
debugging on the phone, or start an emulator first.

---

## Building installable APK / AAB

### Debug APK (sideload-friendly, unsigned)

```bash
npm run android:build:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer to your phone and tap to install. You'll need to enable "Install
from unknown sources" the first time.

### Release APK (signed, for distribution outside Play)

1. Create a signing keystore (one-time only - keep this file safe!):

   ```bash
   keytool -genkey -v \
     -keystore release-key.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias nl-belasting
   ```

2. Create `android/key.properties` (NOT committed to git):

   ```
   storeFile=../../release-key.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=nl-belasting
   keyPassword=YOUR_KEY_PASSWORD
   ```

3. Add signing config to `android/app/build.gradle` - above `buildTypes`:

   ```gradle
   def keystorePropertiesFile = rootProject.file("key.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       signingConfigs {
           release {
               keyAlias      keystoreProperties['keyAlias']
               keyPassword   keystoreProperties['keyPassword']
               storeFile     file(keystoreProperties['storeFile'])
               storePassword keystoreProperties['storePassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

4. Build:

   ```bash
   npm run android:build:release
   # Output: android/app/build/outputs/apk/release/app-release.apk
   ```

### Play Store bundle (AAB)

```bash
npm run android:bundle
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Upload to Google Play Console → Internal testing track first.

---

## App icon and splash screen

```bash
# 1. Put a 1024x1024 PNG at resources/icon.png
# 2. Put a 2732x2732 splash at resources/splash.png
# 3. Generate all densities:
npx capacitor-assets generate --android
```

Then `npm run cap:sync` to copy them into the Android project.

---

## Data import / export

Same JSON format as the web app:

- Export → tap the download button in the header. Android's share sheet
  opens — save to Google Drive, email, or save locally.
- Import → tap upload and pick any `nl-belasting-export-*.json` file. Works
  with files exported from the web version, so you can set up your data
  on the web (faster typing), export, import on Android. Or vice-versa.

Internally this uses standard browser `Blob` + `FileReader` APIs, which
Capacitor's WebView supports natively.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `cap: command not found` | Capacitor CLI not installed | `npm install` |
| `SDK location not found` | `ANDROID_HOME` not exported | Set env var, restart shell |
| Gradle says "Java 17 required" | Wrong JDK | `export JAVA_HOME=...openjdk-17...` |
| App opens to white screen | Build not synced after JS change | `npm run cap:sync` |
| Live prices fail | No `VITE_API_BASE` | See proxy section above |
| Old data persists after reinstall | Android backs up app data | Settings -> Apps -> NL Belasting Pro -> Storage -> Clear data |

---

## What's the same as the web version, what's different?

**Same**
- Every calculation, every tab, the AboutPage landing, all UI
- localStorage (Android WebView has full IndexedDB + localStorage support)
- JSON export/import format

**Different**
- No `/api/finance` proxy on-device - needs `VITE_API_BASE` pointing at a
  remote nginx (or accept that live prices won't fetch)
- Runs fully offline once installed
- Native back button closes the current tab / exits the app

---

## Updating from the web version

If `../dutch-tax-calculator/` has new changes you want here:

```bash
# From the workspace root:
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude android \
  --exclude capacitor.config.ts --exclude .env --exclude .env.example \
  --exclude package.json --exclude package-lock.json \
  --exclude README.md --exclude .gitignore \
  --exclude src/utils/apiBase.ts \
  dutch-tax-calculator/ dutch-tax-calculator-android/

# Re-apply the API_BASE patches in priceFetcher.ts and PortfolioSection.tsx
# (see patches below), then:
cd dutch-tax-calculator-android
npm run cap:sync
```

### Required patches in synced code

1. `src/utils/priceFetcher.ts` — add at the top:
   ```ts
   import { API_BASE } from './apiBase';
   ```
   Then in every fetch URL: replace `` `/api/finance/... `` with
   `` `${API_BASE}/api/finance/... ``

2. `src/components/PortfolioSection.tsx` — add at the top:
   ```ts
   import { API_BASE } from '../utils/apiBase';
   ```
   Same template-literal swap.
