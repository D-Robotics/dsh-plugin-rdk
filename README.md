# dsh-plugin-rdk

[中文文档](./README.zh.md)

**D-Robotics RDK (地瓜机器人) integration for DeepSeek Harness** — a [DSH bundle plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) that brings the official RDK skill ecosystem into the harness natively.

| Capability | What it does |
| --- | --- |
| **Native skill catalog** | Registers the vendored RDK skill packs (`rdk-device-skills` + `rdk-skills`, ~69 skills) into the harness skill registry, so they appear in the session skill catalog and load through the built-in `skill` tool. |
| **`rdk_skills` tool** | Model tool to list, search, and inspect the indexed catalog (path, scripts, tags). |
| **`rdk_board_detect` tool** | Runs the canonical `detect_rdk.sh` to report whether the current host is an RDK board (board / SoC / BPU arch / memory / OS version). |

## Install

```sh
# from npm (preferred)
dsh plugin --profile <name> add dsh-plugin-rdk

# from a git checkout
dsh plugin --profile <name> add github:<owner>/dsh-plugin-rdk
```

Then boot with `dsh --profile <name>`. The plugin row lands in the host
composition, so every session of that profile gets the RDK skills.

## Configuration

In your profile's `cordis.patch.yml` (or the bundle row config):

```yaml
- insert:
    - id: rdk-skills
      name: dsh-plugin-rdk
      config:
        skillsDirs: []        # extra skill directories scanned FIRST (they win duplicate names)
        includeOe: true       # include the OE / X5 / S-series toolchain skills from rdk-skills
        detectScript: null    # custom board-detection script (defaults to the vendored detect_rdk.sh)
```

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `skillsDirs` | `string[]` | `[]` | Extra directories of `SKILL.md` skill folders, scanned before the vendored packs. |
| `includeOe` | `boolean` | `true` | `false` limits the catalog to the 26 `rdk-*` device skills (drops the OE/X5/S toolchain skills). |
| `detectScript` | `string` | vendored `detect_rdk.sh` | Script executed by `rdk_board_detect`. |

## Tools

### `rdk_skills`

- No arguments → full catalog summary (count, packs, errors).
- `query: "keyword"` → search across name / description / tags.
- `query: "rdk-diagnostic"` (exact name) → detail with file layout and scripts.
- `refresh: true` → rescan the configured directories.

### `rdk_board_detect`

Runs the vendored `detect_rdk.sh` via bash. On an RDK board it returns
`{ detected: true, board, soc, bpuArch, memGb, osVersion, productModel }`;
elsewhere it returns `{ detected: false, reason }`. Read-only, never
fabricates data.

## Keeping the skills up to date

The vendored packs are plain copies, so the plugin works offline. Run
`npm run sync` to re-copy from the upstream repositories (local checkouts
by default; set `RDK_DEVICE_SKILLS_SOURCE` / `RDK_SKILLS_SOURCE` to paths
or git URLs). A weekly GitHub Action opens a PR when the upstream packs
change.

## Development

```sh
npm install
npm run build   # tsc -> dist/
npm test        # build + node --test
npm run sync    # refresh vendored skills
```

## License

Plugin code: Apache-2.0. Vendored skill content: Apache-2.0 AND CC-BY-4.0,
© D-Robotics — see [NOTICE.md](./NOTICE.md) and the per-pack `LICENSE*`
files. This project is not an official D-Robotics product.
