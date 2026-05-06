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

        // 1. Commands
        this.addCommand({
            id: 'create-jd-item',
            name: 'Create new item',
            callback: () => {
                new JDItemModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: 'toggle-clean-view',
            name: 'Toggle clean view',
            callback: async () => {
                this.settings.cleanViewEnabled = !this.settings.cleanViewEnabled;
                await this.saveSettings();
                new Notice(this.settings.cleanViewEnabled ? "JD clean view: on" : "JD clean view: off");
            }
        });

        // 2. Ribbon icons
        this.ribbonCreateEl = this.addRibbonIcon('folder-plus', 'Create jd item', () => {
            new JDItemModal(this.app, this).open();
        });
        
        this.ribbonToggleEl = this.addRibbonIcon('eye', 'Toggle jd clean view', async () => {
            this.settings.cleanViewEnabled = !this.settings.cleanViewEnabled;
            await this.saveSettings();
            new Notice(this.settings.cleanViewEnabled ? "JD clean view: on" : "JD clean view: off");
        });
        
        this.updateRibbonIcons();

        // 3. Settings tab
        this.addSettingTab(new JDSettingsTab(this.app, this));

        // 4. File context menu (right click)
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle("Create jd item inside")
                            .setIcon("folder-plus")
                            .onClick(() => {
                                const nextJd = getNextAvailableJD(file);
                                new JDItemModal(this.app, this, nextJd || "").open();
                            });
                    });
                }
            })
        );

        // 5. Native "New folder" hijack
        this.registerDomEvent(activeDocument, 'click', (evt: MouseEvent) => {
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

        this.updateCleanViewClass();

        this.app.workspace.onLayoutReady(() => {
            this.startObserver();
        });
    }

    onunload() {
        this.stopObserver();
        activeDocument.body.classList.remove("jd-clean-view-active");
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<JDSettings> | null;
        this.settings = { ...DEFAULT_SETTINGS, ...loadedData };
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        this.updateCleanViewClass();
        this.updateRibbonIcons();
        
        // Re-process all nodes when settings change.
        this.stopObserver();
        this.startObserver();
    }

    updateRibbonIcons() {
        if (this.ribbonCreateEl && this.ribbonToggleEl) {
            this.ribbonCreateEl.toggleClass('jd-hidden', !this.settings.showRibbonIcons);
            this.ribbonToggleEl.toggleClass('jd-hidden', !this.settings.showRibbonIcons);
        }
    }

    updateCleanViewClass() {
        if (this.settings.cleanViewEnabled) {
            activeDocument.body.classList.add("jd-clean-view-active");
            if (this.ribbonToggleEl) setIcon(this.ribbonToggleEl, 'eye-off');
        } else {
            activeDocument.body.classList.remove("jd-clean-view-active");
            if (this.ribbonToggleEl) setIcon(this.ribbonToggleEl, 'eye');
        }
    }

    startObserver() {
        if (!this.observer) {
            this.observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.instanceOf(HTMLElement)) {
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

            this.observer.observe(activeDocument.body, { 
                childList: true, 
                subtree: true,
                characterData: true
            });
        }

        // Initial process
        activeDocument.querySelectorAll('.nav-folder-title-content, .nav-file-title-content').forEach(n => this.processNode(n as HTMLElement));
    }

    stopObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Restore original text
        activeDocument.querySelectorAll('[data-jd-processed="true"]').forEach(node => {
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

        // Check if it's an area range "10-19 ".
        const rangeMatch = text.match(/^(\d0)-(\d9)([\s_-])/);
        if (rangeMatch && parseInt(rangeMatch[1]) + 9 === parseInt(rangeMatch[2])) {
            originalPrefix = rangeMatch[0];
            const base = parseInt(rangeMatch[1]);
            const separator = rangeMatch[3];
            dynamicPrefix = this.settings.areaNamingStyle === 'single' ? `${base}${separator}` : originalPrefix;
            rest = text.substring(originalPrefix.length);
        } 
        
        if (!originalPrefix) {
            // Check if it's an area single "10 ", category "11 ", or item "11.01 ".
            const singleMatch = text.match(/^(\d{2}(\.\d{1,2})?)([\s_-])/);
            if (singleMatch) {
                originalPrefix = singleMatch[0];
                const numStr = singleMatch[1];
                const separator = singleMatch[3];
                
                const titleNode = node.closest('.nav-folder-title, .nav-file-title');
                const dataPath = titleNode?.getAttribute('data-path') || "";
                const isRoot = dataPath !== "" && !dataPath.includes('/');

                // If it's a multiple of 10 without a decimal and it's at the vault root, it's an area.
                if (/^\d0$/.test(numStr) && isRoot) {
                    const base = parseInt(numStr);
                    dynamicPrefix = this.settings.areaNamingStyle === 'range' ? `${base}-${base+9}${separator}` : originalPrefix;
                } else {
                    // Category or item.
                    dynamicPrefix = originalPrefix; 
                }
                rest = text.substring(originalPrefix.length);
            }
        }

        if (originalPrefix) {
            node.setAttribute('data-jd-processed', 'true');
            node.setAttribute('data-jd-original-text', text);
            
            node.textContent = '';
            
            const span = createSpan();
            span.classList.add('jd-prefix-mask');
            span.textContent = dynamicPrefix;
            
            node.appendChild(span);
            node.appendChild(activeDocument.createTextNode(rest));
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
        const infoEl = containerEl.createDiv({ cls: "jd-settings-info setting-item-description" });
        infoEl.createEl("p", { text: "Johnny.decimal gives everything a permanent address by breaking your structure into 10 areas, and each area into 10 categories." });

        const listEl = infoEl.createEl("ul");
        listEl.createEl("li", { text: "Area 10-19: finance" });
        listEl.createEl("li", { text: "Category 11: tax" });
        listEl.createEl("li", { text: "ID 11.01: tax returns 2024" });

        new Setting(containerEl)
            .setName('Clean view')
            .setDesc('Visually hide the jd prefix in the file explorer.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.cleanViewEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.cleanViewEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Area naming style')
            .setDesc('Choose how area folders should be formatted and displayed.')
            .addDropdown(drop => drop
                .addOption('range', 'Range')
                .addOption('single', 'Single')
                .setValue(this.plugin.settings.areaNamingStyle)
                .onChange(async (value) => {
                    this.plugin.settings.areaNamingStyle = value as 'range' | 'single';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show ribbon icons')
            .setDesc('Display the quick-action icons in the left sidebar.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRibbonIcons)
                .onChange(async (value) => {
                    this.plugin.settings.showRibbonIcons = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Replace native "new folder" button')
            .setDesc('Diverts the default Obsidian file explorer "new folder" button to open the johnny.decimal creation modal instead.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replaceNativeNewFolder)
                .onChange(async (value) => {
                    this.plugin.settings.replaceNativeNewFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
