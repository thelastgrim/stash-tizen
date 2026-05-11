# Stash Tizen TV App

A 10-foot TV interface for [Stash](https://github.com/stashapp/stash), built for Samsung Tizen TVs. Browse your library with the remote, with previews on focus, infinite-scroll grids, a TikTok-style Reels feed...

---

## Table of contents

1. [What this is](#what-this-is)
2. [Requirements](#requirements)
3. [Quick start (developer)](#quick-start-developer)
4. [Configuring your Stash connection](#configuring-your-stash-connection)
5. [Building a `.wgt`](#building-a-wgt)
6. [Install on TV](#install-on-tv)
   - [Option A — Sideload](#option-a--sideload)
   - [Option B — TizenBrew](#option-b--tizenbrew)
7. [Sideload install reference](#sideload-install-reference)
8. [Project structure](#project-structure)
9. [Troubleshooting](#troubleshooting)
10. [License & contributing](#license--contributing)

---

## What this is

A React + Vite single-page app, packaged as a Tizen web widget (`.wgt`), that talks to a Stash server's GraphQL API. Designed to feel native on a Samsung TV remote — D-pad navigation, focus rings, hardware Back button, on-card preview videos, resume playback, the works.

Tabs:

- **Home** — scenes grid, with Classic / Carousel / Coverflow modes
- **Performers** — grid of performers, each with a detail page showing all their scenes
- **Markers** — scene markers, each previewing its own short clip on focus
- **Reels** — full-screen vertical-snap feed of scenes (Reels-style)

---

## Requirements

To **run** the built app, you need:

- A Samsung TV running Tizen 4.0 or newer (most TVs from 2018 onwards)
- A reachable [Stash](https://github.com/stashapp/stash) server on the same network

To **build** the app, you need:

- [Node.js](https://nodejs.org/) 18+ and npm
- [Tizen Studio](https://download.tizen.org/sdk/Installer/) — for the `tizen` CLI and Certificate Manager. The IDE itself isn't required if you only use the CLI tools.
- A Samsung developer certificate (free, created inside Tizen Studio's Certificate Manager)
- Your TV's DUID, if you're sideloading directly

---

## Quick start (developer)

```bash
git clone https://github.com/thelastgrim/stash-tizen
cd stash-tizen
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. The app starts in **Test mode** by default (mock data, SFW). To point it at a real Stash server, open the Settings panel via the hamburger menu in the top-right.


---

## Configuring your Stash connection

Two ways:

### Runtime (recommended for most users)

Open Settings → flip to **Live** mode → enter:

- Your Stash GraphQL URL (e.g. `http://192.168.1.42:9999`)
- Your Stash API key (optional, only if your Stash requires it)

Click **Test connection** to verify, then **Save**. The app persists this to localStorage and uses it on subsequent launches.


### Build-time (for creating a pre-configured `.wgt`)

If you want the app to launch already pointed at your Stash (no Settings entry needed), bake the credentials into the build:

```bash
cp .env.example .env.production
```

Edit `.env.production`:

```
VITE_STASH_URL=your-stash-address:stash-port
VITE_STASH_API_KEY=your-stash-api-key
```

Now `npm run build` produces a bundle with your credentials embedded. The app will start in Test mode on first launch with no Settings entry needed.


This outputs `dist/index.html` and `dist/assets/*` — used for creating a signed .wgt (see below).

**Warning:** the resulting `.wgt` contains your API key in plain text. Don't share it with anyone you wouldn't trust with Stash access.

---

## Building a `.wgt`

A `.wgt` is the package format Tizen TVs install. It's a signed zip of your build output plus a `config.xml` manifest.

### One-time setup

1. Install Tizen Studio (CLI tools at minimum).
2. Open **Tools → Certificate Manager** and create a **Samsung** profile:
   - Author certificate (your identity as the developer)
   - Distributor certificate (Samsung-issued, signs the package)
   - Add your TV's DUID (find it via Developer Mode on the TV itself — see [Sideload install reference](#sideload-install-reference))
3. Verify the profile is active:
   ```bash
   tizen security-profiles list
   ```
   Look for `O` in the Active column next to your profile name.

### Build

The repo includes `build-tizen.sh` (Linux/macOS/Git Bash) and `build-tizen.cmd` (Windows). They:

1. Run `npm run build`
2. Copy `tizen/config.xml` and `tizen/icon.png` into `dist/`
3. Sign and package the result into a `.wgt`

Run from the project root, passing your cert profile name:

```bash
./build-tizen.sh myprofile
```

or on Windows:

```cmd
build-tizen.cmd myprofile
```

If successful, you'll see:

```
Package File Location: .../dist/StashTizen.wgt
```

### Git Bash on Windows

If `tizen: command not found` in Git Bash even though it works in `cmd.exe`, your PATH isn't propagating. Add to `~/.bashrc`:

```bash
export PATH="$PATH:/c/tizen-studio/tools/ide/bin:/c/tizen-studio/tools"
```

Then `source ~/.bashrc` or reopen Git Bash.

---

## Install on TV

Two real options. Pick based on how much friction you and your friends can tolerate.

### Option A — Sideload

The traditional Tizen path. You sign a `.wgt` against a cert profile that includes your TV DUID.
You install it using Tizen Studio or CLI.

**Steps**:

1. Enable Developer Mode on your TV (see below) and note your DUID.
2. Add your DUID to your cert profile in Certificate Manager.
3. Run `build-tizen.bat <your-profile-name>` , `tizen security-profiles list` to get your profile name
### Install a `.wgt`

```bash
sdb connect <tv-ip>:26101
sdb devices                              # confirm the TV shows up
tizen install -n StashTizen.wgt -t <device-name-from-sdb>
```

### Option B — TizenBrew

[TizenBrew](https://github.com/reisxd/TizenBrew) is a third-party host app for Samsung TVs that loads other web apps inside it.
You install TizenBrew once on your own TV (signed with your own cert via TizenBrew Installer), then install app from USB drive.

**Steps**:

1. Download [TizenBrew Installer](https://github.com/reisxd/TizenBrewInstaller/releases).
2. Run it with your TV in Developer Mode and connected via `sdb`.
3. The installer creates a cert profile for your, signs TizenBrew with it, and pushes it to the TV.

**Steps to load this app via TizenBrew**:

1. Open TizenBrew on your TV.
2. Follow on-screen instructions for USB installation

If you prefer, you can host the built `dist/` folder somewhere (GitHub Pages, a personal server, anything serving static files over HTTPS) and enter that URL in TizenBrew instead. Either works.


**Tizen Brew documentation** [the official TizenBrew docs](https://github.com/reisxd/TizenBrew/blob/main/docs/README.md) for the latest install steps, which may evolve faster than this README.

## Sideload install reference

For people using Option A

### Enable Developer Mode on the TV

1. From the home screen, navigate to **Apps**.
2. With the Apps panel open, press **1**, **2**, **3**, **4**, **5** on the remote (numeric or on-screen).
3. A Developer Mode dialog appears.
4. Toggle **Developer mode** to **On**.
5. Enter your PC's IP address in the **Host PC IP** field.
6. Restart the TV (or wait for it to refresh).

### Find the TV's DUID

In the Developer Mode dialog, the DUID is shown after a successful toggle. It's a string like `0000000A1B2C3D4E...`.

Alternatively, via CLI after connecting:

`<device-name-from-sdb>` is whatever appears in the `sdb devices` output for your TV (often the IP with port, e.g. `192.168.1.50:26101`).

After install, the app appears in the TV's Apps grid.

---

## Project structure

```
stash-tizen-tv-app/
├── src/
│   ├── components/             ← UI components (TabBar, VideoGrid, VideoCard, etc.)
│   ├── pages/                  ← Top-level routes (HomePage, PerformersPage, MarkersPage, RandomPage)
│   ├── hooks/                  ← useFocusable, useKeyHandler — TV remote nav
│   ├── utils/                  ← Stash services (videoService, performerService, markerService), settings, discovery
│   ├── App.jsx                 ← Root, tab routing, modal state
│   ├── main.jsx                ← Entry, Tizen remote key registration
│   └── index.css               ← Theme, fonts, focus ring rules
├── tizen/
│   ├── config.xml              ← Tizen manifest (app id, name, privileges, icon)
│   └── icon.png                ← 117x117 app icon
├── public/                     ← Static assets copied as-is
├── .env.example                ← Template for build-time Stash config
├── build-tizen.sh              ← Linux/macOS/Git Bash build script
├── build-tizen.cmd             ← Windows build script
├── vite.config.js
└── package.json
```

`src/components` is the bulk of the code. Each component is one concern (a card, a grid, a panel) with its own CSS module.

`src/utils/settings.js` is the central source of truth for runtime configuration — read it once if you want to understand how the app decides whether to use mock data or hit a real Stash server.

---

## Troubleshooting

**`build-tizen.sh: tizen: command not found` (Git Bash on Windows)**
Add Tizen Studio to PATH — see [Git Bash on Windows](#git-bash-on-windows) above.

**`build-tizen.sh` runs but produces no `.wgt`**
Almost always wrong cert profile name. Check `tizen security-profiles list` and pass the correct name to the script.

**App installs but launches to a black screen**
Open the TV's web inspector (Tizen Studio → Inspect, or sdb forward) and check the console. Common causes: the configured Stash URL is unreachable, or there's a JS error in a recently added component.

**Hardware Back button does nothing on a tab**
The app handles Back globally via `useKeyHandler`. If you've added a new page or modal, make sure it either uses the global Back action or installs its own capture-phase handler that calls `e.stopPropagation()`.

**Resume bar shows but progress is wrong**
The bar reads `video.resume_time` from the GraphQL scene response. If your Stash version doesn't expose `resume_time` (added in a recent release), the bar won't render. Update Stash, or remove the resume_time block from the GraphQL query in `videoService.js`.

---

## License & contributing

Licensed under the MIT License — see `LICENSE` for details.

Contributions welcome. This is a personal-scale project, so PRs are best discussed in an issue first to avoid wasted effort. Bug reports with a clear reproduction (TV model, firmware version, what you did, what happened) are always useful.
