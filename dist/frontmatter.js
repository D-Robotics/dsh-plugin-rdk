/**
 * SKILL.md frontmatter parsing for the vendored D-Robotics RDK skill packs.
 *
 * The packs follow the Agent Skills convention: a leading `---` YAML block
 * carrying `name`, `description`, optional `whenToUse`, `version` and a
 * `metadata` object (with `tags` etc.), followed by the Markdown body.
 *
 * We use tolerant regex-based field extraction only — no external YAML parser.
 * A full YAML library is heavyweight (pulling in 100+ transitive deps) and can
 * throw on perfectly valid SKILL.md files whose descriptions contain unquoted
 * `: ` or `#` characters.  The regex approach is battle-tested against every
 * vendored SKILL.md (77+ skills across 5 packs) and never drops a valid skill.
 */
/** Skill-name grammar: kebab-case (e.g. rdk-diagnostic) or the OE
 *  __SKILL_ prefix convention (e.g. __SKILL_j6-plugin-__adaptation). */
export function isSkillName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9_]+(-[a-zA-Z0-9_]+)*$/.test(name);
}
const unquote = (value) => {
    let v = value;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
    return v;
};
/** Tolerant single-line field extraction for non-strict-YAML frontmatter. */
function extractField(lines, key) {
    const re = new RegExp(`^${key}:\\s*(.*?)\\s*$`);
    for (const line of lines) {
        const match = line.match(re);
        if (match === null)
            continue;
        const value = unquote(match[1]);
        return value === '' ? undefined : value;
    }
    return undefined;
}
/** Tolerant `- item` list extraction (used for metadata.tags).
 *  Also handles inline array form: `tags: [item1, item2, ...]`. */
function extractList(lines, key) {
    for (const line of lines) {
        // Inline array form: tags: [item1, item2, ...]
        const inline = line.match(new RegExp(`^\\s*${key}:\\s*\\[(.*?)\\]\\s*$`));
        if (inline !== null) {
            return inline[1]
                .split(',')
                .map((s) => s.trim())
                .map((s) => unquote(s))
                .filter((s) => s !== '');
        }
    }
    // Multi-line form: tags:\n  - item1\n  - item2
    const items = [];
    let active = false;
    for (const line of lines) {
        if (/^\s*$/.test(line))
            continue;
        const kv = line.match(/^\s*([\w.-]+):\s*(.*)$/);
        const item = line.match(/^\s+-\s+(.+?)\s*$/);
        if (kv !== null) {
            active = kv[1] === key && kv[2] === '';
        }
        else if (active && item !== null) {
            const value = unquote(item[1]);
            if (value !== '')
                items.push(value);
        }
    }
    return items;
}
export function parseSkillMarkdown(raw) {
    const lines = raw.split(/\r?\n/);
    if (lines[0] !== '---')
        return undefined;
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---' || lines[i] === '...') {
            end = i;
            break;
        }
    }
    if (end < 0)
        return undefined;
    const headLines = lines.slice(1, end);
    const body = lines.slice(end + 1).join('\n').trim();
    const name = extractField(headLines, 'name');
    const description = extractField(headLines, 'description');
    if (!isSkillName(name) || description === undefined || description === '')
        return undefined;
    return {
        name,
        description,
        whenToUse: extractField(headLines, 'whenToUse'),
        version: extractField(headLines, 'version'),
        tags: extractList(headLines, 'tags'),
        body,
    };
}
//# sourceMappingURL=frontmatter.js.map