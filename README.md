# Johnny.Decimal Manager for Obsidian

**Johnny.Decimal Manager** is a powerful, non-destructive Obsidian plugin designed to automate and enforce the standard Johnny.Decimal classification system within your vault.

[![Downloads](https://img.shields.io/badge/dynamic/json?color=7C3AED&label=Downloads&query=%24%5B%22johnny-decimal-manager%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://community.obsidian.md/plugins/johnny-decimal-manager)
[![Version](https://img.shields.io/github/v/release/rzrabbi/obsidian-johnny-decimal-manager)](https://github.com/rzrabbi/obsidian-johnny-decimal-manager/releases/latest)

## 🧠 Why Johnny.Decimal?

While many plugins help you sort files inside Obsidian, they often rely on metadata that doesn't translate to your actual hard drive. This leads to several problems:

- **Platform Consistency**: Different machines and OS explorers (Windows, Mac, Mobile) often have different default sorting, making your files hard to find outside of Obsidian.
- **GitHub & Cloud Portability**: In GitHub or cloud backups, your files are often a jumbled mess unless they are structurally organized.
- **AI Readiness**: Modern AI agents work best with organized data. A structured vault reduces the "search hassle" for AI, allowing agents to find your files and provide answers much faster.

## ❓ What is Johnny.Decimal?

In short, it’s a way to give everything a permanent "address." You break your life into 10 Areas, and each area into 10 Categories.

**Example:**

- **Area 10-19**: Finance
- **Category 11**: Tax
- **ID 11.01**: Tax Returns 2024

**Visual Folder Hierarchy:**

```text
root/
├── 10-19 Finance/
│   ├── 11 Tax/
│   │   ├── 11.01 Tax Returns 2024.md
│   │   └── 11.02 Receipts.md
│   └── 12 Banking/
│       └── 12.01 Statements.md
└── 20-29 Personal/
    └── 21 Health/
        └── 21.01 Medical Records.md
```

Instead of "searching" for a file, you "know" exactly where it is based on its number. If you want to learn more, visit the official site: [johnnydecimal.com](https://johnnydecimal.com/)

---

> [!IMPORTANT]
> **Disclaimer:** I am not the creator of the Johnny.Decimal system. This plugin is an independent tool designed to simplify, maintain, and implement the Johnny.Decimal workflow within Obsidian. All conceptual credit for the original system belongs to [johnnydecimal.com](https://johnnydecimal.com/).

## ✨ Features

- **⚡ Smart Cascading Creation:** Just type your target Item ID (e.g., `11.01`). If Area `10-19` or Category `11` are missing, the plugin intelligently detects it and prompts you to create the entire parent hierarchy in one fluid motion.
- **🔢 Intelligent ID Suggestions:** Right-click any folder to create a new item inside—the plugin automatically scans the contents and pre-fills the modal with the next available JD number (e.g., if `11.01` exists, it suggests `11.02`).
- **🖱️ Native Integration & Quick Access:** Access the creator instantly via the left-side Ribbon Icons, the command palette, or simply right-click any folder and select "Create JD Item inside".
- **👁️ Clean View (Non-Destructive):** Love the organization but hate the numbers? Toggle "Clean View" from the command palette to visually hide the `11.01 ` prefix in Obsidian's File Explorer. Your actual folder names on your hard drive remain untouched.
- **🎨 Dynamic Area Formatting:** Prefer Areas to display as a single number (`10 Finance`) instead of a range (`10-19 Finance`)? Change this in settings. The plugin dynamically reformats existing folders visually while preserving standard compliance on disk.
- **🛡️ Duplicate Prevention:** Built-in safeguards actively scan for existing folders to prevent duplicate numbers.

## 🚀 Usage

1.  **Left Ribbon Menu**: Click the standard `folder-plus` icon.
2.  **Command Palette**: Run: `Create new item`.
3.  **Right Click Context Menu**: Right-click any folder and select "Create JD Item inside".
4.  **Hotkeys**: Assign your own shortcuts in Obsidian's Hotkeys settings if you want keyboard access.

**The Creation Modal:**

- **Type**: Choose Folder or File.
- **JD Number**: Enter Area, Category, or Item (e.g., `11.01`).
- **Name**: Enter the human-readable name (e.g., `Tax Returns 2024`).

_If parent folders are missing, a secondary modal will elegantly ask you to name them so the entire branch is built at once!_

## ⚙️ Settings

- **Clean View**: Visually hides JD prefixes in the Obsidian File Explorer.
- **Area Naming Style**: Choose between **Range (10-19)** or **Single Number (10)**.
- **Show Ribbon Icons**: Show/hide quick-action icons in the left sidebar.
- **Replace Native "New Folder" Button**: Diverts the default Obsidian "New folder" button to open the JD creator.

## 📦 Installation

### Option 1: Community Plugins (Inside Obsidian)

1. Open **Obsidian Settings**.
2. Go to **Community plugins**.
3. Search for **Johnny.Decimal Manager**.
4. Click **Install** and enable the plugin.

### Option 2: Community Plugin Directory (Web)

1. Visit the Obsidian Community Plugins directory:  
   https://community.obsidian.md/

2. Search for **Johnny.Decimal Manager**.

3. Click the **Add to Obsidian** button.

4. Obsidian will open automatically. Click **Install**, then enable the plugin.

**Direct Link:**  
You can also open the plugin page directly:  
https://community.obsidian.md/plugins/johnny-decimal-manager

Then click **Add to Obsidian** and install the plugin from within Obsidian.

### Option 3: Obsidian BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Open BRAT settings and click **Add Beta plugin**.
3. Enter the repository URL: `rzrabbi/obsidian-johnny-decimal-manager`.

### Option 4: Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [Releases](https://github.com/rzrabbi/obsidian-johnny-decimal-manager/releases) page.
2. Place them inside your vault's `.obsidian/plugins/johnny-decimal-manager/` directory.
3. Reload Obsidian and enable the plugin.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/rzrabbi/obsidian-johnny-decimal-manager/issues).

## 📝 License

This project is licensed under the MIT License.
