import { App, Modal, Setting, TFolder, Notice, setIcon } from "obsidian";
import { parseJD, ParsedJD, createJDItem, getAreaPrefix } from "./utils";
import type JohnnyDecimalPlugin from "./main";

function showError(msg: string) {
    const frag = document.createDocumentFragment();
    const span = frag.createEl('span', { text: msg });
    span.style.color = "var(--text-error)";
    span.style.fontWeight = "500";
    new Notice(frag);
}

export class JDItemModal extends Modal {
    plugin: JohnnyDecimalPlugin;
    jdId: string = "";
    itemName: string = "";
    itemType: 'folder' | 'file' = 'folder';

    constructor(app: App, plugin: JohnnyDecimalPlugin, defaultJdId: string = "") {
        super(app);
        this.plugin = plugin;
        this.jdId = defaultJdId;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: "Create New Johnny.Decimal Item" });

        new Setting(contentEl)
            .setName("Type")
            .addDropdown(drop => drop
                .addOption('folder', 'Folder')
                .addOption('file', 'File')
                .setValue(this.itemType)
                .onChange(value => {
                    this.itemType = value as 'folder' | 'file';
                }));

        const jdNameFrag = document.createDocumentFragment();
        jdNameFrag.appendText("JD Number ");
        const jdHelpSpan = jdNameFrag.createEl("span", { cls: "jd-help-icon" });
        jdHelpSpan.style.cursor = "help";
        jdHelpSpan.style.opacity = "0.7";
        setIcon(jdHelpSpan, "help-circle");
        const jdHelpText = "The Johnny.Decimal number.\nFormat: Area (10-19), Category (11), or Item (11.01).\nExample: 11.01";
        jdHelpSpan.setAttribute("aria-label", jdHelpText);
        jdHelpSpan.addEventListener("click", () => new Notice(jdHelpText));

        new Setting(contentEl)
            .setName(jdNameFrag)
            .addText(text => text
                .setPlaceholder("Enter JD Number")
                .setValue(this.jdId)
                .onChange(value => {
                    this.jdId = value.trim();
                }));

        const nameFrag = document.createDocumentFragment();
        nameFrag.appendText("Name ");
        const nameHelpSpan = nameFrag.createEl("span", { cls: "jd-help-icon" });
        nameHelpSpan.style.cursor = "help";
        nameHelpSpan.style.opacity = "0.7";
        setIcon(nameHelpSpan, "help-circle");
        const nameHelpText = "The human-readable name of the item.\nFormat: Any valid folder or file name.\nExample: Tax Returns 2024";
        nameHelpSpan.setAttribute("aria-label", nameHelpText);
        nameHelpSpan.addEventListener("click", () => new Notice(nameHelpText));

        new Setting(contentEl)
            .setName(nameFrag)
            .addText(text => text
                .setPlaceholder("Enter Name")
                .onChange(value => {
                    this.itemName = value.trim();
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Create")
                .setCta()
                .onClick(() => {
                    this.handleCreate();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    async handleCreate() {
        if (!this.jdId || !this.itemName) {
            showError("Validation Error: Both JD Number and Name fields are required.");
            return;
        }

        const parsed = parseJD(this.jdId);
        if (!parsed) {
            showError("Format Error: Please use a standard JD format (e.g., '10-19', '11', or '11.01').");
            return;
        }

        const vaultRoot = this.app.vault.getRoot();
        const areaPrefixRange = getAreaPrefix(parsed.logicalAreaBase);
        const areaRegex = new RegExp(`^${areaPrefixRange}(?:[\\s_\\-]|$)`);
        
        let existingAreaFolder = vaultRoot.children.find(c => c instanceof TFolder && areaRegex.test(c.name)) as TFolder | undefined;

        if (parsed.type === 'area') {
            if (existingAreaFolder) {
                showError("Conflict Error: This Area folder already exists in the vault.");
                return;
            }
            await createJDItem(this.app, vaultRoot, areaPrefixRange, this.itemName, 'folder');
            new Notice(`Created Area: ${areaPrefixRange} ${this.itemName}`);
            this.close();
            return;
        }

        if (parsed.type === 'category' && parseInt(parsed.categoryPrefix!) % 10 === 0) {
            if (!existingAreaFolder) {
                showError(`Missing Parent: The Area folder (${areaPrefixRange}) must exist before creating an Area Management category.`);
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, true, false, areaPrefixRange).open();
                this.close();
                return;
            }
        }

        if (parsed.type === 'category') {
            if (!existingAreaFolder) {
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, true, false, areaPrefixRange).open();
                this.close();
                return;
            }

            const catRegex = new RegExp(`^${parsed.categoryPrefix}(?:[\\s_\\-]|$)`);
            const existingCat = existingAreaFolder.children.find(c => c instanceof TFolder && catRegex.test(c.name)) as TFolder | undefined;
            if (existingCat) {
                showError("Conflict Error: This Category folder already exists within the Area.");
                return;
            }
            
            await createJDItem(this.app, existingAreaFolder, parsed.categoryPrefix!, this.itemName, 'folder');
            new Notice(`Created Category: ${parsed.categoryPrefix} ${this.itemName}`);
            this.close();
            return;
        }

        if (parsed.type === 'item') {
            if (!existingAreaFolder) {
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, true, true, areaPrefixRange).open();
                this.close();
                return;
            }

            const catRegex = new RegExp(`^${parsed.categoryPrefix}(?:[\\s_\\-]|$)`);
            const existingCatFolder = existingAreaFolder.children.find(c => c instanceof TFolder && catRegex.test(c.name)) as TFolder | undefined;

            if (!existingCatFolder) {
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, false, true, areaPrefixRange, existingAreaFolder).open();
                this.close();
                return;
            }

            const itemRegex = new RegExp(`^${parsed.itemId}(?:[\\s_\\-]|$)`);
            const existingItem = existingCatFolder.children.find(c => itemRegex.test(c.name));
            if (existingItem) {
                showError("Conflict Error: This Item ID already exists within the Category.");
                return;
            }

            await createJDItem(this.app, existingCatFolder, parsed.itemId!, this.itemName, this.itemType);
            new Notice(`Created Item: ${parsed.itemId} ${this.itemName}`);
            this.close();
        }
    }
}

export class MissingParentsModal extends Modal {
    plugin: JohnnyDecimalPlugin;
    parsed: ParsedJD;
    finalItemName: string;
    finalItemType: 'folder' | 'file';
    missingArea: boolean;
    missingCategory: boolean;
    areaPrefix: string;
    existingAreaFolder?: TFolder;

    areaName: string = "";
    categoryName: string = "";

    constructor(
        app: App, plugin: JohnnyDecimalPlugin, parsed: ParsedJD,
        finalItemName: string, finalItemType: 'folder' | 'file',
        missingArea: boolean, missingCategory: boolean,
        areaPrefix: string, existingAreaFolder?: TFolder
    ) {
        super(app);
        this.plugin = plugin;
        this.parsed = parsed;
        this.finalItemName = finalItemName;
        this.finalItemType = finalItemType;
        this.missingArea = missingArea;
        this.missingCategory = missingCategory;
        this.areaPrefix = areaPrefix;
        this.existingAreaFolder = existingAreaFolder;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: "Missing Parent Folders" });
        contentEl.createEl("p", { text: "The required Area or Category folders do not exist. Please provide names for them." });

        if (this.missingArea) {
            new Setting(contentEl)
                .setName(`Area Name [${this.areaPrefix}]`)
                .addText(text => text
                    .setPlaceholder("Enter area name")
                    .onChange(value => this.areaName = value.trim()));
        }

        if (this.missingCategory) {
            new Setting(contentEl)
                .setName(`Category Name [${this.parsed.categoryPrefix}]`)
                .addText(text => text
                    .setPlaceholder("Enter category name")
                    .onChange(value => this.categoryName = value.trim()));
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Create All")
                .setCta()
                .onClick(async () => {
                    if (this.missingArea && !this.areaName) {
                        showError("Validation Error: Please provide a valid name for the missing Area folder.");
                        return;
                    }
                    if (this.missingCategory && !this.categoryName) {
                        showError("Validation Error: Please provide a valid name for the missing Category folder.");
                        return;
                    }
                    
                    await this.createAll();
                    this.close();
                }));
    }

    async createAll() {
        const root = this.app.vault.getRoot();
        let currentArea = this.existingAreaFolder;
        
        if (this.missingArea) {
            currentArea = await createJDItem(this.app, root, this.areaPrefix, this.areaName, 'folder') as TFolder;
        }

        if (this.parsed.type === 'area') {
            return; 
        }

        let currentCategory: TFolder | null = null;
        
        if (this.parsed.type === 'category' && currentArea) {
            await createJDItem(this.app, currentArea, this.parsed.categoryPrefix!, this.finalItemName, 'folder');
            return;
        } else if (this.missingCategory && currentArea) {
            currentCategory = await createJDItem(this.app, currentArea, this.parsed.categoryPrefix!, this.categoryName, 'folder') as TFolder;
        } else if (currentArea) {
            const catRegex = new RegExp(`^${this.parsed.categoryPrefix}(?:[\\s_\\-]|$)`);
            currentCategory = currentArea.children.find(c => c instanceof TFolder && catRegex.test(c.name)) as TFolder | null;
        }

        if (this.parsed.type === 'item' && currentCategory) {
            await createJDItem(this.app, currentCategory, this.parsed.itemId!, this.finalItemName, this.finalItemType);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
