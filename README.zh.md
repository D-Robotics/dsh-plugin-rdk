# dsh-plugin-rdk

[English](./README.md)

**D-Robotics RDK（地瓜机器人）的 DeepSeek Harness 适配插件** —— 一个 [DSH bundle 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)，把官方 RDK 技能生态原生接入 harness。

| 能力 | 说明 |
| --- | --- |
| **原生技能目录** | 将内置（vendored）的 RDK 技能包（`rdk-device-skills` + `rdk-skills` + `bsp-skills`，约 77 个技能）注册进 harness 技能注册表：它们会出现在会话技能目录中，并可通过内置 `skill` 工具直接加载。 |
| **`rdk_skills` 工具** | 供模型调用的目录工具：全量列表、关键词搜索、精确技能详情（路径、脚本、标签）。 |
| **`rdk_board_detect` 工具** | 运行官方 `detect_rdk.sh`，判断当前主机是否为 RDK 板卡（板卡 / SoC / BPU 架构 / 内存 / 系统版本）。 |

## 安装

```sh
# 从 npm 安装（推荐）
dsh plugin --profile <name> add dsh-plugin-rdk

# 从 git 仓库安装
dsh plugin --profile <name> add github:<owner>/dsh-plugin-rdk
```

随后用 `dsh --profile <name>` 启动。插件行挂载在 host 组合中，
该 profile 的所有会话都会获得 RDK 技能。

## 配置

在 profile 的 `cordis.patch.yml`（或 bundle 行配置）中：

```yaml
- insert:
    - id: rdk-skills
      name: dsh-plugin-rdk
      config:
        skillsDirs: []        # 额外技能目录，优先扫描（同名技能覆盖内置副本）
        includeOe: true       # 是否包含 rdk-skills 中的 OE / X5 / S 系列工具链技能
        detectScript: null    # 自定义板卡检测脚本（默认用内置 detect_rdk.sh）
```

| 字段 | 类型 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `skillsDirs` | `string[]` | `[]` | 存放 `SKILL.md` 技能目录的额外目录列表，先于内置包扫描。 |
| `includeOe` | `boolean` | `true` | 设为 `false` 时目录只保留 26 个 `rdk-*` 设备技能（去掉 OE/X5/S 工具链技能）。 |
| `detectScript` | `string` | 内置 `detect_rdk.sh` | `rdk_board_detect` 执行的检测脚本。 |

## 工具

### `rdk_skills`

- 无参数 → 完整目录摘要（数量、来源包、错误）。
- `query: "关键词"` → 按名称 / 描述 / 标签搜索。
- `query: "rdk-diagnostic"`（精确技能名）→ 详情：路径、文件、脚本。
- `refresh: true` → 重新扫描配置的目录。

### `rdk_board_detect`

通过 bash 运行内置 `detect_rdk.sh`。在 RDK 板卡上返回
`{ detected: true, board, soc, bpuArch, memGb, osVersion, productModel }`；
在其他主机上返回 `{ detected: false, reason }`。只读，绝不编造数据。

## 技能内容更新

内置技能是普通文件副本，因此插件离线可用。运行 `npm run sync` 从上游仓库
重新同步（默认使用本地 checkout；可通过 `RDK_DEVICE_SKILLS_SOURCE` /
`RDK_SKILLS_SOURCE` / `BSP_SKILLS_SOURCE` 指定路径或 git URL）。GitHub
Action 每周检查上游变化并自动开 PR。新增技能包无需改代码：`skills/`
下的每个目录都会自动被当作一个技能包扫描。

## 开发

```sh
npm install
npm run build   # tsc -> dist/
npm test        # 构建 + node --test
npm run sync    # 刷新内置技能
```

## 许可证

插件代码：Apache-2.0。内置技能内容：Apache-2.0 AND CC-BY-4.0，
版权归 D-Robotics 所有 —— 见 [NOTICE.md](./NOTICE.md) 及各包的
`LICENSE*` 文件。本项目不是 D-Robotics 官方产品。
