# 👻 GhostDesk

A screen-invisible floating overlay desktop app built with Electron. Features a private **AI assistant** (powered by Anthropic Claude), notes, snippets, tasks, and multi-desk support — all invisible to screen recording tools like OBS, Zoom, Teams, and Google Meet.

![GhostDesk](https://img.shields.io/badge/Electron-28-blue?logo=electron) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## ✨ Features

### 🤖 AI Assistant
- Powered by **Anthropic Claude** (claude-sonnet-4-6)
- **Streaming responses** — text appears token by token
- Full **conversation history** — Claude remembers context within session
- Your API key stored securely on-device via electron-store
- Concise responses optimized for the overlay window size

### 👻 Screen Invisibility
| Platform | Method |
|---|---|
| Windows 10 2004+ | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` via C++ native addon |
| macOS | `BrowserWindow.setContentProtection(true)` → `NSWindowSharingNone` |
| Linux | `BrowserWindow.setContentProtection(true)` |

Invisible to OBS, Zoom, Google Meet, Teams, ShareX, and all screen recording tools.

### 🖥 Multi-Desk
- Open unlimited overlay windows — each with its own color, name, and isolated data
- 3 ways to open: `Ctrl+Shift+N`, the ＋ button, or the Desks tab
- Color-coded desk strip shows all active desks
- Each desk is independently persistent

### 📝 Notes
- Private scratchpad — auto-saves per desk

### ⚡ Snippets
- Save frequently used text snippets
- One-click copy to clipboard

### ✅ Tasks
- Simple checklist — toggle done/undone, delete tasks

### 🎨 More
- Opacity slider (30%–100%)
- `Ctrl+Shift+G` — global show/hide all desks
- System tray support
- Runs silently in the background

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm

**Windows only (for full screen-capture exclusion):**
```bash
npm install --global windows-build-tools
```

### Install & Run
```bash
git clone https://github.com/yourusername/ghost-desk.git
cd ghost-desk
npm install
npm start
```

### Build Distributable
```bash
npm run dist
```

---

## 🤖 Setting Up AI

1. Get a free API key from [console.anthropic.com](https://console.anthropic.com)
2. Launch GhostDesk — the AI tab opens by default
3. Paste your key (starts with `sk-ant-...`) and click **Save**
4. Start chatting! Your key is stored locally and never sent anywhere except Anthropic's API.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+G` | Toggle show/hide all desks |
| `Ctrl+Shift+N` | Open a new desk |
| `Enter` | Send AI message |
| `Shift+Enter` | New line in AI input |

---

## 📁 Project Structure

```
ghost-desk/
├── src/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Secure IPC bridge
│   ├── index.html       # Full UI (all tabs + AI chat)
│   └── ghost_addon.cc   # C++ native addon (Windows WDA)
├── scripts/
│   └── try-build-addon.js
├── binding.gyp          # Native addon build config
├── package.json
└── README.md
```

---

## 🛠 Tech Stack

- **Electron** — cross-platform desktop shell
- **Anthropic Claude API** — AI with streaming
- **electron-store** — encrypted local storage
- **Win32 API** — `SetWindowDisplayAffinity` for Windows screen capture exclusion
- **Node Addon API (NAPI)** — C++ native bridge for Windows

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built as a portfolio project demonstrating Electron, native C++ addons, AI streaming APIs, and multi-window IPC.*
