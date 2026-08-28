/**
 * Model-facing tools contributed by dsh-plugin-rdk:
 *  - `rdk_skills`: browse / search the indexed RDK skill catalog.
 *  - `rdk_board_detect`: detect whether the current host is an RDK board.
 *  - `rdk_oe_setup`: run the official OE pack setup.sh into a project workspace.
 */
import { type ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { RdkSkillsHandle } from './skill-provider.js';
export interface ToolsRegistryView {
    register(definition: ToolDefinition): () => void;
}
export interface OeSetupOptions {
    detectScript?: string;
    oeX5Source?: string;
    oeSSource?: string;
}
export declare function registerTools(tools: ToolsRegistryView, handle: RdkSkillsHandle, opts?: OeSetupOptions): void;
