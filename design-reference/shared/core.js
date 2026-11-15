/*
 * Shared mockup harness. Each mockup defines window.MOCKUP = { id, name, spec, defaultTheme,
 * render(ctx, screen) -> html, skeleton?(ctx, screen) -> html, after?(root, ctx, screen) }
 * and this file owns: data derivation, formatters, SVG charts, the toolbar, and the
 * generic interactions (chips, keypad, filters, search, screen links).
 */
(function () {
  const S = window.SNAPSHOT;
  const TZ = S.user.timezoneOffset;

  /* ---------- formatters ---------- */
  const nf2 = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
  const peso = (n, { sign = false, dp = 2 } = {}) => {
    const s = (dp === 0 ? nf0 : nf2).format(Math.abs(n));
    const pre = n < 0 ? "−" : sign && n > 0 ? "+" : "";
    return `${pre}₱${s}`;
  };
  const pesoK = (n) => (Math.abs(n) >= 1000 ? `₱${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `₱${Math.round(n)}`);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const localDate = (iso) => new Date(new Date(iso).getTime() - TZ * 60000);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthName = (key, short) => { const m = MONTHS[Number(key.slice(5, 7)) - 1]; return short ? m.slice(0, 3) : m; };
  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const icon = (name, cls = "") => `<i data-lucide="${kebab(name)}" class="${cls}" aria-hidden="true"></i>`;

  const EMOJI = {
    "Food & Dining": "🍜", Transportation: "🛺", Housing: "🏠", Utilities: "💡", Entertainment: "🎬", Shopping: "🛍️",
    Healthcare: "🩺", "Personal Care": "🧴", "Other Expense": "📦", Fun: "🏓", Pet: "🐶", "Family Contributions": "👨‍👩‍👧",
    Church: "⛪", Groceries: "🛒", "Home Supplies": "🧽", Subscriptions: "📺", Travel: "✈️",
    Salary: "💼", Freelance: "💻", Investments: "📈", "Side Business": "🏪", "Other Income": "💰",
  };

  /* ---------- derived data ---------- */
  const build = (empty) => {
    const [y, m] = S.month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prior = S.monthly.slice(0, -1).filter((x) => x.expense > 0);
    // No BudgetPlan saved for this month: the mockups use the 5-month average as a sample target.
    const budget = Math.round(prior.reduce((s, x) => s + x.expense, 0) / prior.length / 1000) * 1000;
    const catsByName = Object.fromEntries(S.categories.map((c) => [c.name, c]));
    const labelsByName = Object.fromEntries(S.labels.map((l) => [l.name, l]));

    const tm = empty ? { income: 0, expense: 0, byCategory: [], byLabel: [], byCard: [] } : S.thisMonth;
    const txns = (empty ? [] : S.transactions).map((t) => ({ ...t, time: localDate(t.date).toISOString().slice(11, 16), emoji: EMOJI[t.category.name] ?? "•" }));
    const daily = empty ? [] : S.daily;

    // Group by local day.
    const groups = [];
    for (const t of txns) {
      const d = localDate(t.date);
      const key = d.toISOString().slice(0, 10);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, date: d, label: `${DAYS[d.getUTCDay()]}, ${monthName(key, true)} ${d.getUTCDate()}`, short: `${monthName(key, true)} ${d.getUTCDate()}`, weekday: DAYS[d.getUTCDay()], day: d.getUTCDate(), items: [], out: 0, in: 0 };
        groups.push(g);
      }
      g.items.push(t);
      if (t.type === "EXPENSE") g.out += t.amount; else g.in += t.amount;
    }

    // Cumulative spend per day vs straight-line pace.
    const cum = [];
    let run = 0;
    const byDay = Object.fromEntries(daily.map((d) => [Number(d.date.slice(8, 10)), d.total]));
    for (let d = 1; d <= daysInMonth; d++) { run += byDay[d] ?? 0; cum.push({ day: d, spent: run, daySpend: byDay[d] ?? 0, pace: (budget / daysInMonth) * d }); }

    // Weeks (Mon-Sun) within the month, for honest encouraging copy.
    const weekPace = (budget / daysInMonth) * 7;
    const weeks = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (d === 1 || dow === 1) weeks.push({ start: d, end: d, spent: 0 });
      const w = weeks[weeks.length - 1]; w.end = d; w.spent += byDay[d] ?? 0;
    }
    const fullWeeks = weeks.filter((w) => w.end - w.start === 6).map((w) => ({ ...w, under: weekPace - w.spent }));
    const bestWeek = fullWeeks.slice().sort((a, b) => b.under - a.under)[0];

    const spent = tm.expense, income = tm.income;
    const remaining = budget - spent;
    const catTotal = tm.byCategory.reduce((s, c) => s + c.total, 0) || 1;
    const byCategory = tm.byCategory.map((c) => ({ ...c, pct: c.total / catTotal, emoji: EMOJI[c.name] ?? "•", icon: c.icon, spark: S.categoryMonthly[c.name] ?? [] }));
    const monthly = S.monthly.map((x) => ({ ...x, label: monthName(x.month, true), net: x.income - x.expense, empty: x.income === 0 && x.expense === 0 }));
    const prev = S.monthly[S.monthly.length - 2];

    const lastDay = groups[0]?.date.getUTCDate() ?? 0;
    const attrs = (t) => {
      const d = localDate(t.date).getUTCDate();
      const range = ["month", ...(lastDay - d < 7 ? ["week"] : []), ...(d === lastDay ? ["today"] : [])].join("|");
      return `data-row data-text="${esc([t.description, t.category.name, ...t.labels.map((l) => l.name), t.amount].join(" "))}" data-cat="${esc(t.category.name)}" data-labels="${esc(t.labels.map((l) => l.name).join("|"))}" data-card="${esc(t.card?.name ?? "Cash")}" data-range="${range}" data-type="${t.type}"`;
    };
    const order = (names, pool) => [...names.map((n) => pool.find((c) => c.name === n)).filter(Boolean), ...pool.filter((c) => !names.includes(c.name))];
    const expensePool = S.categories.filter((c) => c.type === "EXPENSE");
    const quickCats = order(S.quick.expenseCategories, expensePool);
    const quickLabels = order(S.quick.labels, S.labels);
    const usedCats = [...new Set(txns.map((t) => t.category.name))];
    const usedLabels = [...new Set(txns.flatMap((t) => t.labels.map((l) => l.name)))];

    return {
      empty, raw: S, attrs, quickCats, quickLabels, usedCats, usedLabels, lastDay, peso, pesoK, esc, icon, monthName,
      firstName: S.user.firstName,
      month: S.month, monthLabel: empty ? "October 2026" : `${monthName(S.month)} ${y}`, monthShort: monthName(S.month, true),
      daysInMonth, budget, spent, income, net: income - spent, remaining, over: remaining < 0,
      usedPct: budget ? spent / budget : 0,
      vsPrev: prev ? spent - prev.expense : 0, prevLabel: prev ? monthName(prev.month) : "",
      byCategory, byLabel: tm.byLabel.map((l) => ({ ...l, color: l.color ?? labelsByName[l.name]?.color })), byCard: tm.byCard,
      cards: S.cards, groups, txns, cum, weeks, fullWeeks, bestWeek, weekPace, monthly,
      txnCount: tm.byCategory.reduce((s, c) => s + c.count, 0),
      quick: S.quick, categories: S.categories, labels: S.labels, catsByName, labelsByName, EMOJI,
      expenseCats: S.categories.filter((c) => c.type === "EXPENSE"), incomeCats: S.categories.filter((c) => c.type === "INCOME"),
      biggest: txns.filter((t) => t.type === "EXPENSE").slice().sort((a, b) => b.amount - a.amount)[0],
      top: byCategory[0],
    };
  };

  /* ---------- SVG charts (colors via args or CSS vars) ---------- */
  const charts = {
    donut(segs, { size = 180, thick = 22, gap = 1.5, track = "var(--track)", label = "" } = {}) {
      const r = (size - thick) / 2, c = 2 * Math.PI * r, total = segs.reduce((s, x) => s + x.value, 0) || 1;
      let off = 0;
      const arcs = segs.map((s) => {
        const len = (s.value / total) * c;
        const a = `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(len - gap, 0.1)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(s.name ?? "")}</title></circle>`;
        off += len; return a;
      }).join("");
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}"><circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${track}" stroke-width="${thick}"/>${arcs}</svg>`;
    },
    bars(monthly, { w = 520, h = 180, inc = "var(--income)", exp = "var(--expense)", grid = "var(--grid)", text = "var(--muted)", radius = 3, gapIn = 3, labels = true, font = "inherit" } = {}) {
      const max = Math.max(...monthly.flatMap((m) => [m.income, m.expense]), 1) * 1.08;
      const pad = labels ? 22 : 4, cw = w / monthly.length, bw = Math.min(22, cw / 3);
      const y = (v) => (h - pad) - (v / max) * (h - pad - 6);
      const lines = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" x2="${w}" y1="${y(max * f / 1.08)}" y2="${y(max * f / 1.08)}" stroke="${grid}" stroke-width="1"/>`).join("");
      const bars = monthly.map((m, i) => {
        const cx = i * cw + cw / 2;
        const b = (v, x, col) => v > 0 ? `<rect x="${x}" y="${y(v)}" width="${bw}" height="${(h - pad) - y(v)}" rx="${radius}" fill="${col}"><title>${m.label} ${col === inc ? "income" : "spent"} ${peso(v)}</title></rect>` : "";
        return b(m.income, cx - bw - gapIn / 2, inc) + b(m.expense, cx + gapIn / 2, exp) +
          (m.empty ? `<text x="${cx}" y="${h - pad - 6}" text-anchor="middle" font-size="10" fill="${text}">no data</text>` : "") +
          (labels ? `<text x="${cx}" y="${h - 6}" text-anchor="middle" font-size="11" fill="${text}" font-family="${font}">${m.label}</text>` : "");
      }).join("");
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="display:block;overflow:visible" role="img" aria-label="Income and spending, last 6 months">${lines}${bars}</svg>`;
    },
    burn(cum, budget, { w = 520, h = 160, line = "var(--accent)", pace = "var(--muted)", fill = "var(--accent-soft)", over = "var(--expense)", stroke = 2.5 } = {}) {
      if (!cum.length) return "";
      const max = Math.max(budget, cum[cum.length - 1].spent) * 1.08;
      const x = (d) => ((d - 1) / (cum.length - 1)) * w, y = (v) => h - (v / max) * h;
      const pts = cum.map((c) => `${x(c.day).toFixed(1)},${y(c.spent).toFixed(1)}`).join(" ");
      const overDay = cum.find((c) => c.spent > budget);
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="display:block;overflow:visible" role="img" aria-label="Cumulative spending against budget">
        <polygon points="0,${h} ${pts} ${w},${h}" fill="${fill}"/>
        <line x1="0" y1="${y(budget)}" x2="${w}" y2="${y(budget)}" stroke="${over}" stroke-dasharray="4 4" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="${h}" x2="${w}" y2="${y(budget)}" stroke="${pace}" stroke-dasharray="2 4" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <polyline points="${pts}" fill="none" stroke="${line}" stroke-width="${stroke}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${overDay ? `<circle cx="${x(overDay.day)}" cy="${y(overDay.spent)}" r="4" fill="${over}"/>` : ""}
      </svg>`;
    },
    spark(vals, { w = 80, h = 22, color = "currentColor", fill = "none", dot = true } = {}) {
      if (!vals.length) return "";
      const max = Math.max(...vals, 1), x = (i) => (i / (vals.length - 1)) * (w - 4) + 2, y = (v) => h - 2 - (v / max) * (h - 4);
      const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${fill !== "none" ? `<polygon points="2,${h} ${pts} ${w - 2},${h}" fill="${fill}"/>` : ""}<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>${dot ? `<circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="2" fill="${color}"/>` : ""}</svg>`;
    },
    dayBars(cum, { w = 300, h = 40, color = "var(--accent)", hi = "var(--expense)", limit } = {}) {
      const max = Math.max(...cum.map((c) => c.daySpend), 1), bw = w / cum.length;
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">${cum.map((c, i) => { const bh = (c.daySpend / max) * h; return `<rect x="${i * bw + 0.5}" y="${h - bh}" width="${bw - 1}" height="${bh}" fill="${limit && c.daySpend > limit ? hi : color}"/>`; }).join("")}</svg>`;
    },
  };

  /* ---------- harness ---------- */
  const SCREENS = [["dashboard", "Dashboard"], ["transactions", "Transactions"], ["quickadd", "Quick add"], ["report", "Monthly report"]];
  const state = { screen: "dashboard", view: "fit", theme: null, data: "live" };
  try { Object.assign(state, JSON.parse(localStorage.getItem("mock-state") || "{}")); } catch { /* private mode */ }
  const params = new URLSearchParams(location.search);
  for (const k of ["screen", "view", "theme", "data"]) if (params.get(k)) state[k] = params.get(k);

  const seg = (name, opts, cur) => `<div class="h-seg" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-h="${name}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;

  const specHtml = (sp) => `
    <h2>${esc(window.MOCKUP.name)}</h2><p class="h-lede">${esc(sp.summary)}</p>
    <h3>Palette</h3><div class="h-sw">${sp.palette.map(([n, l, d]) => `<div><span style="background:${l}"></span>${d ? `<span style="background:${d}"></span>` : ""}<b>${esc(n)}</b><code>${l}${d ? ` / ${d}` : ""}</code></div>`).join("")}</div>
    <h3>Type</h3><p>${sp.type}</p>
    <h3>Spacing and radius</h3><p>${sp.space}</p>
    <h3>Optimizes for</h3><p>${sp.optimizes}</p>
    <h3>Trade-offs</h3><p>${sp.tradeoffs}</p>
    <h3>Implementation effort: ${esc(sp.effort[0])}</h3><p>${sp.effort[1]}</p>`;

  const mount = () => {
    const M = window.MOCKUP;
    if (!state.theme || !["light", "dark"].includes(state.theme)) state.theme = M.defaultTheme || "light";
    document.body.insertAdjacentHTML("afterbegin", `
      <header class="h-bar">
        <a class="h-home" href="index.html" aria-label="Back to gallery">← Gallery</a>
        <span class="h-name">${esc(M.name)}</span>
        <div class="h-ctrls">
          ${seg("screen", SCREENS, state.screen)}
          ${seg("view", [["fit", "Fit"], ["desktop", "1440"], ["mobile", "390"]], state.view)}
          ${seg("theme", [["light", "Light"], ["dark", "Dark"]], state.theme)}
          ${seg("data", [["live", "Sep data"], ["empty", "Empty"], ["loading", "Loading"]], state.data)}
          <button type="button" class="h-spec-btn" aria-expanded="false" aria-controls="h-spec">Spec</button>
        </div>
      </header>
      <aside id="h-spec" class="h-spec" hidden>${specHtml(M.spec)}</aside>
      <div class="h-viewport"><div class="h-frame"><div class="m" id="stage"></div></div></div>`);
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    render();
  };

  const render = () => {
    const M = window.MOCKUP, stage = document.getElementById("stage");
    try { localStorage.setItem("mock-state", JSON.stringify(state)); } catch { /* ignore */ }
    document.querySelectorAll("[data-h]").forEach((b) => b.setAttribute("aria-pressed", String(state[b.dataset.h] === b.dataset.v)));
    document.documentElement.dataset.view = state.view;
    stage.dataset.theme = state.theme;
    document.documentElement.dataset.mtheme = state.theme;
    const ctx = { ...build(state.data === "empty"), charts, screen: state.screen, loading: state.data === "loading" };
    stage.innerHTML = ctx.loading && M.skeleton ? M.skeleton(ctx, state.screen) : M.render(ctx, state.screen);
    stage.querySelectorAll(`[data-goto="${state.screen}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": M.iconStroke ?? 1.75 } });
    M.after?.(stage, ctx, state.screen);
    stage.closest(".h-frame").scrollTop = 0;
  };

  /* ---------- generic interactions inside the stage ---------- */
  const applyFilters = (root) => {
    const q = (root.querySelector("[data-search]")?.value ?? "").trim().toLowerCase();
    const active = [...root.querySelectorAll("[data-filter][aria-pressed='true']")].map((b) => b.dataset.filter.split(":"));
    root.querySelectorAll("[data-row]").forEach((r) => {
      const okQ = !q || r.dataset.text.toLowerCase().includes(q);
      const okF = active.every(([k, v]) => (r.dataset[k] ?? "").split("|").includes(v));
      r.hidden = !(okQ && okF);
    });
    root.querySelectorAll("[data-group]").forEach((g) => { g.hidden = !g.querySelector("[data-row]:not([hidden])"); });
    const none = root.querySelector("[data-noresults]");
    if (none) none.hidden = !!root.querySelector("[data-row]:not([hidden])");
  };

  const onClick = (e) => {
    const h = e.target.closest("[data-h]");
    if (h) { state[h.dataset.h] = h.dataset.v; return render(); }
    if (e.target.closest(".h-spec-btn")) {
      const p = document.getElementById("h-spec"), b = e.target.closest(".h-spec-btn");
      p.hidden = !p.hidden; b.setAttribute("aria-expanded", String(!p.hidden)); return;
    }
    const stage = document.getElementById("stage");
    const go = e.target.closest("[data-goto]");
    if (go) { e.preventDefault(); state.screen = go.dataset.goto; return render(); }
    const tt = e.target.closest("[data-theme-toggle]");
    if (tt) { state.theme = state.theme === "dark" ? "light" : "dark"; return render(); }
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const group = chip.closest("[data-chips]"), multi = group?.dataset.chips === "multi";
      const on = chip.getAttribute("aria-pressed") !== "true";
      if (!multi) group?.querySelectorAll("[data-chip]").forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", String(multi ? on : true));
      window.MOCKUP.onChip?.(stage, chip);
      return;
    }
    const f = e.target.closest("[data-filter]");
    if (f) { f.setAttribute("aria-pressed", String(f.getAttribute("aria-pressed") !== "true")); return applyFilters(stage); }
    const k = e.target.closest("[data-key]");
    if (k) {
      const out = stage.querySelector("[data-amount]"); let v = out.dataset.raw ?? "";
      const key = k.dataset.key;
      if (key === "del") v = v.slice(0, -1);
      else if (key === ".") { if (!v.includes(".")) v = (v || "0") + "."; }
      else if (!(v.includes(".") && v.split(".")[1].length >= 2) && v.replace(".", "").length < 9) v = v === "0" ? key : v + key;
      out.dataset.raw = v;
      const [i, d] = v.split(".");
      out.textContent = v ? `₱${nf0.format(Number(i || 0))}${d !== undefined ? "." + d : ""}` : "₱0";
      out.classList.toggle("is-zero", !v);
      return;
    }
    const sv = e.target.closest("[data-save]");
    if (sv) {
      const t = stage.querySelector("[data-toast]");
      if (t) { t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2200); }
    }
  };
  const onInput = (e) => { if (e.target.matches("[data-search]")) applyFilters(document.getElementById("stage")); };

  window.Mock = { charts, peso, pesoK, esc, icon, mount, render, EMOJI };
  document.addEventListener("DOMContentLoaded", mount);
})();
