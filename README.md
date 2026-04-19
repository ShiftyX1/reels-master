# Reels Master

A browser extension for enhanced Instagram Reels experience with volume control, video downloading, and seeking.

## Features

- **Volume control** — Vertical slider for precise video volume adjustment
- **Download reels** — Save reels to your device with a single click
- **Video seeking** — Scrub through a reel with a progress bar — no need to rewatch from the beginning if you missed something

## Installation

### Chrome

1. Download the latest `reels-master-chrome.zip` from [GitHub Releases](https://github.com/ShiftyX1/reels-master/releases)
2. Unzip the archive
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** in the top-right corner
5. Click **Load unpacked** and select the unzipped folder

### Firefox

1. Download the latest `reels-master-firefox.zip` from [GitHub Releases](https://github.com/ShiftyX1/reels-master/releases)
2. Open Firefox and go to `about:addons`
3. Click the gear icon → **Install Add-on From File...**
4. Select the downloaded `.zip` file

> [!NOTE]
> The extension will be published to the Chrome Web Store and Firefox Add-ons (AMO) in the future. Manual installation only for now.

## Development

1. Install dependencies:
```bash
pnpm install
```

2. Build the extension:
```bash
# Both browsers
pnpm build

# Chrome only
pnpm build:chrome

# Firefox only
pnpm build:firefox
```

3. Load in browser:
   - **Chrome:** open `chrome://extensions/`, enable Developer mode, click **Load unpacked**, select the `dist/` folder
   - **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, select any file inside `dist/`

### Watch mode

```bash
# Chrome
pnpm dev

# Firefox
pnpm dev:firefox
```

## Usage

1. Open Instagram and navigate to any reel
2. New controls will appear next to the like and comment buttons:
   - **Mute button** — toggle audio on/off
   - **Volume slider** — drag to adjust volume (0–100%)
   - **Download button** — click to save the current reel
3. A **progress bar** with current time and duration is shown in the video overlay for seeking

## License

MIT
