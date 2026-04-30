import { App, Plugin, PluginSettingTab, Setting, TFolder, Notice, setIcon } from "obsidian";
import { JDItemModal } from "./modals";
import { getNextAvailableJD } from "./utils";

export interface JDSettings {
    cleanViewEnabled: boolean;
    areaNamingStyle: 'range' | 'single';
    showRibbonIcons: boolean;
    replaceNativeNewFolder: boolean;
}

const DEFAULT_SETTINGS: JDSettings = {
    cleanViewEnabled: true,
    areaNamingStyle: 'range',
    showRibbonIcons: true,
    replaceNativeNewFolder: false
};

export default class JohnnyDecimalPlugin extends Plugin {
    settings: JDSettings;
    private observer: MutationObserver | null = null;
    private ribbonCreateEl: HTMLElement | null = null;
    private ribbonToggleEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        // 1. Commands & Hotkeys
        this.addCommand({
            id: 'create-jd-item',
            name: 'Create New Johnny.Decimal Item',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "j" }],
            callback: () => {
                new JDItemModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: 'toggle-clean-view',
            name: 'Toggle Clean View',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "h" }],
            callback: async () => {
                this.settings.cleanViewEnabled = !this.settings.cleanViewEnabled;
                await this.saveSettings();
                new Notice(this.settings.cleanViewEnabled ? "JD Clean View: ON" : "JD Clean View: OFF");
            }
        });

        // 2. Ribbon Icons
        this.ribbonCreateEl = this.addRibbonIcon('folder-plus', 'Create JD Item', () => {
            new JDItemModal(this.app, this).open();
        });
        
        this.ribbonToggleEl = this.addRibbonIcon('eye', 'Toggle JD Clean View', async () => {
            this.settings.cleanViewEnabled = !this.settings.cleanViewEnabled;
            await this.saveSettings();
            new Notice(this.settings.cleanViewEnabled ? "JD Clean View: ON" : "JD Clean View: OFF");
        });
        
        this.updateRibbonIcons();

        // 3. Settings Tab
        this.addSettingTab(new JDSettingsTab(this.app, this));

        // 4. File Context Menu (Right Click)
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle("Create JD Item inside")
                            .setIcon("folder-plus")
                            .onClick(() => {
                                const nextJd = getNextAvailableJD(file);
                                new JDItemModal(this.app, this, nextJd || "").open();
                            });
                    });
                }
            })
        );

        // 5. Native "New Folder" Hijack
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            if (this.settings.replaceNativeNewFolder) {
                const target = evt.target as HTMLElement;
                const btn = target.closest('.nav-action-button[aria-label="New folder"]');
                if (btn) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    new JDItemModal(this.app, this).open();
                }
            }
        }, { capture: true });

        // Start systems
        this.startObserver();
        this.updateCleanViewClass();
    }

    onunload() {
        this.stopObserver();
        document.body.classList.remove("jd-clean-view-active");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        this.updateCleanViewClass();
        this.updateRibbonIcons();
        
        // Re-process all nodes when settings change
        this.stopObserver();
        this.startObserver();
    }

    updateRibbonIcons() {
        if (this.ribbonCreateEl && this.ribbonToggleEl) {
            this.ribbonCreateEl.style.display = this.settings.showRibbonIcons ? 'flex' : 'none';
            this.ribbonToggleEl.style.display = this.settings.showRibbonIcons ? 'flex' : 'none';
        }
    }

    updateCleanViewClass() {
        if (this.settings.cleanViewEnabled) {
            document.body.classList.add("jd-clean-view-active");
            if (this.ribbonToggleEl) setIcon(this.ribbonToggleEl, 'eye-off');
        } else {
            document.body.classList.remove("jd-clean-view-active");
            if (this.ribbonToggleEl) setIcon(this.ribbonToggleEl, 'eye');
        }
    }

    startObserver() {
        if (!this.observer) {
            this.observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node instanceof HTMLElement) {
                                if (node.classList && (node.classList.contains('nav-folder-title-content') || node.classList.contains('nav-file-title-content'))) {
                                    this.processNode(node);
                                }
                                node.querySelectorAll?.('.nav-folder-title-content, .nav-file-title-content').forEach(n => this.processNode(n as HTMLElement));
                            }
                        });
                    } else if (mutation.type === 'characterData') {
                        const parent = mutation.target.parentElement;
                        if (parent && (parent.classList.contains('nav-folder-title-content') || parent.classList.contains('nav-file-title-content'))) {
                            this.processNode(parent);
                        }
                    }
                }
            });

            this.observer.observe(document.body, { 
                childList: true, 
                subtree: true,
                characterData: true
            });
        }

        // Initial process
        document.querySelectorAll('.nav-folder-title-content, .nav-file-title-content').forEach(n => this.processNode(n as HTMLElement));
    }

    stopObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Restore original text
        document.querySelectorAll('[data-jd-processed="true"]').forEach(node => {
            const originalText = node.getAttribute('data-jd-original-text');
            if (originalText) {
                node.textContent = originalText;
            }
            node.removeAttribute('data-jd-processed');
            node.removeAttribute('data-jd-original-text');
        });
    }

    processNode(node: HTMLElement) {
        if (node.hasAttribute('data-jd-processed')) return;
        
        const text = node.textContent;
        if (!text || !text.trim()) return;

        let originalPrefix = "";
        let dynamicPrefix = "";
        let rest = text;

        // Check if it's an Area range "10-19 "
        const rangeMatch = text.match(/^(\d0)-(\d9)([\s_\-])/);
        if (rangeMatch && parseInt(rangeMatch[1]) + 9 === parseInt(rangeMatch[2])) {
            originalPrefix = rangeMatch[0];
            const base = parseInt(rangeMatch[1]);
            const separator = rangeMatch[3];
            dynamicPrefix = this.settings.areaNamingStyle === 'single' ? `${base}${separator}` : originalPrefix;
            rest = text.substring(originalPrefix.length);
        } 
        
        if (!originalPrefix) {
            // Check if it's an Area single "10 ", Category "11 ", or Item "11.01 "
            const singleMatch = text.match(/^(\d{2}(\.\d{1,2})?)([\s_\-])/);
            if (singleMatch) {
                originalPrefix = singleMatch[0];
                const numStr = singleMatch[1];
                const separator = singleMatch[3];
                
                const titleNode = node.closest('.nav-folder-title, .nav-file-title');
                const dataPath = titleNode?.getAttribute('data-path') || "";
                const isRoot = dataPath !== "" && !dataPath.includes('/');

                // If it's a multiple of 10 without a decimal AND it's at the vault root, it's an Area
                if (/^\d0$/.test(numStr) && isRoot) {
                    const base = parseInt(numStr);
                    dynamicPrefix = this.settings.areaNamingStyle === 'range' ? `${base}-${base+9}${separator}` : originalPrefix;
                } else {
                    // Category or Item
                    dynamicPrefix = originalPrefix; 
                }
                rest = text.substring(originalPrefix.length);
            }
        }

        if (originalPrefix) {
            node.setAttribute('data-jd-processed', 'true');
            node.setAttribute('data-jd-original-text', text);
            
            node.textContent = '';
            
            const span = document.createElement('span');
            span.classList.add('jd-prefix-mask');
            span.textContent = dynamicPrefix;
            
            node.appendChild(span);
            node.appendChild(document.createTextNode(rest));
        }
    }
}

class JDSettingsTab extends PluginSettingTab {
    plugin: JohnnyDecimalPlugin;

    constructor(app: App, plugin: JohnnyDecimalPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'Johnny.Decimal Manager Settings' });

        new Setting(containerEl)
            .setName('Clean View')
            .setDesc('Visually hide the JD prefix in the File Explorer.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.cleanViewEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.cleanViewEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Area Naming Style')
            .setDesc('Choose how Area folders should be formatted and displayed.')
            .addDropdown(drop => drop
                .addOption('range', 'Range')
                .addOption('single', 'Single')
                .setValue(this.plugin.settings.areaNamingStyle)
                .onChange(async (value) => {
                    this.plugin.settings.areaNamingStyle = value as 'range' | 'single';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Ribbon Icons')
            .setDesc('Display the quick-action icons in the left sidebar.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRibbonIcons)
                .onChange(async (value) => {
                    this.plugin.settings.showRibbonIcons = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Replace Native "New Folder" Button')
            .setDesc('Diverts the default Obsidian File Explorer "New folder" button to open the Johnny.Decimal creation modal instead.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replaceNativeNewFolder)
                .onChange(async (value) => {
                    this.plugin.settings.replaceNativeNewFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
