import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mountRdkSkills } from '../skill-provider.js';
const SKILL = (name, description, extra = '') => `---\nname: ${name}\ndescription: ${description}\n${extra}---\n# ${name}\n\nBody of ${name}.\n`;
/** Minimal context stub: mountRdkSkills only reads ctx.skills.registerProvider. */
const stubCtx = () => ({ skills: { registerProvider: () => () => { } } });
async function buildFixture() {
    const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-rdk-'));
    const device = join(root, 'rdk-device-skills');
    const hub = join(root, 'rdk-skills');
    await mkdir(join(device, 'alpha'), { recursive: true });
    await writeFile(join(device, 'alpha', 'SKILL.md'), SKILL('test-alpha', 'Alpha skill', 'version: 0.1.0\nmetadata:\n  tags:\n    - a\n'));
    await mkdir(join(device, 'shared'), { recursive: true });
    await writeFile(join(device, 'shared', 'SKILL.md'), SKILL('test-shared', 'Shared skill from device pack'));
    await mkdir(join(device, 'nested', 'deeper'), { recursive: true });
    await writeFile(join(device, 'nested', 'deeper', 'SKILL.md'), SKILL('test-nested', 'Nested skill'));
    await writeFile(join(device, 'alpha', 'not-a-skill.txt'), 'ignored');
    await mkdir(join(hub, 'shared'), { recursive: true });
    await writeFile(join(hub, 'shared', 'SKILL.md'), SKILL('test-shared', 'Shared skill from hub pack'));
    await mkdir(join(hub, 'beta'), { recursive: true });
    await writeFile(join(hub, 'beta', 'SKILL.md'), SKILL('test-beta', 'Beta skill'));
    await mkdir(join(hub, 'oe', 'deep', 'nested'), { recursive: true });
    await writeFile(join(hub, 'oe', 'deep', 'nested', 'SKILL.md'), SKILL('test-oe-nested', 'OE nested skill'));
    const bsp = join(root, 'bsp-skills');
    await mkdir(join(bsp, 'bsp-env-setup'), { recursive: true });
    await writeFile(join(bsp, 'bsp-env-setup', 'SKILL.md'), SKILL('test-bsp-env', 'BSP env skill'));
    await mkdir(join(bsp, 'bsp-image-build'), { recursive: true });
    await writeFile(join(bsp, 'bsp-image-build', 'SKILL.md'), SKILL('test-bsp-image', 'BSP image skill'));
    return root;
}
test('scans both packs, dedupes by name with device pack winning', async () => {
    const root = await buildFixture();
    try {
        const handle = mountRdkSkills(stubCtx(), { skillsDirs: [], includeOe: true, vendorDir: root });
        if (handle === undefined)
            assert.fail('mountRdkSkills returned undefined');
        const idx = await handle.scanAll(false);
        assert.deepEqual([...idx.skills.map((s) => s.name)].sort(), ['test-alpha', 'test-beta', 'test-bsp-env', 'test-bsp-image', 'test-nested', 'test-oe-nested', 'test-shared']);
        assert.equal(idx.byName.get('test-shared')?.description, 'Shared skill from device pack');
        assert.equal(idx.stats.errors.length, 0);
        assert.deepEqual(idx.stats.roots.map((r) => [r.pack, r.found]), [
            ['rdk-device-skills', 3],
            ['bsp-skills', 2],
            ['rdk-skills', 3],
        ]);
        handle.dispose();
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test('includeOe: false drops the OE hub pack but keeps other packs', async () => {
    const root = await buildFixture();
    try {
        const handle = mountRdkSkills(stubCtx(), { skillsDirs: [], includeOe: false, vendorDir: root });
        if (handle === undefined)
            assert.fail('mountRdkSkills returned undefined');
        const idx = await handle.scanAll(false);
        assert.deepEqual([...idx.skills.map((s) => s.name)].sort(), ['test-alpha', 'test-bsp-env', 'test-bsp-image', 'test-nested', 'test-shared']);
        assert.deepEqual(idx.stats.roots.map((r) => r.pack), ['rdk-device-skills', 'bsp-skills']);
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
        const handle = mountRdkSkills(stubCtx(), { skillsDirs: [extra], includeOe: true, vendorDir: root });
        if (handle === undefined)
            assert.fail('mountRdkSkills returned undefined');
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
        const handle = mountRdkSkills(stubCtx(), { skillsDirs: [], includeOe: true, vendorDir: root });
        if (handle === undefined)
            assert.fail('mountRdkSkills returned undefined');
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