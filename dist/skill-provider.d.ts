import type { Context } from '@deepseek-ai/cordis';
export declare const PROVIDER_NAME = "rdk-skills";
export declare const DEFAULT_RANK = 300;
export interface IndexedSkill {
    name: string;
    description: string;
    whenToUse?: string;
    version?: string;
    tags: string[];
    pack: string;
    dir: string;
    path: string;
}
export interface ScanRootStats {
    pack: string;
    dir: string;
    found: number;
}
export interface ScanStats {
    roots: ScanRootStats[];
    errors: string[];
}
export interface RdkSkillIndex {
    skills: IndexedSkill[];
    byName: Map<string, IndexedSkill>;
    stats: ScanStats;
    scannedAt: string | null;
}
export interface ProviderOptions {
    /** Extra skill directories scanned BEFORE the vendored packs (they win duplicates). */
    skillsDirs: string[];
    /** Include the OE / X5 / S-series toolchain skills vendored from rdk-skills. */
    includeOe: boolean;
    /** Override the vendored skills root (mainly for tests). */
    vendorDir?: string;
}
export interface RdkSkillsHandle {
    scanAll(force: boolean): Promise<RdkSkillIndex>;
    summary(): Promise<Record<string, unknown>>;
    detail(name: string): Promise<Record<string, unknown>>;
    listSkillFiles(dir: string): Promise<{
        files: string[];
        scripts: string[];
    }>;
    dispose(): void;
}
/** Minimal local view of the DSH skill-registry contract (keeps this package dependency-light). */
interface SkillProviderControl {
    signal: AbortSignal;
    invalidate: () => void;
}
interface SkillLookupOptions {
    cwd?: string;
    signal?: AbortSignal;
}
interface SkillResourceBase {
    kind: 'directory';
    path: string;
}
interface SkillInvocation {
    modelInvocable: boolean;
    userInvocable: boolean;
}
interface SkillSummary {
    name: string;
    description: string;
    whenToUse?: string;
    invocation: SkillInvocation;
    source: string;
    provider: string;
    resourceBase?: SkillResourceBase;
}
interface SkillCandidate extends SkillSummary {
    rank: number;
    locator: unknown;
    path?: string;
    metadata?: Readonly<Record<string, unknown>>;
}
interface SkillDefinition extends SkillSummary {
    content: string;
    path?: string;
    metadata?: Readonly<Record<string, unknown>>;
}
interface SkillProvider {
    name: string;
    list(options: SkillLookupOptions): Promise<readonly SkillCandidate[] | {
        candidates: readonly SkillCandidate[];
        complete: boolean;
    }>;
    get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        skills?: {
            registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void;
        };
    }
}
export declare const defaultVendorDir: () => string;
/**
 * Mount the skill provider + index for this plugin. Returns a handle the tool
 * layer uses, or `undefined` when the skills service is unavailable.
 */
export declare function mountRdkSkills(ctx: Context, options: ProviderOptions): RdkSkillsHandle | undefined;
export {};
