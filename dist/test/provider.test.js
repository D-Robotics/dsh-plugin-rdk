import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mountRdkSkills } from '../skill-provider.js';
const SKILL = (name, description, extra = '') => `---\nname: ${name}\ndescription: ${description}\n${extra}---\n# ${name}\n\nBody of ${name}.\n`;
/** Minimal skills-registry stub: mountRdkSkills only reads registerProvider. */
const stubSkills = () => ({ registerProvider: () => () => { } });
async function buildFixture() {
    const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-rdk-'));
    const device = join(root, 'rdk-device-skills');
    const hub = join(root, 'rdk-skills');
    const bsp = join(root, 'bsp-skills');
    const oeX5 = join(root, 'oe-skills-x5');
    const oeS = join(root, 'oe-skills-s');
    // ── rdk-device-skills ──
    await mkdir(join(device, 'alpha'), { recursive: true });
    await writeFile(join(device, 'alpha', 'SKILL.md'), SKILL('test-alpha', 'Alpha skill', 'version: 0.1.0\nmetadata:\n  tags:\n    - a\n'));
    await mkdir(join(device, 'shared'), { recursive: true });
    await writeFile(join(device, 'shared', 'SKILL.md'), SKILL('test-shared', 'Shared skill from device pack'));
    await mkdir(join(device, 'nested', 'deeper'), { recursive: true });
    await writeFile(join(device, 'nested', 'deeper', 'SKILL.md'), SKILL('test-nested', 'Nested skill'));
    await writeFile(join(device, 'alpha', 'not-a-skill.txt'), 'ignored');
    // ── bsp-skills ──
    await mkdir(join(bsp, 'bsp-env-setup'), { recursive: true });
    await writeFile(join(bsp, 'bsp-env-setup', 'SKILL.md'), SKILL('test-bsp-env', 'BSP env skill'));
    await mkdir(join(bsp, 'bsp-image-build'), { recursive: true });
    await writeFile(join(bsp, 'bsp-image-build', 'SKILL.md'), SKILL('test-bsp-image', 'BSP image skill'));
    // ── oe-skills-x5 (dedicated repo) ──
    await mkdir(join(oeX5, 'x5-ptq-compile'), { recursive: true });
    await writeFile(join(oeX5, 'x5-ptq-compile', 'SKILL.md'), SKILL('test-x5-skill', 'X5 skill from dedicated pack'));
    // ── oe-skills-s (dedicated repo) ──
    await mkdir(join(oeS, 'hbdk-manual'), { recursive: true });
    await writeFile(join(oeS, 'hbdk-manual', 'SKILL.md'), SKILL('test-s-skill', 'S-series skill from dedicated pack'));
    // ── rdk-skills hub (mirrors of every pack + hub-native) ──
    await mkdir(join(hub, 'shared'), { recursive: true });
    await writeFile(join(hub, 'shared', 'SKILL.md'), SKILL('test-shared', 'Shared skill from hub pack'));
    await mkdir(join(hub, 'beta'), { recursive: true });
    await writeFile(join(hub, 'beta', 'SKILL.md'), SKILL('test-beta', 'Beta skill'));
    // hub-native content nested under a non-pack dir — should always be scanned
    await mkdir(join(hub, 'oe', 'deep', 'nested'), { recursive: true });
    await writeFile(join(hub, 'oe', 'deep', 'nested', 'SKILL.md'), SKILL('test-oe-nested', 'OE nested skill'));
    // mirror of oe-skills-x5 — must be skipped when the dedicated pack is vendored
    await mkdir(join(hub, 'oe-skills-x5', 'mirror'), { recursive: true });
    await writeFile(join(hub, 'oe-skills-x5', 'mirror', 'SKILL.md'), SKILL('test-x5-skill', 'X5 skill from hub mirror'));
    // mirror of oe-skills-s — must be skipped when the dedicated pack is vendored
    await mkdir(join(hub, 'oe-skills-s', 'mirror'), { recursive: true });
    await writeFile(join(hub, 'oe-skills-s', 'mirror', 'SKILL.md'), SKILL('test-s-skill', 'S-series skill from hub mirror'));
    return root;
}
test('includeOe: true — dedicated OE packs win, hub mirrors are skipped', async () => {
    const root = await buildFixture();
    try {
        const handle = mountRdkSkills(stubSkills(), { skillsDirs: [], includeOe: true, vendorDir: root });
        const idx = await handle.scanAll(false);
        assert.deepEqual([...idx.skills.map((s) => s.name)].sort(), [
            'test-alpha',
            'test-beta',
            'test-bsp-env',
            'test-bsp-image',
            'test-nested',
            'test-oe-nested',
            'test-s-skill',
            'test-shared',
            'test-x5-skill',
        ]);
        assert.equal(idx.byName.get('test-shared')?.description, 'Shared skill from device pack');
        assert.equal(idx.byName.get('test-x5-skill')?.description, 'X5 skill from dedicated pack');
        assert.equal(idx.byName.get('test-s-skill')?.description, 'S-series skill from dedicated pack');
        assert.equal(idx.stats.errors.length, 0);
        assert.deepEqual(idx.stats.roots.map((r) => [r.pack, r.found]), [
            ['rdk-device-skills', 3],
            ['bsp-skills', 2],
            ['oe-skills-s', 1],
            ['oe-skills-x5', 1],
            ['rdk-skills', 3], // shared, beta, oe-nested (oe-skills-x5 and oe-skills-s subdirs skipped)
        ]);
        handle.dispose();
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test('includeOe: false — OE packs dropped entirely (dedicated and hub mirrors)', async () => {
    const root = await buildFixture();
    try {
        const handle = mountRdkSkills(stubSkills(), { skillsDirs: [], includeOe: false, vendorDir: root });
        const idx = await handle.scanAll(false);
        assert.deepEqual([...idx.skills.map((s) => s.name)].sort(), [
            'test-alpha',
            'test-beta',
            'test-bsp-env',
            'test-bsp-image',
            'test-nested',
            'test-oe-nested',
            'test-shared',
        ]);
        assert.equal(idx.byName.get('test-x5-skill'), undefined);
        assert.equal(idx.byName.get('test-s-skill'), undefined);
        assert.deepEqual(idx.stats.roots.map((r) => [r.pack, r.found]), [
            ['rdk-device-skills', 3],
            ['bsp-skills', 2],
            ['rdk-skills', 3], // oe-skills-x5 and oe-skills-s subdirs skipped
        ]);
        handle.dispose();
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test('external skillsDirs are scanned first and win duplicates', async () => {
    const root = await buildFixture();
    const extra = await mkdtemp(join(tmpdir(), 'dsh-plugin-rdk-extra-'));
    try {
        await mkdir(join(extra, 'shared'), { recursive: true });
        await writeFile(join(extra, 'shared', 'SKILL.md'), SKILL('test-shared', 'Shared skill from external dir'));
        await mkdir(join(extra, 'gamma'), { recursive: true });
        await writeFile(join(extra, 'gamma', 'SKILL.md'), SKILL('test-gamma', 'Gamma skill'));
        const handle = mountRdkSkills(stubSkills(), { skillsDirs: [extra], includeOe: true, vendorDir: root });
        const idx = await handle.scanAll(false);
        assert.equal(idx.byName.get('test-shared')?.description, 'Shared skill from external dir');
        assert.ok(idx.skills.some((s) => s.name === 'test-gamma'));
        assert.equal(idx.stats.roots[0].pack, 'external-1');
        handle.dispose();
    }
    finally {
        await rm(root, { recursive: true, force: true });
        await rm(extra, { recursive: true, force: true });
    }
});
test('detail lists skill files and scripts', async () => {
    const root = await buildFixture();
    try {
        await mkdir(join(root, 'rdk-device-skills', 'alpha', 'scripts'), { recursive: true });
        await writeFile(join(root, 'rdk-device-skills', 'alpha', 'scripts', 'run.sh'), '#!/bin/bash\necho hi\n');
        const handle = mountRdkSkills(stubSkills(), { skillsDirs: [], includeOe: true, vendorDir: root });
        const detail = await handle.detail('test-alpha');
        assert.equal(detail.name, 'test-alpha');
        assert.ok(Array.isArray(detail.scripts) && detail.scripts.includes('scripts/run.sh'));
        assert.ok(!('error' in detail));
        const missing = await handle.detail('test-nope');
        assert.ok('error' in missing);
        handle.dispose();
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=provider.test.js.map