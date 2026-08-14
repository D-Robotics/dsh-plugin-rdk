# NOTICE

## dsh-plugin-rdk

Copyright (c) 2026 D-Robotics RDK Skills Community contributors.

The plugin source code in this repository is licensed under the Apache
License, Version 2.0 (see [LICENSE](./LICENSE)).

## Vendored skill content

The directories under `skills/` contain vendored copies of the D-Robotics
RDK skill packs:

- `skills/rdk-device-skills/` — from
  <https://github.com/D-Robotics/rdk-device-skills>
- `skills/rdk-skills/` — from
  <https://github.com/D-Robotics/rdk-skills>
- `skills/bsp-skills/` — from
  <https://github.com/D-Robotics/bsp-skills>
- `skills/oe-skills-x5/` — from
  <https://github.com/D-Robotics/oe-skills-x5>
- `skills/oe-skills-s/` — from
  <https://github.com/D-Robotics/oe-skills-s>

Skill content is Copyright (c) D-Robotics and its contributors and is
distributed under the Apache-2.0 and CC-BY-4.0 licenses of the upstream
repositories. The upstream license texts are preserved alongside each
vendored pack (`skills/<pack>/LICENSE*`), and `skills/manifest.json`
records the exact source and commit each pack was synced from.

Regenerate the vendored copies with `npm run sync` (see
[scripts/sync-skills.mjs](./scripts/sync-skills.mjs)).

D-Robotics, RDK, and related marks are trademarks of D-Robotics
(地瓜机器人). This project is not an official D-Robotics product.
