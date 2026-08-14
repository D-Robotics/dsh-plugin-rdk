import Schema from '@deepseek-ai/schemastery';
import { mountRdkSkills } from './skill-provider.js';
import { registerTools } from './tools.js';
export const name = 'rdk-skills';
export const Config = Schema.object({
    skillsDirs: Schema.array(Schema.string()).default([]),
    includeOe: Schema.boolean().default(true),
    detectScript: Schema.string(),
});
export const inject = ['skills', 'tools'];
export function apply(ctx, config) {
    const handle = mountRdkSkills(ctx, {
        skillsDirs: config.skillsDirs ?? [],
        includeOe: config.includeOe ?? true,
    });
    if (handle === undefined) {
        ctx.logger?.warn?.('dsh-plugin-rdk: skills service unavailable; RDK skills were not registered');
        return;
    }
    registerTools(ctx, handle, config.detectScript);
}
export { parseDetectOutput, runDeviceDetect } from './device-detect.js';
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js';
//# sourceMappingURL=index.js.map