/**
 * public/js/wpr.js - Renders the WPR positions page from /api/wpr/feed.
 *
 * Fixed parts: movers strip, stat strip, latest video line. The holdings block
 * has four views (table, bars, then and now, WPR vs Drew) chosen by a switch
 * and remembered in localStorage. The comparison view also reads /api/live-portfolio.
 */
(function () {
  'use strict';

  /** Short human label for a video-disclosed decision status. */
  var LABEL = {
    new_starter_position: 'New', trimmed_still_held: 'Trimmed', sold: 'Sold',
    sold_remaining_position: 'Sold', added_still_held: 'Added', held: 'Held',
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function fix(n) { return Number(n).toFixed(1); }
  function sign(n) { return (n > 0 ? '+' : '') + fix(n); }
  function decision(h) { return h.disclosed_decision ? h.disclosed_decision.status : null; }
  function label(h) { return LABEL[decision(h)] || (decision(h) ? decision(h).replace(/_/g, ' ') : ''); }
  function changeText(h) {
    if (h.change_pct == null) return '<span class="mut">new</span>';
    if (h.change_pct === 0) return '<span class="mut">0.0</span>';
    return '<span class="' + (h.change_pct > 0 ? 'pos' : 'neg') + '-t">' + sign(h.change_pct) + '</span>';
  }

  /** Movers strip: disclosed decisions first; Weight Up falls back to the largest gains. */
  function renderMovers(cur) {
    var ins = cur.holdings.filter(function (h) { return /new/.test(decision(h) || ''); });
    var outs = cur.departed.filter(function (d) { return /sold/.test(decision(d) || ''); });
    var trims = cur.holdings.filter(function (h) { return /trim/.test(decision(h) || ''); });
    var adds = cur.holdings.filter(function (h) { return /added/.test(decision(h) || ''); });
    var gains = cur.holdings.filter(function (h) { return h.change_pct > 0; })
      .sort(function (a, b) { return b.change_pct - a.change_pct; }).slice(0, 2);
    function mv(tk, big, path) {
      return '<div class="mv"><span class="tk">' + esc(tk) + '</span><span><span class="big">' + big + '</span> <span class="path">' + esc(path) + '</span></span></div>';
    }
    function block(h, cls, items, note) {
      return '<div class="block"><div class="h ' + cls + '">' + h + '</div>' + (items.length ? items.join('') : '<div class="none">none</div>') + (note ? '<div class="note">' + note + '</div>' : '') + '</div>';
    }
    var upItems = adds.length ? adds : gains;
    return '<div class="movers">'
      + block('In', 'pos', ins.map(function (h) { return mv(h.ticker, fix(h.weight_pct), 'starter'); }))
      + block('Out', 'neg', outs.map(function (d) { return mv(d.ticker, '0', 'from ' + fix(d.previous_weight_pct)); }))
      + block(adds.length ? 'Added to' : 'Weight up', 'pos', upItems.map(function (h) { return mv(h.ticker, sign(h.change_pct), fix(h.previous_weight_pct) + ' to ' + fix(h.weight_pct)); }), adds.length ? '' : 'largest gains, no add disclosed')
      + block('Trimmed', 'neg', trims.map(function (h) { return mv(h.ticker, sign(h.change_pct), fix(h.previous_weight_pct) + ' to ' + fix(h.weight_pct)); }))
      + '</div>';
  }

  /** Stat strip from the slide's reported metrics, with the prior week beside each. */
  function renderStats(cur, prev) {
    var m = cur.reported_metrics || {}, p = (prev && prev.reported_metrics) || {};
    function stat(l, key, plus) {
      if (m[key] == null) return '';
      var v = (plus && m[key] > 0 ? '+' : '') + m[key];
      var pv = p[key] == null ? '' : 'from ' + (plus && p[key] > 0 ? '+' : '') + p[key] + '%';
      return '<div class="stat"><span class="l">' + l + '</span><span class="v">' + v + '%</span><span class="d">' + pv + '</span></div>';
    }
    return '<div class="stats">' + stat('YTD', 'ytd_return_pct', true) + stat('Top 4', 'top_4_pct') + stat('Top 5', 'top_5_pct') + stat('Top 10', 'top_10_pct') + stat('Foreign tech', 'foreign_listed_tech_pct') + stat('Cash', 'cash_pct') + '</div>';
  }

  function renderTable(cur) {
    var rows = cur.holdings.map(function (h, i) {
      return '<tr><td class="rank">' + (i + 1) + '</td><td class="tk">' + esc(h.ticker) + '</td><td class="nm">' + esc(h.company_name) + '</td><td class="r w">' + fix(h.weight_pct) + '</td><td class="r mut">' + (h.previous_weight_pct == null ? '' : fix(h.previous_weight_pct)) + '</td><td class="r">' + changeText(h) + '</td><td class="mut">' + esc(label(h)) + '</td></tr>';
    }).concat(cur.departed.map(function (d) {
      return '<tr class="ghost"><td></td><td class="tk">' + esc(d.ticker) + '</td><td class="nm">' + esc(d.company_name) + '</td><td class="r w">' + fix(d.previous_weight_pct) + '</td><td class="r">' + fix(d.previous_weight_pct) + '</td><td class="r">out</td><td>' + esc(label(d) || 'Not on slide') + '</td></tr>';
    }));
    return '<table class="holdings"><tr><th></th><th>Ticker</th><th class="nm">Company</th><th class="r">Weight</th><th class="r">Prior</th><th class="r">Change</th><th>Decision</th></tr>' + rows.join('') + '</table>';
  }

  function renderBars(cur) {
    var max = Math.max.apply(null, cur.holdings.map(function (h) { return h.weight_pct; }));
    function pct(w) { return (w / max * 100).toFixed(2) + '%'; }
    var rows = cur.holdings.map(function (h) {
      var c = h.change_pct, cls = c > 0 ? 'pos' : c < 0 ? 'neg' : '';
      var tick = h.previous_weight_pct != null && c !== 0 ? '<span class="tick ' + cls + '" style="left:' + pct(h.previous_weight_pct) + '"></span>' : '';
      var lbl = decision(h) ? '<span class="lbl" style="left:' + pct(Math.max(h.weight_pct, h.previous_weight_pct || 0)) + '">' + esc(label(h)) + '</span>' : '';
      return '<div class="row"><div><span class="tk">' + esc(h.ticker) + '</span><span class="nm">' + esc(h.company_name) + '</span></div><div class="track"><span class="bar" style="width:' + pct(h.weight_pct) + '"></span>' + tick + lbl + '</div><div class="num"><span class="w">' + fix(h.weight_pct) + '</span><span class="c">' + changeText(h) + '</span></div></div>';
    });
    var ghosts = cur.departed.map(function (d) {
      return '<div class="row ghost"><div><span class="tk">' + esc(d.ticker) + '</span><span class="nm">' + esc(d.company_name) + '</span></div><div class="track"><span class="bar" style="width:' + pct(d.previous_weight_pct) + '"></span><span class="lbl" style="left:' + pct(d.previous_weight_pct) + '">' + esc(label(d) || 'Not on slide') + '</span></div><div class="num"><span class="w">' + fix(d.previous_weight_pct) + '</span><span class="c mut">out</span></div></div>';
    });
    return '<div class="bars">' + rows.join('') + (ghosts.length ? '<div class="divider"></div>' + ghosts.join('') : '') + '</div>';
  }

  /** Two ranked lists. Rank arrows compare position on the two slides. */
  function renderThen(cur, prev) {
    var prevHoldings = prev ? prev.holdings : [];
    var prevRank = {}, names = {};
    prevHoldings.forEach(function (h, i) { prevRank[h.ticker] = i + 1; });
    cur.holdings.concat(cur.departed).forEach(function (h) { names[h.ticker] = h.company_name; });
    var sold = {};
    cur.departed.forEach(function (d) { sold[d.ticker] = true; });
    var priorRows = prevHoldings.map(function (h, i) {
      return '<div class="r' + (sold[h.ticker] ? ' gone' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="tk">' + esc(h.ticker) + '</span><span class="nm">' + esc(names[h.ticker] || h.company_name) + '</span><span class="w">' + fix(h.weight_pct) + '</span></div>';
    });
    var nowRows = cur.holdings.map(function (h, i) {
      var isNew = h.previous_weight_pct == null, delta = isNew ? 0 : prevRank[h.ticker] - (i + 1);
      var rk = isNew ? '' : delta > 0 ? '&#9650; ' + delta : delta < 0 ? '&#9660; ' + (-delta) : '<span class="mut">&#8211;</span>';
      return '<div class="r' + (isNew ? ' new' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="tk">' + esc(h.ticker) + '</span><span class="nm">' + esc(h.company_name) + '</span><span class="w">' + fix(h.weight_pct) + '</span><span class="c">' + (isNew ? '' : changeText(h)) + '</span><span class="mvk">' + rk + '</span></div>';
    }).concat(cur.departed.map(function (d) {
      // Only visible on narrow screens, where the prior column is hidden.
      return '<div class="r gone gone-m"><span class="rk"></span><span class="tk">' + esc(d.ticker) + '</span><span class="nm">' + esc(d.company_name) + '</span><span class="w">' + fix(d.previous_weight_pct) + '</span><span class="c mut">out</span><span class="mvk"></span></div>';
    }));
    return '<div class="cols"><div class="col prior"><div class="h"><span>' + fmtDate(cur.previous_snapshot_date) + '</span><span>' + prevHoldings.length + ' positions</span></div>' + priorRows.join('') + '</div>'
      + '<div class="col now"><div class="h"><span>' + fmtDate(cur.snapshot_date) + '</span><span>weight · change · rank</span></div>' + nowRows.join('') + '</div></div>';
  }

  /** WPR beside Drew: two ranked lists, overlap tagged, weight gap on shared tickers. */
  function renderVersus(cur, live) {
    if (!live || !Array.isArray(live.stocks) || !live.stocks.length) {
      return '<div class="cols"><p class="sub" style="padding-top:12px">Live portfolio unavailable, so there is nothing to compare yet.</p></div>';
    }
    var mine = live.stocks.filter(function (s) { return s.weightPct > 0; })
      .sort(function (a, b) { return b.weightPct - a.weightPct; });
    var his = {}, names = {};
    cur.holdings.forEach(function (h) { his[h.ticker] = h.weight_pct; names[h.ticker] = h.company_name; });
    var mineSet = {};
    mine.forEach(function (s) { mineSet[s.ticker] = s.weightPct; });
    var shared = cur.holdings.filter(function (h) { return mineSet[h.ticker] != null; });
    var hisShare = shared.reduce(function (t, h) { return t + h.weight_pct; }, 0);
    var myShare = shared.reduce(function (t, h) { return t + mineSet[h.ticker]; }, 0);
    var m = live.portfolioMetrics || {};
    var summary = '<p class="sub">' + shared.length + ' shared ticker' + (shared.length === 1 ? '' : 's') + ', ' + fix(hisShare) + '% of WPR and ' + fix(myShare) + '% of Drew'
      + (m.ytdChangePct != null ? '. YTD: WPR ' + (cur.reported_metrics && cur.reported_metrics.ytd_return_pct != null ? sign(cur.reported_metrics.ytd_return_pct) : 'n/a') + '%, Drew ' + sign(m.ytdChangePct) + '%' : '') + '.</p>';

    var hisRows = cur.holdings.map(function (h, i) {
      var only = mineSet[h.ticker] == null;
      return '<div class="r' + (only ? ' only' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="tk">' + esc(h.ticker) + '</span><span class="nm">' + esc(h.company_name) + (only ? ' <span class="tag">only WPR</span>' : '') + '</span><span class="w">' + fix(h.weight_pct) + '</span></div>';
    });
    var myRows = mine.map(function (s, i) {
      var only = his[s.ticker] == null;
      var gap = only ? '' : '<span class="' + (s.weightPct - his[s.ticker] >= 0 ? 'pos' : 'neg') + '-t">' + sign(s.weightPct - his[s.ticker]) + '</span>';
      return '<div class="r' + (only ? ' only' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="tk">' + esc(s.ticker) + '</span><span class="nm">' + esc(names[s.ticker] || '') + (only ? ' <span class="tag">only Drew</span>' : '') + '</span><span class="w">' + fix(s.weightPct) + '</span><span class="c">' + gap + '</span><span class="mvk"></span></div>';
    }).concat(cur.holdings.filter(function (h) { return mineSet[h.ticker] == null; }).map(function (h) {
      // Only visible on narrow screens, where the WPR column is hidden.
      return '<div class="r gone-m only"><span class="rk"></span><span class="tk">' + esc(h.ticker) + '</span><span class="nm">' + esc(h.company_name) + ' <span class="tag">only WPR</span></span><span class="w mut">' + fix(h.weight_pct) + '</span><span class="c"></span><span class="mvk"></span></div>';
    }));
    return summary + '<div class="cols"><div class="col prior"><div class="h"><span>WPR · ' + fmtDate(cur.snapshot_date) + '</span><span>' + cur.holdings.length + ' positions</span></div>' + hisRows.join('') + '</div>'
      + '<div class="col now"><div class="h"><span>Drew · live</span><span>' + mine.length + ' positions · weight · vs WPR</span></div>' + myRows.join('') + '</div></div>';
  }

  function renderVideo(video) {
    if (!video) return '';
    var base = '/wpr/videos/' + encodeURIComponent(video.video_id);
    var links = [];
    if (video.report_path) links.push('<a href="' + base + '">Report</a>');
    if (video.transcript_path) links.push('<a href="' + base + '/transcript">Transcript</a>');
    if (video.url) links.push('<a href="' + esc(video.url) + '" target="_blank" rel="noopener">YouTube</a>');
    links.push('<a href="/wpr/videos">All videos</a>');
    return '<div class="video latest"><span class="d">' + fmtDate(video.date) + '</span><span>' + esc(video.title) + '</span><span class="links">' + links.join('') + '</span></div>';
  }

  function setView(v) {
    document.querySelectorAll('.view').forEach(function (el) { el.classList.toggle('on', el.id === 'v-' + v); });
    document.querySelectorAll('.switch .opts a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-v') === v); });
    try { localStorage.setItem('wpr-view', v); } catch (e) { /* private mode */ }
  }

  function render(feed, live) {
    var cur = feed.current;
    var app = document.getElementById('wpr-app');
    if (!cur) {
      document.getElementById('wpr-sub').textContent = 'No allocation slides published yet.';
      return;
    }
    var prev = (feed.snapshots || []).filter(function (s) { return s.snapshot_date === cur.previous_snapshot_date; })[0] || null;
    document.getElementById('wpr-sub').textContent = 'Slide of ' + fmtDate(cur.snapshot_date) + (prev ? ', compared with ' + fmtDate(prev.snapshot_date) : '');

    app.innerHTML = renderMovers(cur) + renderStats(cur, prev)
      + '<div class="switch"><span class="t">' + cur.holdings.length + ' positions</span><span class="opts"><a href="#" data-v="table">Table</a><a href="#" data-v="bars">Bars</a><a href="#" data-v="then">Then and now</a><a href="#" data-v="versus">WPR vs Drew</a></span></div>'
      + '<div class="view" id="v-table">' + renderTable(cur) + '</div>'
      + '<div class="view" id="v-bars">' + renderBars(cur) + '</div>'
      + '<div class="view" id="v-then">' + renderThen(cur, prev) + '</div>'
      + '<div class="view" id="v-versus">' + renderVersus(cur, live) + '</div>'
      + renderVideo((feed.videos || [])[0])
      + '<p class="foot">Weights from WPR\'s weekly allocation slide. Changes and rank moves include price moves. In, Out, and Trimmed come from what the video disclosed; other weight moves are observations only.</p>';

    document.querySelectorAll('.switch .opts a').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); setView(a.getAttribute('data-v')); });
    });
    var saved = null;
    try { saved = localStorage.getItem('wpr-view'); } catch (e) { /* private mode */ }
    setView(saved || 'table');
  }

  var liveRequest = fetch('/api/live-portfolio').then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
  fetch('/api/wpr/feed').then(function (res) {
    if (!res.ok) throw new Error('feed ' + res.status);
    return res.json();
  }).then(function (feed) {
    return liveRequest.then(function (live) { render(feed, live); });
  }).catch(function (err) {
    document.getElementById('wpr-sub').textContent = 'WPR feed unavailable. Run publish in the WPR project. (' + err.message + ')';
  });
})();
