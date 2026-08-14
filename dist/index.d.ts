/**
 * dsh-plugin-rdk — D-Robotics RDK integration for DeepSeek Harness.
 *
 * Mounts the `rdk-skills` provider into the harness-native skills registry so
 * the vendored RDK skill packs (rdk-device-skills + rdk-skills) appear in the
 * session skill catalog and load through the built-in `skill` tool, and
 * registers the `rdk_skills` catalog tool plus the `rdk_board_detect` device
 * detector.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "rdk-skills";
export interface Config {
    /** Extra skill directories scanned BEFORE the vendored packs; they win duplicate names. */
    skillsDirs: string[];
    /** Include the OE / X5 / S-series toolchain skills vendored from rdk-skills. */
    includeOe: boolean;
    /** Custom board-detection script; defaults to the vendored detect_rdk.sh. */
    detectScript?: string;
}
export declare const Config: Schema<Config>;
export declare const inject: string[];
export declare function apply(ctx: Context, config: Config): void;
export { parseDetectOutput, runDeviceDetect } from './device-detect.js';
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js';
