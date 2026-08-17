/**
 * The `rdk-skills` provider: registers every skill found in the configured
 * directories (vendored packs first, user `skillsDirs` on top) into the
 * harness-native `ctx.skills` registry so they appear in the session skill
 * catalog and load through the built-in `skill` tool.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkillMarkdown } from './frontmatter.js';
export const PROVIDER_NAME = 'rdk-skills';
export const DEFAULT_RANK = 300;
export const defaultVendorDir = () => fileURLToPath(new URL('../skills', import.meta.url));
function stamp() {
    return new Date().toISOString();
}
async function isDirectory(path) {
    try {
        return (await stat(path)).isDirectory();
    }
    catch {
        return false;
    }
}
/** Sorted names of the skill-pack directories directly under a root. */
async function listVendorPackNames(root) {
    try {
        const entries = await readdir(root, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name)
            .sort();
    }
    catch {
        return [];
    }
}
async function readTextAt(path) {
    try {
        return await readFile(path, 'utf8');
    }
    catch {
        return undefined;
    }
}
async function walk(dir, depth, pack, out, skipDirs) {
    if (depth > 6)
        return;
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        out.errors.push(`${dir}: ${error.message}`);
        return;
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue;
        if (skipDirs !== undefined && skipDirs.has(entry.name))
            continue;
        const childDir = join(dir, entry.name);
        const mdPath = join(childDir, 'SKILL.md');
        const md = await readTextAt(mdPath);
        if (md !== undefined) {
            const parsed = parseSkillMarkdown(md);
            if (parsed !== undefined && !out.byName.has(parsed.name)) {
                const skill = { ...parsed, pack, dir: childDir, path: mdPath };
                out.byName.set(parsed.name, skill);
                out.skills.push(skill);
            }
        }
        await walk(childDir, depth + 1, pack, out, skipDirs);
    }
}
/** The OE packs are their own upstream repos; the hub merely mirrors them. */
const isOePack = (name) => name === 'oe-skills-x5' || name === 'oe-skills-s';
async function scan(options, index) {
    const vendorDir = options.vendorDir ?? defaultVendorDir();
    const roots = [];
    options.skillsDirs.forEach((dir, i) => {
        roots.push({ pack: `external-${i + 1}`, dir });
    });
    // Every directory under the vendor root is a skill pack. Scan order decides
    // duplicate precedence: device pack first, then additional packs
    // (bsp-skills, ...), then the dedicated OE packs (gated by includeOe), and
    // the hub last so its mirrors of any pack lose to the dedicated source.
    const vendorPackNames = await listVendorPackNames(vendorDir);
    const device = vendorPackNames.filter((n) => n === 'rdk-device-skills');
    const hub = vendorPackNames.filter((n) => n === 'rdk-skills');
    const oe = vendorPackNames.filter(isOePack);
    const others = vendorPackNames.filter((n) => n !== 'rdk-device-skills' && n !== 'rdk-skills' && !isOePack(n));
    const oePresent = new Set(oe);
    const hubSkip = new Set();
    if (!options.includeOe || oePresent.has('oe-skills-x5'))
        hubSkip.add('oe-skills-x5');
    if (!options.includeOe || oePresent.has('oe-skills-s'))
        hubSkip.add('oe-skills-s');
    for (const pack of [...device, ...others, ...(options.includeOe ? oe : []), ...hub]) {
        roots.push({
            pack,
            dir: join(vendorDir, pack),
            ...(pack === 'rdk-skills' && hubSkip.size > 0 ? { skipDirs: hubSkip } : {}),
        });
    }
    const stats = [];
    for (const root of roots) {
        const local = { skills: [], byName: new Map(), errors: [] };
        if (await isDirectory(root.dir)) {
            await walk(root.dir, 0, root.pack, local, root.skipDirs);
        }
        else {
            local.errors.push(`${root.dir}: directory not found`);
        }
        for (const skill of local.skills) {
            if (!index.byName.has(skill.name)) {
                index.byName.set(skill.name, skill);
                index.skills.push(skill);
            }
        }
        index.stats.errors.push(...local.errors);
        stats.push({ pack: root.pack, dir: root.dir, found: local.skills.length });
    }
    index.stats.roots = stats;
    index.scannedAt = stamp();
}
function candidateOf(skill) {
    return {
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'custom',
        provider: PROVIDER_NAME,
        rank: DEFAULT_RANK,
        locator: { path: skill.path, dir: skill.dir, pack: skill.pack },
        path: skill.path,
        metadata: {
            ...(skill.version !== undefined ? { version: skill.version } : {}),
            ...(skill.tags.length > 0 ? { tags: skill.tags } : {}),
            pack: skill.pack,
        },
    };
}
/**
 * Mount the skill provider + index for this plugin. Returns a handle the tool
 * layer uses, or `undefined` when the skills service is unavailable.
 */
export function mountRdkSkills(skills, options) {
    const index = { skills: [], byName: new Map(), stats: { roots: [], errors: [] }, scannedAt: null };
    let scanPromise = null;
    const scanAll = (force) => {
        if (force) {
            // Drain the in-flight scan, then clear and rescan.
            // Replace scanPromise immediately so concurrent non-force callers
            // attach to this chain instead of the old scan.
            const drain = scanPromise !== null ? scanPromise.catch(() => { }) : Promise.resolve();
            scanPromise = drain.then(() => {
                index.skills = [];
                index.byName = new Map();
                index.stats = { roots: [], errors: [] };
                index.scannedAt = null;
                return scan(options, index);
            }).finally(() => {
                scanPromise = null;
            });
            return scanPromise.then(() => index);
        }
        if (index.scannedAt !== null)
            return Promise.resolve(index);
        if (scanPromise === null) {
            scanPromise = scan(options, index).finally(() => {
                scanPromise = null;
            });
        }
        return scanPromise.then(() => index);
    };
    const dispose = skills.registerProvider((control) => ({
        name: PROVIDER_NAME,
        async list() {
            await scanAll(false);
            return index.skills.map(candidateOf);
        },
        async get(candidate) {
            const locator = candidate.locator;
            if (locator === undefined || typeof locator.path !== 'string')
                return undefined;
            const raw = await readTextAt(locator.path);
            if (raw === undefined)
                return undefined;
            const parsed = parseSkillMarkdown(raw);
            if (parsed === undefined)
                return undefined;
            return {
                name: parsed.name,
                description: parsed.description,
                ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
                invocation: { modelInvocable: true, userInvocable: true },
                source: 'custom',
                provider: PROVIDER_NAME,
                resourceBase: { kind: 'directory', path: typeof locator.dir === 'string' ? locator.dir : dirname(locator.path) },
                path: locator.path,
                metadata: {
                    ...(parsed.version !== undefined ? { version: parsed.version } : {}),
                    ...(parsed.tags.length > 0 ? { tags: parsed.tags } : {}),
                    pack: typeof locator.pack === 'string' ? locator.pack : 'rdk',
                },
                content: parsed.body,
            };
        },
    }));
    const pick = (skill) => ({
        name: skill.name,
        description: skill.description,
        pack: skill.pack,
        ...(skill.version !== undefined ? { version: skill.version } : {}),
        ...(skill.tags.length > 0 ? { tags: skill.tags } : {}),
        dir: skill.dir,
    });
    const listSkillFiles = async (dir) => {
        const result = { files: [], scripts: [] };
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && /\.(sh|py|md|json|ya?ml)$/i.test(entry.name))
                    result.files.push(entry.name);
            }
        }
        catch {
            /* skill dir may be gone */
        }
        try {
            const entries = await readdir(join(dir, 'scripts'), { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile())
                    result.scripts.push(`scripts/${entry.name}`);
            }
        }
        catch {
            /* no scripts dir */
        }
        return result;
    };
    return {
        scanAll,
        dispose,
        listSkillFiles,
        async summary() {
            const idx = await scanAll(false);
            return {
                provider: PROVIDER_NAME,
                scannedAt: idx.scannedAt,
                count: idx.skills.length,
                roots: idx.stats.roots,
                errors: idx.stats.errors.slice(0, 20),
                skills: idx.skills.map(pick),
            };
        },
        async detail(name) {
            const idx = await scanAll(false);
            const skill = idx.byName.get(name);
            if (skill === undefined)
                return { error: `unknown skill: ${name}` };
            const files = await listSkillFiles(skill.dir);
            return {
                ...pick(skill),
                path: skill.path,
                files: files.files,
                scripts: files.scripts,
                ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
            };
        },
    };
}
//# sourceMappingURL=skill-provider.js.map