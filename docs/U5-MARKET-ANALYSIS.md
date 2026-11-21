# U.5 - Approved Market Analysis Specification

## Approval and boundary

Approved locally on 2026-11-14: choices **A / D / A / A**, followed by approval
of all six detailed rule groups. This document is the canonical U.5 specification.
**NOT implemented**: specification approval does not authorize runtime edits,
Agent grants, live API checks, orders, paid inference or a release.
D.2 ends at its checkpoint; D.3 Skills workflow and D.4 Control Panel remain next.
U.5 implementation requires a separate approved substage after that sequence.

| Decision | Approved scope |
| --- | --- |
| Markets | BTCUSDT, ETHUSDT, PAXGUSDT. Display PAXG/USDT as tokenized gold, never spot XAU/USD. Spot gold deferred. |
| Source candidate | Public Binance Market Data Only klines and server time, no API key. Deployment-network access and symbol support remain unverified. |
| Timeframes | UTC 15m / 1h / 4h. One symbol and one timeframe per tool request. |
| History | Exactly 500 valid, consecutive, closed candles for successful production analysis. |
| Analysis | RSI(14), ATR(14), confirmed swings/structure, three-candle FVG and swing zones; staged delivery. |
| Freshness | On demand only; memory cache at most 60 seconds, invalidated at candle boundaries. |
| Direct access | HAWK only, subject to existing server grant/configuration/disablement checks. No grant is added by this document. |
| Other Agents | Read forwarded reports only through existing workflow. SAGE retains its existing risk tools; BLADE/AUTO gain no tool permissions. |

## Existing architecture to preserve

- Keep market-data-feed and its current ticker input/output unchanged.
- Add a separate read-only analysis tool; do not repurpose existing ticker calls.
- Keep ToolExecutor.list/execute authoritative. Reject forbidden calls before any
  cache lookup that exposes data or upstream network request.
- Keep result-size, validation, cancellation, request deadlines and upstream-body
  bounds. Current executor limits serialized results to 50,000 characters.
- Keep 27 Agent identities, prompts, pairings, existing grants and non-market tools.
  Only an approved implementation substage may add HAWK's new analysis-tool scope.
- Use the existing ESM JavaScript/Node test setup and injected fetch transport.
  No dependency, database, persistent cache, scheduler or UI engine is required.
- Fixed source destinations only; no user/model URL, arbitrary fallback provider,
  credential collection or geographic-access workaround. Source restrictions stop
  connectivity acceptance; do not claim access from documentation alone.

## Candle and time contract

OHLCV means open/high/low/close/volume plus source open/close timestamps. Normalize
source rows once; require finite positive prices, finite non-negative volume,
high >= max(open, close), low <= min(open, close), and high >= low.
Require UTC-aligned, unique, chronologically ordered candle openings with the
selected timeframe spacing and valid source close timestamps. Reject malformed,
duplicate, reversed or gapped data; never fabricate or interpolate candles.

Use upstream server-time evidence to determine closed candles and the expected
latest closed interval. Remove the current unclosed candle before selecting the
latest 500 closed candles. Fetch enough rows within bounded API limits to avoid
mistaking an open candle for a history shortage. Stale/missing latest candles,
unavailable time evidence or fewer than 500 eligible candles cannot produce a
current success result. Record source-time observation and retrieval time separately.

Production's 500-candle success gate is distinct from mathematical warm-up:
small deterministic fixtures may test pure formulas at their stated minima.
All calculated values and patterns cover this rolling window only. Their seed,
status/history and pattern counts are not lifetime market observations.

## RSI(14) and ATR(14)

Compute oldest to newest, without intermediate display rounding. For either
smoothed average, seed with the arithmetic mean of the first 14 observations;
subsequent RMA = (previous RMA * 13 + current observation) / 14.

### RSI

- For each consecutive close pair: delta = close[t] - close[t-1],
  gain = max(delta, 0), loss = max(-delta, 0).
- Seed average gain/loss from 14 deltas, requiring at least 15 closes.
- If both averages are zero, RSI = 50 (explicit MAOC convention).
- If loss alone is zero, RSI = 100; if gain alone is zero, RSI = 0.
- Otherwise RSI = 100 - 100 / (1 + averageGain / averageLoss).
- Warm-up values are unavailable, not zero. Recompute from the window's seed.

### ATR

- First True Range (TR) = high[0] - low[0].
- Later TR = max(high-low, abs(high-previousClose), abs(low-previousClose)).
- Seed ATR from the first 14 TR values; apply the same RMA recurrence thereafter.
- ATR is price-unit volatility, not a direction prediction or execution signal.

Report seed/window/rule version. No promise of exact agreement with platforms
that use different input windows, initialization, rounding or symbol feeds.

## Confirmed swings and structure

Use **2-left / 2-right** closed candles. A Swing High is strictly higher than
all four neighboring highs; a Swing Low is strictly lower than all four lows.
Equal highs/lows fail the corresponding swing condition. A candle satisfying
both conditions may carry both independently; neither creates a trading signal.

Confirmation occurs only at the close of the second right candle. Retain both
pivot time and confirmation time. Never label a pivot confirmed in an earlier
historical prefix or use unclosed/future data. Window edges without both sides
are not confirmed pivots.

Compare the latest two confirmed highs and latest two confirmed lows:

| Available relationships | Structure label |
| --- | --- |
| Higher high and higher low | Uptrend |
| Lower high and lower low | Downtrend |
| Mixed directions or equal values | Mixed |
| Fewer than two confirmed highs or two confirmed lows | Insufficient structure |

These are explicitly defined MAOC structural labels, not buy/sell instructions.

## Three-candle FVG

For consecutive closed candles A, B, C:

- Bullish: Low(C) > High(A); bounds [High(A), Low(C)].
- Bearish: High(C) < Low(A); bounds [High(C), Low(A)].
- Equal boundaries are not a gap. No extra middle-candle size/displacement filter.
- Formation/availability is C's close; evaluate interaction from the next candle.
- Open: no later interaction. Touched: a later wick reaches the near gap boundary.
- Filled: a later wick reaches or passes the far boundary (bullish lower bound;
  bearish upper bound). An overshoot can transition directly to Filled.
- Boundary equality counts as interaction. Filled takes precedence over Touched.
  Record first touch/fill times without changing the original formation time.

These geometric events do not establish order-flow imbalance, profitability or
that a gap must eventually fill. No probability or confidence score is invented.

## Swing zones

Use names **Swing Demand Zone** and **Swing Supply Zone**, not Order Block:

- Demand from a confirmed Swing Low: [low, min(open, close)] of its pivot candle.
- Supply from a confirmed Swing High: [max(open, close), high] of its pivot candle.
- Skip zero-width zones. Publish only after swing confirmation, with pivot and
  confirmation times. Nothing is claimed visible before confirmation.
- A later candle wick reaching the zone marks Touched, including boundary equality.
- Demand is Invalidated by a later close strictly below its lower bound;
  Supply by a later close strictly above its upper bound. Boundary equality alone
  does not invalidate. Invalidated takes precedence over Touched and is terminal.
- Scan candles after the pivot, including the two confirmation candles. A zone
  already invalidated before confirmation is never returned as active. Any
  earlier interaction is retrospective and must retain its actual timestamp.

Zone geometry is deterministic reference data, not evidence of actual resting
orders, institutional activity or a permission to trade.

## Cache, failures and bounded output

- Cache by source, symbol, timeframe and rule version. Memory only; no persistence
  migration, autonomous polling, multi-market prefetch or mission resubmission.
- Reuse only validated success results, at most 60 seconds and never beyond a new
  candle boundary. Cache hits retain original retrieval/source/candle times.
- When refreshing, keep the upstream cancellation/deadline and bounded parse rules.
  Rate limiting honors Retry-After; no tight retry loops or hidden source switching.
- Classify unavailable/restricted source, timeout/cancel, rate limit, invalid data,
  insufficient history and stale data explicitly. Never return old analysis as
  current success. If a prior snapshot is shown, label it Stale with its original
  timestamps; failure is still visible and it is not fed back as current evidence.
- Tool output contains summary numbers, structure label, bounded recent pattern
  lists and provenance: source, symbol, timeframe, retrieval/source times, latest
  closed candle, candle count, cache/freshness state and analysis-rule version.
- Do not send all 500 OHLCV rows to the model. Compute patterns across the full
  validated window before truncating displayed lists. Declare ordering, total
  in-window counts, returned counts and truncation. Distinguish active/filled/
  invalidated states; filtered-out records must not silently change totals.
- Select stable list caps and machine-readable error/field names during the
  implementation design, document them and test the existing 50,000-character
  executor ceiling. These are bounded engineering details, not new user questions
  unless they require an architecture, permission or scope change.
- Keep numeric results finite; avoid fabricated confidence, P&L, trade execution,
  buy/sell directives, provider-health assertions or stale-as-live labels.

## Public test seams and acceptance

| Seam | Required evidence | Not established by this test |
| --- | --- | --- |
| Pure calculation interface | Hand-worked literal fixtures for RSI/RMA/ATR, flat/up/down cases, warm-up, strict/tied swings, structure, FVG/zone boundaries and lifecycle. | Network access or predictive quality. |
| Source adapter with injected transport/time | Exactly 500 closed consecutive candles; open candle removal; expected-last-candle checks; invalid OHLCV/timestamps, gaps, duplicates, insufficient rows, timeout/cancellation and response bounds. | Deployment-source availability. |
| Cache/clock boundary | TTL, before/at/after close boundary, source-time failure, distinct cache keys, stale failure not success, rate-limit backoff without a retry storm. | Live exchange latency or uptime. |
| ToolExecutor.list/execute | HAWK-only access after explicit implementation grant; all other Agents and disabled tools denied before network; strict inputs, bounded output; original ticker contract unchanged. | Grant approval from this specification. |
| Deterministic workflow integration | Actual computed result reaches HAWK model context; forwarded reports do not grant tools; no orders/automatic retries/paid inference. | Model analysis correctness or paid-provider acceptance. |
| Isolated optional live read | Bounded public server-time/klines check from deployment network after explicit approval, no credentials. Record supported symbols/access or restriction honestly. | Paid inference, trading access or production-host/device acceptance. |

Use known expected literals, not a test that simply repeats the implementation.
Prefix tests must prove future candles never retroactively move confirmation earlier.
Patterns near the 500-candle boundary and different formation/confirmation times
need explicit fixtures. Verify byte/character ceilings with maximum-size results.

## Later implementation slices and exit gates

After D.3 and D.4, obtain implementation approval; retain stage checkpoints:

1. **Data + indicators:** bounded source/time adapter, validation/cache, RSI/ATR,
   independent fixtures and integration design; no implicit additional Agent grants.
2. **Structure + patterns:** confirmed swings/structure, FVG and zones using these
   exact rules, with look-ahead/lifecycle/window/truncation tests.
3. **HAWK integration + acceptance:** register the analysis tool and explicitly
   configure HAWK only, retain ticker/other Agents, verify deterministic workflow
   and regression suites, optional approved public connectivity check.

Expected ownership: a focused server/src/marketStructure.js calculation boundary,
a separately bounded data adapter if needed, existing server/src/toolExecutor.js
and the actual Agent metadata/grant owners. Module/file names are design proposals,
not permission for unrelated refactors. Use existing Node tests; rerun Node/build/
syntax/Chromium baselines at the relevant integration gate and update PLAN.md.

Ask only about decisions that materially change existing architecture, permissions,
cost/external actions, safety or approved scope. Resolve ordinary implementation
details from existing conventions, record assumptions, and preserve checkpoints.