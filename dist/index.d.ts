/**
 * dsh-plugin-rdk — D-Robotics RDK integration for DeepSeek Harness.
 *
 * Mounts the `rdk-skills` provider into the harness-native skills registry so
 * the vendored RDK skill packs appear in the session skill catalog and load
 * through the built-in `skill` tool, and registers the `rdk_skills` catalog
 * tool, the `rdk_board_detect` device detector, and the `rdk_oe_setup`
 * workspace installer (runs the official OE pack setup.sh).
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "rdk-skills";
export interface Config {
    /** Extra skill directories scanned BEFORE the vendored packs; they win duplicate names. */
    skillsDirs: string[];
    /** Include the OpenExplorer toolchain packs (oe-skills-x5 / oe-skills-s). */
    includeOe: boolean;
    /** Custom board-detection script; defaults to the vendored detect_rdk.sh. */
    detectScript?: string;
    /** Custom git URL or local path for the oe-skills-x5 repository (used by rdk_oe_setup). */
    oeX5Source?: string;
    /** Custom git URL or local path for the oe-skills-s repository (used by rdk_oe_setup). */
    oeSSource?: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
export { parseDetectOutput, runDeviceDetect } from './device-detect.js';
export { runOeSetup, OE_PACKS } from './oe-setup.js';
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js';
