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
    const skills = ctx.get('skills');
    const tools = ctx.get('tools');
    if (skills === undefined || tools === undefined) {
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
export { parseDetectOutput, runDeviceDetect } from './device-detect.js';
export { runOeSetup, OE_PACKS } from './oe-setup.js';
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js';
//# sourceMappingURL=index.js.map