export declare const defaultDetectScript: () => string;
export interface DetectResult {
    detected: boolean;
    code: number | null;
    reason?: string;
    board?: string;
    soc?: string;
    bpuArch?: string;
    memGb?: number;
    osVersion?: string;
    productModel?: string;
    script: string;
}
/** Parse the `KEY=value` lines printed by detect_rdk.sh. Exported for tests. */
export declare function parseDetectOutput(output: string): Omit<DetectResult, 'detected' | 'code' | 'reason' | 'script'>;
export declare function runDeviceDetect(customScript?: string, timeoutMs?: number): Promise<DetectResult>;
