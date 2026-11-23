# Dhimshoki

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Dhims97/Dhimshoki/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Dhims97/Dhimshoki/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: 198 pre-token protocols ranked by implied value, fitted on the traded comps in the sealed DefiLlama snapshot (14 Nov 2026). Model comps-2: ln(mcap) = a + b·ln(TVL) + 0.5·c·growth, token odds from age × TVL peers, net farm economics (cost, time, break-even) on every row. Leave-one-out median error ×3.57, walk-forward ×2.91, against the starter's ×5.11 / ×5.26.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Then open `out/dashboard/index.html` (served, so `data.js` loads) — or serve `out/` with any static server.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
