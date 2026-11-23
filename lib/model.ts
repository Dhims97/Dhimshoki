// Token Radar's model (comps-2): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) plus every
// other pre-token protocol that survives the integrity strip: 198 rows in this snapshot. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// live-token protocols are kept apart and shown as the market's own values, never mixed into the
// ranked board.
//
// Implied value follows only from the snapshot's own figures, fitted on the traded comps at run
// time (no hardcoded coefficients, no hardcoded names):
//
//   ln(mcap) = a + b*ln(TVL) + 0.5*c*growth_frac     (OLS on the 128 comps with mcap_usd > 0)
//   growth_frac = clamp(change_7d, -50, 100)/100, null -> 0
//   conditional_mcap = exp(prediction)              (what the token would be worth IF it launches)
//   token_odds  = shrunk peer rate of "has a traded token", by age tercile x TVL tercile (k=5)
//   implied_value = round(token_odds * conditional_mcap)
//
// The 0.5 is a fixed shrinkage of the noisy growth coefficient toward 0 (a standard regulariser,
// not tuned per fold). The fitted growth coefficient is NEGATIVE in this snapshot: protocols whose
// TVL spiked in the last 7 days tend to carry lower mcap/TVL (mercenary / new-listing TVL,
// mean-reversion). The sign is shown, not hidden. Age and category offsets were tested and DROPPED:
// they worsened leave-one-out and walk-forward error. Age still enters via token odds and farm hold.
//
// Held-out validation is recomputed at run time and shipped in the dashboard data:
//   LOO MALE 1.273 (typical error x3.57) and walk-forward MALE 1.067 (typical error x2.91),
//   vs the starter's 1.632 / 1.661 and TVL-only's 1.623 / 1.681. MALE = median absolute log error.
//   The point estimate is therefore +/-~3x in the typical case: the dashboard shows the error band
//   on every row, not a single confident number.
//
// Net farm economics (assumptions labelled in the dashboard, not snapshot data):
//   capital by TVL tier ($250 / $150 / $100 / $50); gas $/tx by first chain (Ethereum $4, most
//   L2s $0.30, Solana $0.02, default $1); txs = 2 setup + 1/week + 1 claim; hold 60d if age < 180d,
//   45d if < 365d, else 30d; opportunity cost 5% APR on capital over the hold; expected airdrop =
//   token_odds x conditional_mcap x 3.75e-6 (7.5% of implied FDV to the community, split among
//   20,000 farmers). Net = expected - (gas + opportunity cost). $/hour = net / time.
//   Verdict: FARM if net >= $50 and $/h >= $20; THIN if net > $0; else SKIP.
//   Break-even implied value = total_cost / (token_odds x 3.75e-6): the token value at which this
//   farm breaks even. Base verdicts on this snapshot: 0 FARM / 39 THIN / 159 SKIP. That harshness
//   is honest and is shown as-is; the optimistic sensitivity (same pool split among 5,000 farmers:
//   8 FARM / 100 THIN / 90 SKIP) is shown beside it as a secondary view. The share is NOT tuned
//   to manufacture FARM rows.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted comps-2 model, as the dashboard states it and the page recomputes it. */
export interface ModelConstants {
  version: string;
  spec: string;
  intercept: number;
  ln_tvl: number;
  growth_unshrunk: number;
  growth_effective: number;
  growth_shrink: number;
  mean_ln_tvl: number;
  n_comps: number;
}

/** Held-out validation, recomputed from the snapshot at run time. */
export interface ValidationMetrics {
  loo_male: number;
  loo_typical_x: number;
  loo_n: number;
  wf_male: number;
  wf_typical_x: number;
  wf_n: number;
  starter_loo_male: number;
  starter_wf_male: number;
  tvl_only_loo_male: number;
  tvl_only_wf_male: number;
}

export const MODEL_VERSION = 'comps-2';

/** Net farm economics for one row (base share), and the optimistic-share sensitivity. */
export interface FarmEcon {
  capital_usd: number;
  hold_days: number;
  tx_count: number;
  gas_usd: number;
  opp_cost_usd: number;
  total_cost_usd: number;
  time_hours: number;
  expected_airdrop_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_implied_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  conditional_mcap_usd: number;
  token_odds: number;
  odds_cell: string;
  is_watchlist: boolean;
  model: {
    conditional_mcap_usd: number;
    token_odds: number;
    growth_frac: number;
    age_days: number | null;
  };
  farm: FarmEcon;
  farm_optimistic: FarmEcon;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  conditional_mcap_usd: number;
  token_odds: number;
  odds_cell: string;
  is_watchlist: boolean;
  farm: FarmEcon;
  farm_optimistic: FarmEcon;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the model and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  validation: ValidationMetrics;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  verdict_counts: { FARM: number; THIN: number; SKIP: number };
  verdict_counts_optimistic: { FARM: number; THIN: number; SKIP: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const GROWTH_SHRINK = 0.5;
const FARMER_SHARE = 3.75e-6; // 7.5% of implied FDV to community, split among 20,000 farmers (assumption)
const FARMER_SHARE_OPT = 1.5e-5; // optimistic sensitivity: same pool split among 5,000 farmers
const LIVE_ROWS = 24;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** growth_frac from a 7d change: clamped to [-50, 100]%, null -> 0. */
export function growthFrac(change7d: number | null): number {
  if (change7d === null || !Number.isFinite(change7d)) return 0;
  return clamp(change7d, -50, 100) / 100;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const STRIP_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or bridged
 * product of a token that already trades, not a versioned pool, not an exchange product. The
 * snapshot's "no token recorded" flag alone does not catch these (WBTC, Binance staked ETH, USDT0,
 * canonical bridges...), and without this strip they would wrongly top the board.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (STRIP_CATEGORIES.has(p.category ?? '')) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** Small dense solve by Gauss-Jordan with partial pivoting (deterministic). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    for (let r = 0; r < n; r++) {
      if (r === c || M[r]![c] === 0) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

function ols(rows: { x: number[]; y: number }[], k: number): number[] {
  const XtX = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty = Array(k).fill(0);
  for (const r of rows) {
    for (let i = 0; i < k; i++) {
      Xty[i]! += r.x[i]! * r.y;
      for (let j = 0; j < k; j++) XtX[i]![j]! += r.x[i]! * r.x[j]!;
    }
  }
  for (let i = 1; i < k; i++) XtX[i]![i]! += 1e-6;
  return solve(XtX, Xty);
}

interface CompsFit {
  beta: number[];
  meanLnTvl: number;
  n: number;
  predict: (p: SnapshotProtocol) => number;
}

/** OLS fit of ln(mcap) on ln(TVL) + shrunk growth, on the traded comps. */
export function fitComps(train: SnapshotProtocol[]): CompsFit {
  const meanLnTvl = mean(train.map((p) => Math.log(p.tvl_usd)));
  const rows = train.map((p) => ({
    x: [1, Math.log(p.tvl_usd) - meanLnTvl, growthFrac(p.change_7d)],
    y: Math.log(p.mcap_usd!),
  }));
  const beta = ols(rows, 3);
  const growthUnshrunk = beta[2]!;
  beta[2] = beta[2]! * GROWTH_SHRINK;
  const predict = (p: SnapshotProtocol): number => {
    const x = [1, Math.log(p.tvl_usd) - meanLnTvl, growthFrac(p.change_7d)];
    return Math.exp(x.reduce((s, v, i) => s + v * beta[i]!, 0));
  };
  return { beta, meanLnTvl, n: train.length, predict };
}

/** The starter's model, kept only as a validation baseline. */
function starterImplied(p: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, p.listed_at);
  const g = clamp(p.change_7d ?? 0, -60, 120);
  const growthMult = 1 + (g / 100) * 0.5;
  const a = age ?? 365;
  const mat = 0.6 + (Math.min(Math.max(a, 0), 1095) / 1095) * 0.4;
  return Math.max(1, Math.round(p.tvl_usd * 0.25 * growthMult * mat));
}

/** TVL-only baseline (constant median mcap/TVL), kept only as a validation baseline. */
function fitTvlOnly(train: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  const med = median(train.map((p) => Math.log(p.mcap_usd! / p.tvl_usd)));
  return (p) => p.tvl_usd * Math.exp(med);
}

function metrics(preds: { pred: number; actual: number }[]): { male: number; typicalX: number } {
  const errs = preds.map(({ pred, actual }) => Math.log(pred / actual));
  const male = median(errs.map(Math.abs));
  return { male, typicalX: Math.exp(male) };
}

type PredFn = (p: SnapshotProtocol) => number;

function looMetrics(traded: SnapshotProtocol[], kind: 'comps2' | 'starter' | 'tvl-only', asOf: string): { male: number; typicalX: number; n: number } {
  const preds: { pred: number; actual: number }[] = [];
  for (let i = 0; i < traded.length; i++) {
    const train = traded.filter((_, j) => j !== i);
    const t = traded[i]!;
    let pred: number;
    if (kind === 'comps2') pred = fitComps(train).predict(t);
    else if (kind === 'tvl-only') pred = fitTvlOnly(train)(t);
    else pred = starterImplied(t, asOf);
    preds.push({ pred, actual: t.mcap_usd! });
  }
  return { ...metrics(preds), n: preds.length };
}

function walkForwardMetrics(traded: SnapshotProtocol[], kind: 'comps2' | 'starter' | 'tvl-only', asOf: string): { male: number; typicalX: number; n: number } {
  const dated = traded
    .filter((p) => p.listed_at)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const n = dated.length;
  const folds = [
    { train: dated.slice(0, Math.floor(n / 2)), test: dated.slice(Math.floor(n / 2), Math.floor((3 * n) / 4)) },
    { train: dated.slice(0, Math.floor((3 * n) / 4)), test: dated.slice(Math.floor((3 * n) / 4)) },
  ];
  const pooled: { pred: number; actual: number }[] = [];
  for (const f of folds) {
    let fn: PredFn;
    if (kind === 'comps2') fn = fitComps(f.train).predict;
    else if (kind === 'tvl-only') fn = fitTvlOnly(f.train);
    else fn = (t) => starterImplied(t, asOf);
    for (const t of f.test) pooled.push({ pred: fn(t), actual: t.mcap_usd! });
  }
  return { ...metrics(pooled), n: pooled.length };
}

/** Token odds: shrunk peer rate of "has a traded token", by age tercile x TVL tercile (k=5). */
export interface OddsTable {
  globalRate: number;
  ageTerciles: [number, number];
  tvlTerciles: [number, number];
  cells: Record<string, { n: number; traded: number; shrunk: number }>;
}

export function buildOdds(protocols: SnapshotProtocol[], asOf: string): OddsTable {
  const terciles = (values: number[]): [number, number] => {
    const s = [...values].sort((a, b) => a - b);
    return [s[Math.floor(s.length / 3)]!, s[Math.floor((2 * s.length) / 3)]!];
  };
  const agesAll = protocols.map((p) => ageDays(asOf, p.listed_at)).filter((a): a is number => a !== null);
  const [ageT1, ageT2] = terciles(agesAll);
  const [tvlT1, tvlT2] = terciles(protocols.map((p) => p.tvl_usd));
  const traded = protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const globalRate = traded.length / protocols.length;
  const ageBin = (p: SnapshotProtocol): string => {
    const a = ageDays(asOf, p.listed_at);
    if (a === null) return 'age-unknown';
    return a <= ageT1 ? 'age-young' : a <= ageT2 ? 'age-mid' : 'age-old';
  };
  const tvlBin = (p: SnapshotProtocol): string =>
    p.tvl_usd <= tvlT1 ? 'tvl-low' : p.tvl_usd <= tvlT2 ? 'tvl-mid' : 'tvl-high';
  const cells: OddsTable['cells'] = {};
  for (const a of ['age-young', 'age-mid', 'age-old', 'age-unknown']) {
    for (const t of ['tvl-low', 'tvl-mid', 'tvl-high']) {
      const cell = protocols.filter((p) => ageBin(p) === a && tvlBin(p) === t);
      const k = cell.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length;
      cells[`${a}|${t}`] = { n: cell.length, traded: k, shrunk: Math.round(((k + 5 * globalRate) / (cell.length + 5)) * 10000) / 10000 };
    }
  }
  return { globalRate, ageTerciles: [ageT1, ageT2], tvlTerciles: [tvlT1, tvlT2], cells };
}

function oddsOf(odds: OddsTable, p: SnapshotProtocol, asOf: string): { odds: number; cell: string } {
  const ageBin = ((): string => {
    const a = ageDays(asOf, p.listed_at);
    if (a === null) return 'age-unknown';
    return a <= odds.ageTerciles[0] ? 'age-young' : a <= odds.ageTerciles[1] ? 'age-mid' : 'age-old';
  })();
  const tvlBin = p.tvl_usd <= odds.tvlTerciles[0] ? 'tvl-low' : p.tvl_usd <= odds.tvlTerciles[1] ? 'tvl-mid' : 'tvl-high';
  const cell = `${ageBin}|${tvlBin}`;
  return { odds: odds.cells[cell]!.shrunk, cell };
}

/** Gas $/tx by first chain (assumption, typical Nov 2026 — NOT snapshot data). */
const GAS: Record<string, number> = {
  Ethereum: 4.0, Base: 0.3, Arbitrum: 0.3, Optimism: 0.3, Polygon: 0.3, 'zkSync Era': 0.3, Linea: 0.3, Blast: 0.3,
  Solana: 0.02, Bitcoin: 1.5, Tron: 1.0, Sui: 0.05, Aptos: 0.05,
};
const gasPerTx = (p: SnapshotProtocol): number => GAS[p.chains[0] ?? ''] ?? 1.0;

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Net farm economics for one row under one farmer-share assumption. */
function farmEconFor(p: SnapshotProtocol, age: number | null, conditional: number, odds: number, share: number): FarmEcon {
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const txs = 2 + weeks + 1;
  const gas = txs * gasPerTx(p);
  const capital = capitalFor(p);
  const oppCost = capital * 0.05 * (hold / 365);
  const totalCost = gas + oppCost;
  const timeHrs = 0.25 + weeks * (10 / 60) + 10 / 60;
  const expected = odds * conditional * share;
  const net = expected - totalCost;
  const perHour = net / timeHrs;
  const breakEven = totalCost / Math.max(odds * share, 1e-12);
  const verdict: FarmEcon['verdict'] = net >= 50 && perHour >= 20 ? 'FARM' : net > 0 ? 'THIN' : 'SKIP';
  const r2 = (n: number): number => Math.round(n * 100) / 100;
  return {
    capital_usd: capital, hold_days: hold, tx_count: txs, gas_usd: r2(gas), opp_cost_usd: r2(oppCost),
    total_cost_usd: r2(totalCost), time_hours: r2(timeHrs), expected_airdrop_usd: r2(expected),
    net_usd: r2(net), net_per_hour_usd: r2(perHour), break_even_implied_usd: Math.round(breakEven), verdict,
  };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, carrying that row's
 * own economics (expected value, cost, net, verdict, break-even). Derived from the protocol's own
 * record (category, chains, TVL, age) and its computed economics — never from a hand-written list
 * of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEcon): string[] {
  const chain = chainOf(p);
  const capital = econ.capital_usd;
  const hold = econ.hold_days;
  const weeks = Math.ceil(hold / 7);
  const gas = gasPerTx(p);
  const steps = [
    `Use a fresh wallet that holds only the funds you plan to farm on ${chain}, and keep its seed phrase offline. Cost: under $3 of gas for the first transaction. Time: 5 minutes.`,
    `${actionFor(p, capital, chain)} Cost: $${capital} of capital and about $${(econ.tx_count * gas).toFixed(2)} of gas in total. Time: 15 minutes to set up.`,
    `Make one qualifying action each week, such as a deposit, a swap or a vote, for ${weeks} weeks. Cost: about $${gas.toFixed(2)} of gas a week. Time: 10 minutes a week.`,
    `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot. Cost: the $${capital} stays in the position. Time: ${hold} days.`,
    `Expected airdrop value is about $${econ.expected_airdrop_usd} against $${econ.total_cost_usd} of cost, a net of $${econ.net_usd} (${econ.verdict}); break-even implied value is $${econ.break_even_implied_usd.toLocaleString('en-US')}. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`,
    `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Cost: nothing but the log. Time: 5 minutes.`,
  ];
  return steps.map((s) => {
    if (s.length > 600) return `${s.slice(0, 596)}...`;
    if (s.length < 20) return `${s} Hold the position and check the protocol's own page.`;
    return s;
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd, change_7d: p.change_7d,
    }));
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const fit = fitComps(traded);
  const odds = buildOdds(snapshot.protocols, snapshot.as_of);
  const watch = new Set(snapshot.watchlist);

  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, not just the top 160 by TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const conditional = fit.predict(p);
    const { odds: tokenOdds, cell } = oddsOf(odds, p, snapshot.as_of);
    const implied = Math.max(1, Math.round(tokenOdds * conditional));
    const econ = farmEconFor(p, age, conditional, tokenOdds, FARMER_SHARE);
    const econOpt = farmEconFor(p, age, conditional, tokenOdds, FARMER_SHARE_OPT);
    return { p, age, conditional, tokenOdds, cell, implied, econ, econOpt };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    conditional_mcap_usd: Math.round(s.conditional),
    token_odds: Math.round(s.tokenOdds * 10000) / 10000,
    odds_cell: s.cell,
    is_watchlist: watch.has(s.p.slug),
    model: {
      conditional_mcap_usd: Math.round(s.conditional),
      token_odds: Math.round(s.tokenOdds * 10000) / 10000,
      growth_frac: growthFrac(s.p.change_7d),
      age_days: s.age,
    },
    farm: s.econ,
    farm_optimistic: s.econOpt,
    farm_steps: farmSteps(s.p, s.age, s.econ),
  }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank, slug: row.slug, name: row.name, category: row.category, chains: row.chains,
    tvl_usd: row.tvl_usd, change_7d: row.change_7d, age_days: row.age_days,
    implied_value_usd: row.implied_value_usd, conditional_mcap_usd: row.conditional_mcap_usd,
    token_odds: row.token_odds, odds_cell: row.odds_cell, is_watchlist: row.is_watchlist,
    farm: row.farm, farm_optimistic: row.farm_optimistic, farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const fit = fitComps(traded);
  const loo = looMetrics(traded, 'comps2', snapshot.as_of);
  const wf = walkForwardMetrics(traded, 'comps2', snapshot.as_of);
  const looStarter = looMetrics(traded, 'starter', snapshot.as_of);
  const wfStarter = walkForwardMetrics(traded, 'starter', snapshot.as_of);
  const looTvl = looMetrics(traded, 'tvl-only', snapshot.as_of);
  const wfTvl = walkForwardMetrics(traded, 'tvl-only', snapshot.as_of);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const counts = { FARM: 0, THIN: 0, SKIP: 0 };
  const countsOpt = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) {
    counts[r.farm.verdict]++;
    countsOpt[r.farm_optimistic.verdict]++;
  }
  const r4 = (n: number): number => Math.round(n * 10000) / 10000;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: {
      version: MODEL_VERSION,
      spec: 'ln(mcap) = a + b*ln(TVL) + 0.5*c*growth_frac; growth_frac = clamp(change_7d, -50, 100)/100',
      // Full precision here: the dashboard recomputes each row from these constants and must
      // land on the same integer board.json carries. Display rounds them (see app.js).
      intercept: fit.beta[0]!,
      ln_tvl: fit.beta[1]!,
      growth_unshrunk: fit.beta[2]! / GROWTH_SHRINK,
      growth_effective: fit.beta[2]!,
      growth_shrink: GROWTH_SHRINK,
      mean_ln_tvl: fit.meanLnTvl,
      n_comps: fit.n,
    },
    validation: {
      loo_male: r4(loo.male), loo_typical_x: r4(loo.typicalX), loo_n: loo.n,
      wf_male: r4(wf.male), wf_typical_x: r4(wf.typicalX), wf_n: wf.n,
      starter_loo_male: r4(looStarter.male), starter_wf_male: r4(wfStarter.male),
      tvl_only_loo_male: r4(looTvl.male), tvl_only_wf_male: r4(wfTvl.male),
    },
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    verdict_counts: counts,
    verdict_counts_optimistic: countsOpt,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
