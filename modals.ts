import { App, Modal, Setting, TFolder, Notice, setIcon } from "obsidian";
import { parseJD, ParsedJD, createJDItem, getAreaPrefix, findAreaFolder, findCategoryFolder, findItem } from "./utils";
import type JohnnyDecimalPlugin from "./main";

function showError(msg: string) {
    const frag = createFragment();
    frag.createSpan({ text: msg, cls: 'jd-error-notice' });
    new Notice(frag);
}

export class JDItemModal extends Modal {
    plugin: JohnnyDecimalPlugin;
    jdId: string = "";
    itemName: string = "";
    itemType: 'folder' | 'file' = 'folder';
    private isCreating = false;

    constructor(app: App, plugin: JohnnyDecimalPlugin, defaultJdId: string = "") {
        super(app);
        this.plugin = plugin;
        this.jdId = defaultJdId;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: "Create new johnny.decimal item" });

        new Setting(contentEl)
            .setName("Type")
            .addDropdown(drop => drop
                .addOption('folder', 'Folder')
                .addOption('file', 'File')
                .setValue(this.itemType)
                .onChange(value => {
                    this.itemType = value as 'folder' | 'file';
                }));

        const jdNameFrag = createFragment();
        jdNameFrag.appendText("JD number ");
        const jdHelpSpan = jdNameFrag.createSpan({ cls: "jd-help-icon" });
        setIcon(jdHelpSpan, "help-circle");
        const jdHelpText = "The Johnny.Decimal number.\nFormat: Area (10-19), Category (11), or Item (11.01).\nExample: 11.01";
        jdHelpSpan.setAttribute("aria-label", jdHelpText);
        jdHelpSpan.addEventListener("click", () => new Notice(jdHelpText));

        new Setting(contentEl)
            .setName(jdNameFrag)
            .addText(text => text
                .setPlaceholder("Enter jd number")
                .setValue(this.jdId)
                .onChange(value => {
                    this.jdId = value.trim();
                }));

        const nameFrag = createFragment();
        nameFrag.appendText("Name ");
        const nameHelpSpan = nameFrag.createSpan({ cls: "jd-help-icon" });
        setIcon(nameHelpSpan, "help-circle");
        const nameHelpText = "The human-readable name of the item.\nFormat: any valid folder or file name.\nExample: tax returns 2024";
        nameHelpSpan.setAttribute("aria-label", nameHelpText);
        nameHelpSpan.addEventListener("click", () => new Notice(nameHelpText));

        new Setting(contentEl)
            .setName(nameFrag)
            .addText(text => text
                .setPlaceholder("Enter name")
                .onChange(value => {
                    this.itemName = value.trim();
                }));

        new Setting(contentEl)
            .addButton(btn => {
                btn
                    .setButtonText("Create")
                    .setCta()
                    .onClick(async () => {
                        if (this.isCreating) return;

                        this.isCreating = true;
                        btn.setDisabled(true);

                        try {
                            await this.handleCreate();
                        } catch (error) {
                            showError(error instanceof Error ? error.message : "Failed to create JD item.");
                        } finally {
                            this.isCreating = false;
                            btn.setDisabled(false);
                        }
                    });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    async handleCreate() {
        if (!this.jdId || !this.itemName) {
            showError("Validation error: both JD number and name fields are required.");
            return;
        }

        let parsed = parseJD(this.jdId);
        if (!parsed) {
            showError("Format error: please use a standard JD format (e.g., '10-19', '11', or '11.01').");
            return;
        }

        const vaultRoot = this.app.vault.getRoot();
        const areaPrefixRange = getAreaPrefix(parsed.logicalAreaBase);
        let existingAreaFolder = findAreaFolder(this.app, areaPrefixRange) ?? undefined;

        if (parsed.type === 'area' && /^\d0$/.test(this.jdId.trim()) && existingAreaFolder) {
            parsed = {
                type: 'category',
                logicalAreaBase: parsed.logicalAreaBase,
                categoryPrefix: this.jdId.trim(),
                itemId: null
            };
        }

        if (parsed.type === 'area') {
            if (existingAreaFolder) {
                showError("Conflict error: this area folder already exists in the vault.");
                return;
            }
            await createJDItem(this.app, vaultRoot, areaPrefixRange, this.itemName, 'folder');
            new Notice(`Created area: ${areaPrefixRange} ${this.itemName}`);
            this.close();
            return;
        }

        if (parsed.type === 'category' && parseInt(parsed.categoryPrefix!) % 10 === 0) {
            if (!existingAreaFolder) {
                showError(`Missing parent: the area folder (${areaPrefixRange}) must exist before creating an area management category.`);
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

            const existingCat = findCategoryFolder(existingAreaFolder, parsed.categoryPrefix!);
            if (existingCat) {
                showError("Conflict error: this category folder already exists within the area.");
                return;
            }
            
            await createJDItem(this.app, existingAreaFolder, parsed.categoryPrefix!, this.itemName, 'folder');
            new Notice(`Created category: ${parsed.categoryPrefix} ${this.itemName}`);
            this.close();
            return;
        }

        if (parsed.type === 'item') {
            if (!existingAreaFolder) {
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, true, true, areaPrefixRange).open();
                this.close();
                return;
            }

            const existingCatFolder = findCategoryFolder(existingAreaFolder, parsed.categoryPrefix!) ?? undefined;

            if (!existingCatFolder) {
                new MissingParentsModal(this.app, this.plugin, parsed, this.itemName, this.itemType, false, true, areaPrefixRange, existingAreaFolder).open();
                this.close();
                return;
            }

            const existingItem = findItem(existingCatFolder, parsed.itemId!);
            if (existingItem) {
                showError("Conflict error: this item ID already exists within the category.");
                return;
            }

            await createJDItem(this.app, existingCatFolder, parsed.itemId!, this.itemName, this.itemType);
            new Notice(`Created item: ${parsed.itemId} ${this.itemName}`);
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
    private isCreating = false;

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
        
        contentEl.createEl("h2", { text: "Missing parent folders" });
        contentEl.createEl("p", { text: "The required area or category folders do not exist. Please provide names for them." });

        if (this.missingArea) {
            new Setting(contentEl)
                .setName(`Area name [${this.areaPrefix}]`)
                .addText(text => text
                    .setPlaceholder("Enter area name")
                    .onChange(value => this.areaName = value.trim()));
        }

        if (this.missingCategory) {
            new Setting(contentEl)
                .setName(`Category name [${this.parsed.categoryPrefix}]`)
                .addText(text => text
                    .setPlaceholder("Enter category name")
                    .onChange(value => this.categoryName = value.trim()));
        }

        new Setting(contentEl)
            .addButton(btn => {
                btn
                    .setButtonText("Create all")
                    .setCta()
                    .onClick(async () => {
                        if (this.isCreating) return;

                        if (this.missingArea && !this.areaName) {
                            showError("Validation error: please provide a valid name for the missing area folder.");
                            return;
                        }
                        if (this.missingCategory && !this.categoryName) {
                            showError("Validation error: please provide a valid name for the missing category folder.");
                            return;
                        }

                        this.isCreating = true;
                        btn.setDisabled(true);

                        try {
                            await this.createAll();
                            this.close();
                        } catch (error) {
                            showError(error instanceof Error ? error.message : "Failed to create JD folders.");
                        } finally {
                            this.isCreating = false;
                            btn.setDisabled(false);
                        }
                    });
            });
    }

    async createAll() {
        const root = this.app.vault.getRoot();
        let currentArea = this.existingAreaFolder;
        
        if (this.missingArea) {
            const createdArea = await createJDItem(this.app, root, this.areaPrefix, this.areaName, 'folder');
            if (!(createdArea instanceof TFolder)) {
                throw new Error("Failed to create the area folder.");
            }
            currentArea = createdArea;
        }

        if (this.parsed.type === 'area') {
            return; 
        }

        let currentCategory: TFolder | null = null;
        
        if (this.parsed.type === 'category' && currentArea) {
            await createJDItem(this.app, currentArea, this.parsed.categoryPrefix!, this.finalItemName, 'folder');
            return;
        } else if (this.missingCategory && currentArea) {
            const createdCategory = await createJDItem(this.app, currentArea, this.parsed.categoryPrefix!, this.categoryName, 'folder');
            if (!(createdCategory instanceof TFolder)) {
                throw new Error("Failed to create the category folder.");
            }
            currentCategory = createdCategory;
        } else if (currentArea) {
            currentCategory = findCategoryFolder(currentArea, this.parsed.categoryPrefix!);
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
