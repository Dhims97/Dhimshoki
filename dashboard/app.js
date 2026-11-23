// Token Radar's dashboard (comps-2). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// inputs, token odds and net farm economics, and the validation the model earned. No network: every
// byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', verdict: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-$' : '$';
    return sign + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var m = DATA.model;
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : Math.min(100, Math.max(-50, row.change_7d)) / 100;
    var cond = Math.exp(m.intercept + m.ln_tvl * (Math.log(row.tvl_usd) - m.mean_ln_tvl) + m.growth_effective * g);
    return Math.max(1, Math.round(row.token_odds * cond));
  }
  function bandOf(row) {
    var x = DATA.validation.loo_typical_x;
    return { lo: Math.max(1, Math.round(row.implied_value_usd / x)), hi: Math.round(row.implied_value_usd * x) };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('w') === '1') state.watchlist = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.watchlist) params.set('w', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && r.farm.verdict !== state.verdict) return false;
      if (state.watchlist && !r.is_watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'net') { av = a.farm.net_usd; bv = b.farm.net_usd; }
      else if (key === 'perhour') { av = a.farm.net_per_hour_usd; bv = b.farm.net_per_hour_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model, ' + DATA.model.n_comps + ' comps' })
      )
    );
  }

  function kpiStrip() {
    var v = DATA.validation;
    var vc = DATA.verdict_counts;
    return el('section', { class: 'kpis', 'aria-label': 'Self-checks' },
      el('div', { class: 'kpi' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
      el('div', { class: 'kpi' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
      el('div', { class: 'kpi' }, el('span', { text: 'Leave-one-out error (median)' }), el('b', { text: 'x' + v.loo_typical_x.toFixed(2) + '  (MALE ' + v.loo_male + ')' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Walk-forward error (median)' }), el('b', { text: 'x' + v.wf_typical_x.toFixed(2) + '  (MALE ' + v.wf_male + ')' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Farm verdicts, base share' }), el('b', { text: vc.FARM + ' FARM / ' + vc.THIN + ' THIN / ' + vc.SKIP + ' SKIP' })),
      el('div', { class: 'kpi' }, el('span', { text: 'Error band on every value' }), el('b', { text: 'divide or multiply by ' + v.loo_typical_x.toFixed(2) }))
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, after stripping wrapped, staked, bridged and versioned products of tokens that already trade. Implied value is a model, not a promise: the typical row is wrong by about x' + DATA.validation.loo_typical_x.toFixed(2) + ', so every value carries its error band.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) + '  (' + DATA.rows[0].name + ')' })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Optimistic share (5,000 farmers)' }), el('b', { text: DATA.verdict_counts_optimistic.FARM + ' FARM / ' + DATA.verdict_counts_optimistic.THIN + ' THIN / ' + DATA.verdict_counts_optimistic.SKIP + ' SKIP' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var verdict = el('select', { id: 'verdict', 'aria-label': 'Filter by farm verdict' },
      ['all', 'FARM', 'THIN', 'SKIP'].map(function (v) { return el('option', { value: v, text: v === 'all' ? 'All verdicts' : v, selected: v === state.verdict ? 'selected' : null }); })
    );
    verdict.addEventListener('change', function () { state.verdict = verdict.value; writeHash(); render(); });
    var wl = el('label', { class: 'check' },
      el('input', { type: 'checkbox', checked: state.watchlist ? 'checked' : null, 'aria-label': 'Watchlist only' }),
      el('span', { text: 'Watchlist only' })
    );
    wl.querySelector('input').addEventListener('change', function (e) { state.watchlist = e.target.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Farm verdict' }), verdict),
      wl,
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictPill(v) {
    return el('span', { class: 'verdict v-' + v.toLowerCase(), text: v });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.verdict = 'all'; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var netClass = r.farm.net_usd >= 0 ? 'pos' : 'neg';
      var band = bandOf(r);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name + (r.is_watchlist ? '  *' : '') }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: r.token_odds.toFixed(3) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', { class: 'implied-num' },
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'sub', text: fmtUsd(band.lo) + ' - ' + fmtUsd(band.hi) })
          )
        )),
        el('td', { class: 'num ' + netClass, text: fmtMoney(r.farm.net_usd) + '  /  ' + fmtMoney(r.farm.net_per_hour_usd) + '/h' }),
        el('td', null, verdictPill(r.farm.verdict))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. * marks the watchlist. Select a row for its model, odds and farm plan. Net is expected airdrop minus gas and opportunity cost, under the stated farmer share.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Token odds'),
            sortHeader('implied', 'Implied value (+/- band)'),
            sortHeader('net', 'Net / $ per hour'),
            el('th', { scope: 'col', text: 'Farm' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var v = DATA.validation;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every row, fitted on the ' + m.n_comps + ' traded comps in this snapshot. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'ln(mcap) = ' + m.intercept.toFixed(4) + ' + ' + m.ln_tvl.toFixed(4) + ' x (ln(TVL) - ' + m.mean_ln_tvl.toFixed(4) + ') + ' + m.growth_effective.toFixed(4) + ' x growth_frac' +
        '   |   growth_frac = clamp(change_7d, -50, 100) / 100   |   implied = round(token_odds x exp(ln(mcap)))'
      ),
      el('p', { class: 'sub', text: 'The growth coefficient is negative (' + m.growth_unshrunk.toFixed(3) + ' unshrunk, x0.5 shrinkage): in this snapshot, protocols whose TVL spiked in the last 7 days carry lower mcap/TVL. TVL enters sublinearly (slope ' + m.ln_tvl.toFixed(3) + ', not 1.0): market cap grows roughly as the square root of TVL, so a flat mcap/TVL ratio would be wrong. Token odds are the shrunk peer rate of having a traded token, by age tercile x TVL tercile (global rate 0.169, k=5). That rate is cross-sectional, not a launch hazard: an old protocol still pre-token has survived many launch windows without launching, so its odds may overstate it. Age and category offsets were tested and dropped: they worsened held-out error.' }),
      el('table', { class: 'valid' },
        el('caption', { class: 'sub', text: 'Held-out validation, median absolute log error (lower is better). Typical error is the median factor by which the point estimate misses.' }),
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Model' }),
          el('th', { scope: 'col', text: 'Leave-one-out MALE' }),
          el('th', { scope: 'col', text: 'Typical error' }),
          el('th', { scope: 'col', text: 'Walk-forward MALE' }),
          el('th', { scope: 'col', text: 'Typical error' })
        )),
        el('tbody', null,
          el('tr', null, el('td', { text: 'comps-2 (this board)' }), el('td', { class: 'num', text: String(v.loo_male) }), el('td', { class: 'num', text: 'x' + v.loo_typical_x.toFixed(2) }), el('td', { class: 'num', text: String(v.wf_male) }), el('td', { class: 'num', text: 'x' + v.wf_typical_x.toFixed(2) })),
          el('tr', null, el('td', { text: 'Starter (TVL x 0.25 x growth x maturity)' }), el('td', { class: 'num', text: String(v.starter_loo_male) }), el('td', { class: 'num', text: 'x' + Math.exp(v.starter_loo_male).toFixed(2) }), el('td', { class: 'num', text: String(v.starter_wf_male) }), el('td', { class: 'num', text: 'x' + Math.exp(v.starter_wf_male).toFixed(2) })),
          el('tr', null, el('td', { text: 'TVL-only (constant median mcap/TVL)' }), el('td', { class: 'num', text: String(v.tvl_only_loo_male) }), el('td', { class: 'num', text: 'x' + Math.exp(v.tvl_only_loo_male).toFixed(2) }), el('td', { class: 'num', text: String(v.tvl_only_wf_male) }), el('td', { class: 'num', text: 'x' + Math.exp(v.tvl_only_wf_male).toFixed(2) }))
        )
      ),
      el('p', { class: 'sub', text: 'Farm economics, labelled assumptions (not snapshot data): capital $250 / $150 / $100 / $50 by TVL tier; gas per transaction by first chain (Ethereum $4.00, most L2s $0.30, Solana $0.02, default $1.00); transactions 2 setup + 1 a week + 1 claim; hold 60 / 45 / 30 days by age; opportunity cost 5% APR on capital; expected airdrop = token odds x conditional mcap x 0.00000375 (7.5% of implied value to the community, split among 20,000 farmers). FARM needs net >= $50 and >= $20/hour; THIN is net > $0; the rest is SKIP. The base share gives 0 FARM rows: Ethereum gas alone (about $32-40 a farm) beats the expected value of most rows. The optimistic view splits the same pool among 5,000 farmers instead, which gives ' + DATA.verdict_counts_optimistic.FARM + ' FARM / ' + DATA.verdict_counts_optimistic.THIN + ' THIN / ' + DATA.verdict_counts_optimistic.SKIP + ' SKIP. Break-even implied value is shown on every row so a reader can substitute their own share.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var band = bandOf(row);
    var recomputed = impliedOf(row);
    var f = row.farm;
    var fo = row.farm_optimistic;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.is_watchlist ? '  ·  watchlist' : '  ·  early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Conditional mcap (if it launches)' }), el('b', { class: 'num', text: fmtUsd(row.conditional_mcap_usd) })),
        el('div', null, el('span', { text: 'Token odds (' + row.odds_cell + ')' }), el('b', { class: 'num', text: row.token_odds.toFixed(3) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Error band (typical x' + DATA.validation.loo_typical_x.toFixed(2) + ')' }), el('b', { class: 'num', text: fmtUsd(band.lo) + ' - ' + fmtUsd(band.hi) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Capital / hold / transactions' }), el('b', { class: 'num', text: '$' + f.capital_usd + ' / ' + f.hold_days + 'd / ' + f.tx_count + ' tx' })),
        el('div', null, el('span', { text: 'Gas + opportunity cost' }), el('b', { class: 'num', text: fmtMoney(f.gas_usd) + ' + ' + fmtMoney(f.opp_cost_usd) + ' = ' + fmtMoney(f.total_cost_usd) })),
        el('div', null, el('span', { text: 'Time' }), el('b', { class: 'num', text: f.time_hours + ' hours' })),
        el('div', null, el('span', { text: 'Expected airdrop (base share)' }), el('b', { class: 'num', text: fmtMoney(f.expected_airdrop_usd) })),
        el('div', null, el('span', { text: 'Net / per hour (base share)' }), el('b', { class: 'num', text: fmtMoney(f.net_usd) + ' / ' + fmtMoney(f.net_per_hour_usd) + '/h' })),
        el('div', null, el('span', { text: 'Break-even implied value' }), el('b', { class: 'num', text: fmtUsd(f.break_even_implied_usd) })),
        el('div', null, el('span', { text: 'Verdict (base share)' }), verdictPill(f.verdict)),
        el('div', null, el('span', { text: 'Verdict (5,000-farmer share)' }), verdictPill(fo.verdict))
      ),
      el('p', { class: 'sub', text: 'Break-even is the implied value at which this farm pays for itself: ' + fmtUsd(f.break_even_implied_usd) + ' against this row\u2019s ' + fmtUsd(row.implied_value_usd) + '. The base share assumes 7.5% of implied value to the community split among 20,000 farmers; the optimistic view splits it among 5,000.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(kpiStrip());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
