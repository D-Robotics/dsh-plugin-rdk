import Schema from '@deepseek-ai/schemastery';
import { mountRdkSkills } from './skill-provider.js';
import { registerTools } from './tools.js';
export const name = 'rdk-skills';
export const Config = Schema.object({
    skillsDirs: Schema.array(Schema.string()).default([]),
    includeOe: Schema.boolean().default(true),
    detectScript: Schema.string(),
    oeX5Source: Schema.string(),
    oeSSource: Schema.string(),
});
export function apply(ctx, config) {
    // Declare hard dependencies so Cordis waits for these services and
    // re-activates the plugin when they appear — instead of silently
    // doing nothing because they happened to not be ready yet.
    const skills = ctx.get('skills');
    const tools = ctx.get('tools');
    if (skills === undefined || tools === undefined) {
        // Services not yet available; Cordis will re-invoke apply when they appear
        // because we declare them in inject below.
        return;
    }
    const handle = mountRdkSkills(skills, {
        skillsDirs: config.skillsDirs ?? [],
        includeOe: config.includeOe ?? true,
    });
    registerTools(tools, handle, {
        detectScript: config.detectScript,
        oeX5Source: config.oeX5Source,
        oeSSource: config.oeSSource,
    });
}
// Declare hard dependencies so Cordis re-activates the plugin when the
// services become available (e.g. after a dynamic reload).
export const inject = ['skills', 'tools'];
export { parseDetectOutput, runDeviceDetect } from './device-detect.js';
export { runOeSetup, OE_PACKS } from './oe-setup.js';
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js';
//# sourceMappingURL=index.js.map