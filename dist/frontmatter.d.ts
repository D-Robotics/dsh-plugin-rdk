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
export interface ParsedSkill {
    name: string;
    description: string;
    whenToUse?: string;
    version?: string;
    tags: string[];
    body: string;
}
/** Skill-name grammar: strictly kebab-case, matching the DSH registry's own
 *  `SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Names that do not conform
 *  (e.g. the OE packs' `__SKILL_...` routing internals) must be dropped here,
 *  otherwise the registry throws `invalid skill name` and rejects the whole
 *  provider. */
export declare function isSkillName(name: unknown): name is string;
export declare function parseSkillMarkdown(raw: string): ParsedSkill | undefined;
