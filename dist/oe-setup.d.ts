export interface OePackInfo {
    pack: 'oe-skills-x5' | 'oe-skills-s';
    repoUrl: string;
    /** Directory setup.sh lays down inside the project root. */
    workspaceDir: string;
}
export declare const OE_PACKS: Record<'oe-skills-x5' | 'oe-skills-s', OePackInfo>;
export interface OeSetupInput {
    pack: string;
    projectRoot: string;
    source?: string;
    timeoutMs?: number;
}
export interface OeSetupResult {
    ok: boolean;
    pack: string;
    projectRoot: string;
    source: string;
    exitCode: number | null;
    output: string[];
    reason?: string;
    verified?: {
        workspaceDir: string;
        version?: string;
        skills: number;
    };
}
/**
 * Run the pack's own setup.sh against a project root — the exact install
 * flow of the upstream repository — and verify the laid-down workspace.
 */
export declare function runOeSetup(input: OeSetupInput): Promise<OeSetupResult>;
