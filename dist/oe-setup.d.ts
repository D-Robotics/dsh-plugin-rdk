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
 * Convert an https:// github URL to its ssh://git@github.com/ form so a
 * clone can survive hosts where HTTPS to github.com is slow or blocked
 * (common behind CN networks / corporate proxies) while SSH works.
 */
export declare const sshMirror: (url: string) => string | undefined;
/**
 * Run the pack's own setup.sh against a project root — the exact install
 * flow of the upstream repository — and verify the laid-down workspace.
 */
export declare function runOeSetup(input: OeSetupInput): Promise<OeSetupResult>;
