export interface ParsedSkill {
    name: string;
    description: string;
    whenToUse?: string;
    version?: string;
    tags: string[];
    body: string;
}
/** Kebab-case skill-name grammar shared by the DSH skill registry. */
export declare function isSkillName(name: unknown): name is string;
export declare function parseSkillMarkdown(raw: string): ParsedSkill | undefined;
