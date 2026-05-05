import { App, TFolder, TAbstractFile, normalizePath } from "obsidian";

export interface ParsedJD {
    type: 'area' | 'category' | 'item';
    logicalAreaBase: number;
    categoryPrefix: string | null;
    itemId: string | null;
}

export function parseJD(jdId: string): ParsedJD | null {
    const cleaned = jdId.trim();
    
    // Check if it's explicitly an area: "10-19"
    const rangeMatch = cleaned.match(/^(\d0)-(\d9)$/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (end !== start + 9) return null;

        return { type: 'area', logicalAreaBase: start, categoryPrefix: null, itemId: null };
    }

    // Check if it's a single area: "10", "20"
    const singleMatch = cleaned.match(/^(\d)0$/);
    if (singleMatch) {
        return { type: 'area', logicalAreaBase: parseInt(singleMatch[1] + "0", 10), categoryPrefix: null, itemId: null };
    }

    // Check if it's an item: "11.01" or "10.01"
    const itemMatch = cleaned.match(/^(\d{2})\.(\d{1,2})$/);
    if (itemMatch) {
        const cat = itemMatch[1];
        const base = parseInt(cat[0] + "0", 10);
        const itemId = `${cat}.${itemMatch[2].padStart(2, '0')}`;
        return { type: 'item', logicalAreaBase: base, categoryPrefix: cat, itemId };
    }

    // Check if it's a category: "11", "12"
    const catMatch = cleaned.match(/^(\d{2})$/);
    if (catMatch) { // We already checked for X0 above
        const cat = catMatch[1];
        const base = parseInt(cat[0] + "0", 10);
        return { type: 'category', logicalAreaBase: base, categoryPrefix: cat, itemId: null };
    }

    return null;
}

export function getAreaPrefix(logicalAreaBase: number): string {
    const start = logicalAreaBase.toString().padStart(2, '0');
    const end = (logicalAreaBase + 9).toString().padStart(2, '0');
    return `${start}-${end}`;
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateVaultName(name: string): string {
    const cleaned = name.trim();

    if (!cleaned || cleaned === "." || cleaned === "..") {
        throw new Error("Name cannot be empty, '.' or '..'.");
    }

    if (/[\\/:*?"<>|]/.test(cleaned)) {
        throw new Error("Name contains characters that are not safe for file or folder names.");
    }

    return cleaned;
}

export function findAreaFolder(app: App, areaPrefix: string): TFolder | null {
    const root = app.vault.getRoot();
    const baseStr = areaPrefix.substring(0, 2); // e.g., "10"
    
    for (const folder of root.children) {
        if (folder instanceof TFolder) {
            const regex = new RegExp(`^(${escapeRegExp(areaPrefix)}|${escapeRegExp(baseStr)})([\\s_-]|$)`);
            if (regex.test(folder.name)) {
                return folder;
            }
        }
    }
    return null;
}

export function findCategoryFolder(areaFolder: TFolder, categoryPrefix: string): TFolder | null {
    for (const folder of areaFolder.children) {
        if (folder instanceof TFolder) {
            const regex = new RegExp(`^${escapeRegExp(categoryPrefix)}([^0-9]|$)`);
            if (regex.test(folder.name)) {
                return folder;
            }
        }
    }
    return null;
}

export function findItem(parent: TFolder, itemId: string): TAbstractFile | null {
    for (const file of parent.children) {
        const regex = new RegExp(`^${escapeRegExp(itemId)}([^0-9]|$)`);
        if (regex.test(file.name)) {
            return file;
        }
    }
    return null;
}

export async function createJDItem(app: App, parent: TFolder, prefix: string, name: string, type: 'folder' | 'file'): Promise<TAbstractFile> {
    const safeName = name ? validateVaultName(name) : "";
    const itemName = safeName ? `${prefix} ${safeName}` : prefix;
    if (type === 'folder') {
        const path = normalizePath(`${parent.path}/${itemName}`);
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) return existing;

        return await app.vault.createFolder(path);
    } else {
        const path = normalizePath(`${parent.path}/${itemName}.md`);
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) return existing;

        return await app.vault.create(path, '');
    }
}

export function extractJDPrefix(folderName: string): string | null {
    const rangeMatch = folderName.match(/^(\d0)-(\d9)(?=[\s_-]|$)/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (end === start + 9) return `${rangeMatch[1]}-${rangeMatch[2]}`;
    }
    
    const itemMatch = folderName.match(/^(\d{2}\.\d{1,2})(?=[\s_-]|$)/);
    if (itemMatch) return itemMatch[1];
    
    const singleMatch = folderName.match(/^(\d{2})(?=[\s_-]|$)/);
    if (singleMatch) return singleMatch[1];

    return null;
}

export function getNextAvailableJD(folder: TFolder): string | null {
    const prefix = extractJDPrefix(folder.name);
    if (!prefix) return null;
    
    const parsedFolder = parseJD(prefix);
    if (!parsedFolder) return null;

    const isRoot = folder.parent?.isRoot();
    if (parsedFolder.type === 'area' && !isRoot) {
        parsedFolder.type = 'category';
        parsedFolder.categoryPrefix = prefix;
    }

    if (parsedFolder.type === 'area') {
        const base = parsedFolder.logicalAreaBase;
        let maxCat = 0;
        
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                const childPrefix = extractJDPrefix(child.name);
                if (childPrefix) {
                    const childParsed = parseJD(childPrefix);
                    if (childParsed) {
                        if (childParsed.type === 'area' && childPrefix.length === 2) {
                            childParsed.type = 'category';
                            childParsed.categoryPrefix = childPrefix;
                        }
                        
                        if (childParsed.type === 'category' && childParsed.logicalAreaBase === base) {
                            const catNum = parseInt(childParsed.categoryPrefix || "0");
                            const offset = catNum - base;
                            if (offset > maxCat && offset <= 9) {
                                maxCat = offset;
                            }
                        }
                    }
                }
            }
        }
        
        const nextCat = base + maxCat + 1;
        if (nextCat < base + 10) {
            return nextCat.toString().padStart(2, '0');
        }
        return null;
    }
    
    if (parsedFolder.type === 'category') {
        let maxItem = 0;
        for (const child of folder.children) {
            const childPrefix = extractJDPrefix(child.name);
            if (childPrefix) {
                const childParsed = parseJD(childPrefix);
                if (childParsed && childParsed.type === 'item' && childParsed.categoryPrefix === parsedFolder.categoryPrefix) {
                    const parts = childParsed.itemId?.split('.') || [];
                    if (parts.length === 2) {
                        const dec = parseInt(parts[1], 10);
                        if (dec > maxItem) {
                            maxItem = dec;
                        }
                    }
                }
            }
        }
        
        const nextItem = maxItem + 1;
        if (nextItem > 99) return null;

        return `${parsedFolder.categoryPrefix}.${nextItem.toString().padStart(2, '0')}`;
    }

    return null;
}
