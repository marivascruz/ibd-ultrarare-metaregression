(function () {
  const DATA = window.IBD_METAREG_DATA;
  if (!DATA) {
    console.error("IBD_METAREG_DATA not loaded.");
    return;
  }

  const EXOME_ALPHA = 3.4e-7;
  const EXOME_LOG10 = -Math.log10(EXOME_ALPHA);

  const state = {
    af: "af001",
    spec: "hybrid_nonsyn",
    group: "ALL",
    model: "M7",
    pathway: "ALL",
    search: "",
    sigFilter: "all",
    sortCol: "p_M7",
    sortAsc: true,
    selectedGeneKey: "NOD2_CD",
    variantGeneKey: "NOD2_CD",
    variantXAxis: "log_am"
  };

  function getConfigKey() {
    return `${state.af}_${state.spec}`;
  }

  function fmtP(p) {
    if (p === null || p === undefined || isNaN(p)) return "—";
    if (p === 0) return "<1e-300";
    if (p < 0.001) return p.toExponential(2);
    return p.toFixed(4);
  }

  function fmtPct(r2) {
    if (r2 === null || r2 === undefined || isNaN(r2)) return "—";
    return (r2 * 100).toFixed(2) + "%";
  }

  function negLog10(p) {
    if (p === null || p === undefined || isNaN(p) || p <= 0) return 0;
    return Math.min(80, -Math.log10(Math.max(p, 1e-80)));
  }

  function getSummaryRow(cfgKey, group) {
    return DATA.summary.find(
      (r) => r.config === cfgKey && r.group === group
    );
  }

  // 1. Update KPI Banner
  function updateKPIs() {
    const cfgKey = getConfigKey();
    const grp = state.group === "ALL" ? "ALL_unique_genes" : state.group;
    const sRow = getSummaryRow(cfgKey, grp);
    const sAllPairs = getSummaryRow(cfgKey, "ALL_pairs");

    if (!sRow) return;

    const models = [
      { id: "M1", col: "sig_3_4e7_M1_LoF_only", ucol: "sig_2_5e6_M1_LoF_only" },
      { id: "M2", col: "sig_3_4e7_M2_AM_only", ucol: "sig_2_5e6_M2_AM_only" },
      { id: "M4", col: "sig_3_4e7_M4_LoF_Constraint", ucol: "sig_2_5e6_M4_LoF_Constraint" },
      { id: "M5", col: "sig_3_4e7_M5_AM_LoF", ucol: "sig_2_5e6_M5_AM_LoF" },
      { id: "M7", col: "sig_3_4e7_M7_AM_LoF_Constraint", ucol: "sig_2_5e6_M7_AM_LoF_Constraint" }
    ];

    document.getElementById("kpi-tests-val").textContent =
      (state.group === "ALL" && sAllPairs ? sAllPairs.n_tests : sRow.n_tests).toLocaleString();
    document.getElementById("kpi-tests-sub").textContent =
      `Median VIF = ${(sRow.median_vif || 1.022).toFixed(3)} (${sRow.n_tests.toLocaleString()} genes)`;

    models.forEach((m) => {
      const card = document.getElementById(`kpi-card-${m.id}`);
      if (card) {
        card.classList.toggle("active-model", state.model === m.id);
      }
      const valEl = document.getElementById(`kpi-val-${m.id}`);
      const subEl = document.getElementById(`kpi-sub-${m.id}`);
      if (!valEl || !subEl) return;
      if (state.group === "ALL" && sAllPairs) {
        valEl.textContent = `${sAllPairs[m.col]} (${sRow[m.col]})`;
        subEl.textContent = `Pairs (Unique) | p<2.5e-6: ${sAllPairs[m.ucol]}`;
      } else {
        valEl.textContent = `${sRow[m.col]}`;
        subEl.textContent = `p<3.4e-7 | p<2.5e-6: ${sRow[m.ucol]}`;
      }
    });
  }

  // 2. Render Stepwise Progression Bar Chart
  function renderProgressionChart() {
    const cfgKey = getConfigKey();
    const groups = ["IBD", "CD", "UC"];
    const colors = { IBD: "#2563eb", CD: "#e11d48", UC: "#0d9488" };
    const modelLabels = [
      "M1: LoF Only (1 df)",
      "M3: Con Only (1 df)",
      "M4: LoF+Con (2 df)",
      "M2: AM Only (1 df)",
      "M5: AM+LoF (2 df)",
      "M7: AM+LoF+Con (3 df)"
    ];
    const modelCols = [
      "sig_3_4e7_M1_LoF_only",
      "sig_3_4e7_M3_Constraint_only",
      "sig_3_4e7_M4_LoF_Constraint",
      "sig_3_4e7_M2_AM_only",
      "sig_3_4e7_M5_AM_LoF",
      "sig_3_4e7_M7_AM_LoF_Constraint"
    ];

    const traces = groups.map((g) => {
      const row = getSummaryRow(cfgKey, g);
      const yVals = modelCols.map((c) => (row ? row[c] : 0));
      return {
        x: modelLabels,
        y: yVals,
        name: g,
        type: "bar",
        marker: {
          color: colors[g],
          opacity: state.group === "ALL" || state.group === g ? 0.92 : 0.28
        },
        text: yVals.map(String),
        textposition: "outside"
      };
    });

    const layout = {
      barmode: "group",
      margin: { t: 25, r: 20, b: 65, l: 55 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      yaxis: {
        title: "Exome-Wide Significant Genes (p < 3.4e-7)",
        gridcolor: "#e2e8f0",
        zerolinecolor: "#cbd5e1"
      },
      xaxis: {
        tickangle: -14
      },
      legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
      font: { family: "Inter, sans-serif", size: 12 }
    };

    Plotly.react("plot-progression", traces, layout, { responsive: true, displayModeBar: false });
  }

  // 3. Render Unified vs Browser Scatter Plot
  function renderUnifiedVsBrowserChart() {
    const cfgKey = getConfigKey();
    const rows = (DATA.configs[cfgKey] || []).filter(
      (r) =>
        (state.group === "ALL" || r.group === state.group) &&
        (state.pathway === "ALL" || r.pathway === state.pathway)
    );
    const pCol = `p_${state.model}`;
    const r2Col = `r2_${state.model}`;

    const groups = ["CD", "UC", "IBD"];
    const colors = { IBD: "#2563eb", CD: "#e11d48", UC: "#0d9488" };

    const traces = groups.map((g) => {
      const sub = rows.filter((r) => r.group === g && r[pCol] !== null);
      return {
        x: sub.map((r) => negLog10(r.p_bro)),
        y: sub.map((r) => negLog10(r[pCol])),
        text: sub.map(
          (r) =>
            `<b>${r.gene} (${r.group})</b>${r.pathway ? " [" + r.pathway + "]" : ""}<br>` +
            `${state.model} p = ${fmtP(r[pCol])} (R² = ${fmtPct(r[r2Col])})<br>` +
            `Browser min p = ${fmtP(r.p_bro)} | VIF = ${r.vif ?? "1.02"}<br>` +
            `Variants: ${r.n_var} (pLoF: ${r.n_lof}, Mis: ${r.n_mis}, Firth: ${r.n_firth})`
        ),
        customdata: sub.map((r) => `${r.gene}_${r.group}`),
        mode: "markers",
        type: "scatter",
        name: g,
        hoverinfo: "text",
        marker: {
          color: colors[g],
          size: sub.map((r) => (r[pCol] < EXOME_ALPHA ? 9 : 6)),
          opacity: sub.map((r) => (r[pCol] < EXOME_ALPHA ? 0.9 : 0.55)),
          line: { width: 0.6, color: "#ffffff" }
        }
      };
    });

    traces.push({
      x: [0, 62],
      y: [EXOME_LOG10, EXOME_LOG10],
      mode: "lines",
      name: "Exome Threshold (3.4e-7)",
      line: { color: "#be123c", width: 1.5, dash: "dash" },
      hoverinfo: "skip"
    });
    traces.push({
      x: [EXOME_LOG10, EXOME_LOG10],
      y: [0, 42],
      mode: "lines",
      showlegend: false,
      line: { color: "#94a3b8", width: 1.2, dash: "dot" },
      hoverinfo: "skip"
    });

    const layout = {
      margin: { t: 25, r: 20, b: 55, l: 60 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      xaxis: {
        title: "Exome Browser Best Burden -log10(p) [PTV / Nsyn / Nsyn+AM]",
        gridcolor: "#e2e8f0",
        range: [-0.5, 62]
      },
      yaxis: {
        title: `Collinearity-Free Unified (${state.model}) -log10(p)`,
        gridcolor: "#e2e8f0"
      },
      legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
      font: { family: "Inter, sans-serif", size: 12 }
    };

    const plotEl = document.getElementById("plot-vs-browser");
    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });

    if (!plotEl._hasClickHandler) {
      plotEl.on("plotly_click", function (ev) {
        if (ev.points && ev.points[0] && ev.points[0].customdata) {
          state.selectedGeneKey = ev.points[0].customdata;
          document.getElementById("select-inspector-gene").value = state.selectedGeneKey;
          renderGeneInspector();
        }
      });
      plotEl._hasClickHandler = true;
    }
  }

  // 4. Populate Gene Inspector Dropdown & Render Trajectory + True 3-Moderator Partial R2
  function populateInspectorDropdown() {
    const cfgKey = getConfigKey();
    const rows = DATA.configs[cfgKey] || [];
    const sel = document.getElementById("select-inspector-gene");
    const topRows = rows.slice(0, 180);

    sel.innerHTML = "";
    topRows.forEach((r) => {
      const key = `${r.gene}_${r.group}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${r.gene} (${r.group}) — M7 p=${fmtP(r.p_M7)}, M5 p=${fmtP(r.p_M5)}, R²=${fmtPct(r.r2_M7)}`;
      sel.appendChild(opt);
    });

    if (topRows.some((r) => `${r.gene}_${r.group}` === state.selectedGeneKey)) {
      sel.value = state.selectedGeneKey;
    } else if (topRows.length > 0) {
      state.selectedGeneKey = `${topRows[0].gene}_${topRows[0].group}`;
      sel.value = state.selectedGeneKey;
    }
  }

  function renderGeneInspector() {
    const cfgKey = getConfigKey();
    const rows = DATA.configs[cfgKey] || [];
    let rec = rows.find((r) => `${r.gene}_${r.group}` === state.selectedGeneKey);
    if (!rec && rows.length > 0) {
      rec = rows[0];
      state.selectedGeneKey = `${rec.gene}_${rec.group}`;
    }
    if (!rec) return;

    const pwayObj = (DATA.pathways || []).find((p) => p.id === rec.pathway);
    const pwayBadge = pwayObj
      ? ` &nbsp;|&nbsp; <span style="color:#0f766e;font-weight:700;">${pwayObj.name}</span>`
      : "";

    document.getElementById("inspector-gene-summary").innerHTML =
      `<strong>${rec.gene}</strong> (<span class="pill-group pill-${rec.group}">${rec.group}</span>) &nbsp;|&nbsp; ` +
      `Length: <strong>${(rec.aa_len || 0).toLocaleString()} AA</strong> &nbsp;|&nbsp; ` +
      `Variants: <strong>${rec.n_var}</strong> (pLoF: ${rec.n_lof}, Missense: ${rec.n_mis}, Firth: ${rec.n_firth}, Max VIF: ${rec.vif ?? "1.02"}) &nbsp;|&nbsp; ` +
      `M5 (AM+LoF) <em>p</em> = <strong>${fmtP(rec.p_M5)}</strong> &nbsp;|&nbsp; ` +
      `M7 (AM+LoF+Con) <em>p</em> = <strong>${fmtP(rec.p_M7)}</strong> (<em>R</em>² = <strong>${fmtPct(rec.r2_M7)}</strong>)` +
      pwayBadge;

    const mLabels = [
      "M1: LoF Only",
      "M3: Con Only",
      "M4: LoF+Con",
      "M2: AM Only",
      "M5: AM+LoF",
      "M7: AM+LoF+Con"
    ];
    const pVals = [rec.p_M1, rec.p_M3, rec.p_M4, rec.p_M2, rec.p_M5, rec.p_M7];
    const r2Vals = [rec.r2_M1, rec.r2_M3, rec.r2_M4, rec.r2_M2, rec.r2_M5, rec.r2_M7];
    const yLog = pVals.map((p) => negLog10(p));

    const traceTraj = {
      x: mLabels,
      y: yLog,
      mode: "lines+markers+text",
      type: "scatter",
      name: `${rec.gene} (${rec.group}) -log10(p)`,
      line: { color: "#0f172a", width: 3 },
      marker: {
        size: 11,
        color: yLog.map((v) => (v >= EXOME_LOG10 ? "#e11d48" : "#2563eb"))
      },
      text: pVals.map((p, idx) => `p=${fmtP(p)} (${fmtPct(r2Vals[idx])})`),
      textposition: "top center"
    };

    const traceThresh = {
      x: mLabels,
      y: mLabels.map(() => EXOME_LOG10),
      mode: "lines",
      name: "p = 3.4e-7",
      line: { color: "#e11d48", width: 1.5, dash: "dash" }
    };

    const maxY = Math.max(...yLog, EXOME_LOG10) * 1.24;
    Plotly.react(
      "plot-gene-trajectory",
      [traceTraj, traceThresh],
      {
        title: { text: `${rec.gene} (${rec.group}): Collinearity-Free Stepwise -log10(p) Trajectory`, font: { size: 13 } },
        margin: { t: 40, r: 25, b: 50, l: 55 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        yaxis: { title: "-log10(Omnibus F-test p)", range: [0, maxY], gridcolor: "#e2e8f0" },
        showlegend: false,
        font: { family: "Inter, sans-serif", size: 12 }
      },
      { responsive: true, displayModeBar: false }
    );

    // True 3-Moderator Partial R2 decomposition bar chart for M7
    const modNames = [
      "AlphaMissense (log_pathogenicity)",
      "pLoF Indicator (pLoF_ind)",
      "HMM Constraint (log_constraint)"
    ];
    const pr2 = [
      (rec.pr2_am || 0) * 100,
      (rec.pr2_lof || 0) * 100,
      (rec.pr2_con || 0) * 100
    ];
    const modPs = [rec.p_am, rec.p_lof, rec.p_con];
    const modBetas = [rec.b_am, rec.b_lof, rec.b_con];

    const tracePR2 = {
      x: modNames,
      y: pr2,
      type: "bar",
      marker: { color: ["#d97706", "#e11d48", "#0d9488"] },
      text: pr2.map((v, i) => `${v.toFixed(2)}% (p=${fmtP(modPs[i])}, β=${modBetas[i] ?? "—"})`),
      textposition: "outside"
    };

    Plotly.react(
      "plot-gene-partial-r2",
      [tracePR2],
      {
        title: { text: `${rec.gene} (${rec.group}): True Orthogonal Partial R² (%) & Slopes in M7`, font: { size: 13 } },
        margin: { t: 40, r: 25, b: 50, l: 55 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        yaxis: {
          title: "Partial R² (%)",
          range: [0, Math.max(...pr2, 1) * 1.28],
          gridcolor: "#e2e8f0"
        },
        font: { family: "Inter, sans-serif", size: 12 }
      },
      { responsive: true, displayModeBar: false }
    );
  }

  // 5. Render Variant-Level WLS Profile Viewer
  function renderVariantProfileChart() {
    const key = state.variantGeneKey;
    const xCol = state.variantXAxis;
    const vlist = DATA.gene_variants[key] || [];
    if (!vlist.length) return;

    const groups = [
      {
        name: "Missense (Browser β)",
        filter: (v) => v.lof === 0 && !v.firth,
        color: "#2563eb",
        symbol: "circle"
      },
      {
        name: "Missense (Firth 2×2 Fallback)",
        filter: (v) => v.lof === 0 && v.firth,
        color: "#60a5fa",
        symbol: "circle-open"
      },
      {
        name: "pLoF (Browser β)",
        filter: (v) => v.lof === 1 && !v.firth,
        color: "#e11d48",
        symbol: "diamond"
      },
      {
        name: "pLoF (Firth 2×2 Fallback)",
        filter: (v) => v.lof === 1 && v.firth,
        color: "#fb7185",
        symbol: "diamond-open"
      }
    ];

    const traces = groups.map((g) => {
      const sub = vlist.filter(g.filter);
      return {
        x: sub.map((v) => v[xCol]),
        y: sub.map((v) => v.beta),
        mode: "markers",
        type: "scatter",
        name: `${g.name} (n=${sub.length})`,
        text: sub.map(
          (v) =>
            `Pos: ${v.pos} (${v.conseq})<br>` +
            `AF = ${fmtP(v.af)} | β = ${v.beta} (SE = ${v.se})<br>` +
            `AlphaMissense = ${v.am} (-log = ${v.log_am})<br>` +
            `HMM Constraint -log = ${v.log_con}`
        ),
        hoverinfo: "text",
        marker: {
          color: g.color,
          symbol: g.symbol,
          size: sub.map((v) => Math.max(5, Math.min(16, 4.5 / Math.max(v.se, 0.15)))),
          line: { width: 1.2, color: g.color }
        }
      };
    });

    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    vlist.forEach((v) => {
      const w = 1 / Math.max(v.se * v.se, 1e-4);
      const x = v[xCol] || 0;
      const y = v.beta || 0;
      sw += w;
      sx += w * x;
      sy += w * y;
      sxx += w * x * x;
      sxy += w * x * y;
    });
    const denom = sw * sxx - sx * sx;
    if (denom > 1e-9) {
      const slope = (sw * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / sw;
      const xMax = Math.max(...vlist.map((v) => v[xCol] || 0), 4);
      traces.push({
        x: [0, xMax],
        y: [intercept, intercept + slope * xMax],
        mode: "lines",
        name: `WLS Fit (slope = ${slope >= 0 ? "+" : ""}${slope.toFixed(3)})`,
        line: { color: "#0f172a", width: 2.8 }
      });
    }

    const xLabel =
      xCol === "log_am"
        ? "AlphaMissense Pathogenicity Moderator [-log(1 - s_AM)]"
        : "HMM Positional Constraint Moderator [-log(1 - p_con)]";

    Plotly.react(
      "plot-variant-profile",
      traces,
      {
        margin: { t: 25, r: 20, b: 55, l: 60 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: { title: xLabel, gridcolor: "#e2e8f0" },
        yaxis: { title: "Signed Variant Effect Size (β, log-OR)", gridcolor: "#e2e8f0", zerolinecolor: "#94a3b8" },
        legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
        font: { family: "Inter, sans-serif", size: 12 }
      },
      { responsive: true, displayModeBar: false }
    );
  }

  // 6. Render Interactive Pathway Cards (Threshold-Stratified: AF <= 0.001 vs AF <= 0.0001)
  function renderPathwayCards() {
    const container = document.getElementById("pathway-cards-grid");
    const activePathways = (DATA.pathways_by_af && DATA.pathways_by_af[state.af]) || DATA.pathways;
    if (!container || !activePathways) return;

    const pTitle = document.getElementById("pathway-section-title");
    if (pTitle) {
      pTitle.innerHTML =
        state.af === "af0001"
          ? "4. Deep Biological Pathway Architecture — Paper 1: Ultra-Rare Coding Variants (AF &le; 0.0001)"
          : "4. Deep Biological Pathway Architecture — Paper 2: Rare Coding Variants (AF &le; 0.001)";
    }

    const fig7Img = document.getElementById("img-fig7-pathway");
    const fig7Link1 = document.getElementById("link-fig7-pathway-1");
    const fig7Link2 = document.getElementById("link-fig7-pathway-2");
    const fig7Src =
      state.af === "af0001"
        ? "assets/fig7_pathway_enrichment_network_af0001.png?v=20261026d"
        : "assets/fig7_pathway_enrichment_network_af001.png?v=20261026d";
    if (fig7Img) fig7Img.src = fig7Src;
    if (fig7Link1) fig7Link1.href = fig7Src;
    if (fig7Link2) fig7Link2.href = fig7Src;

    container.innerHTML = activePathways
      .map((pm) => {
        const isActive = state.pathway === pm.id;
        const cntLabel =
          pm.n_strict !== undefined
            ? `Strict: ${pm.n_strict} | Sug: ${pm.n_sug}`
            : `${pm.genes.length} genes`;
        return `
        <div class="method-box pathway-card ${isActive ? "active-pathway" : ""}" data-pway="${pm.id}" style="cursor:pointer; border-left: 4px solid ${isActive ? "#e11d48" : "#0d9488"}; background: ${isActive ? "#fff1f2" : "#f8fafc"};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <h4 style="margin:0; font-size:0.9rem;">${pm.name}</h4>
            <span class="badge" style="background:#0f172a; color:#fff; font-size:0.7rem;">OR ${pm.or} (p=${pm.fisher_p})</span>
          </div>
          <p style="font-size:0.79rem; margin-bottom:0.45rem;">${pm.desc}</p>
          <div style="font-size:0.75rem; color:#0f172a; font-weight:600;">
            Active Hits (${cntLabel}): <span style="color:#2563eb;">${pm.genes.join(", ")}</span>
          </div>
        </div>`;
      })
      .join("");

    const enrTbody = document.getElementById("enrichr-table-body");
    if (enrTbody && DATA.enrichr_by_af) {
      const erows = DATA.enrichr_by_af[state.af] || [];
      enrTbody.innerHTML = erows
        .map(
          (r) => `
        <tr>
          <td><span class="badge" style="background:#e2e8f0;color:#0f172a;">${r.library}</span></td>
          <td><strong>${r.term}</strong></td>
          <td><strong>${Number(r.odds_ratio).toFixed(1)}&times;</strong></td>
          <td><span class="p-sig">${fmtP(r.pval)}</span></td>
          <td>${r.n_overlap}</td>
          <td style="font-size:0.76rem;color:#1e40af;">${r.genes}</td>
        </tr>`
        )
        .join("");
    }

    container.querySelectorAll(".pathway-card").forEach((el) => {
      el.addEventListener("click", () => {
        const pid = el.getAttribute("data-pway");
        state.pathway = state.pathway === pid ? "ALL" : pid;
        document.getElementById("select-pathway-filter").value = state.pathway;
        renderPathwayCards();
        renderUnifiedVsBrowserChart();
        renderGeneTable();
      });
    });
  }

  // 6B. Render Gene Size (Amino Acids) vs M7 -log10(p) & R^2 Plots
  function renderGeneSizePlots() {
    const scatterEl = document.getElementById("plot-gene-size-scatter");
    const binsEl = document.getElementById("plot-gene-size-bins");
    if (!scatterEl || !binsEl) return;

    const cfgKey = getConfigKey();
    let rows = (DATA.configs[cfgKey] || []).filter((r) => r.p_M7 !== null && r.aa_len > 0);
    if (state.group !== "ALL") {
      rows = rows.filter((r) => r.group === state.group);
    }

    const yModeEl = document.getElementById("select-genesize-yaxis");
    const yMode = yModeEl ? yModeEl.value : "neglog10_p";

    const sigRows = rows.filter((r) => r.p_M7 < EXOME_ALPHA);
    const sugRows = rows.filter((r) => r.p_M7 >= EXOME_ALPHA);

    const getY = (r) => (yMode === "r2_pct" ? (r.r2_M7 || 0) * 100 : negLog10(r.p_M7));
    const hoverTxt = (r) =>
      `<b>${r.gene} (${r.group})</b><br>` +
      `Canonical Protein Length = ${(r.aa_len || 0).toLocaleString()} AA (N_var = ${r.n_var})<br>` +
      `M7 p = ${fmtP(r.p_M7)} (-log10 p = ${negLog10(r.p_M7).toFixed(2)})<br>` +
      `Explained Variance R² = ${fmtPct(r.r2_M7)} (AM=${fmtPct(r.pr2_am)}, LoF=${fmtPct(r.pr2_lof)}, Con=${fmtPct(r.pr2_con)})`;

    const traceSug = {
      x: sugRows.map((r) => r.aa_len),
      y: sugRows.map(getY),
      mode: "markers",
      type: "scattergl",
      name: `Sub-threshold Loaded (${sugRows.length})`,
      text: sugRows.map(hoverTxt),
      hoverinfo: "text",
      marker: { color: "#94a3b8", size: 6, opacity: 0.5 }
    };

    const traceSig = {
      x: sigRows.map((r) => r.aa_len),
      y: sigRows.map(getY),
      mode: "markers",
      type: "scattergl",
      name: `Exome-Wide Sig. M7 (${sigRows.length})`,
      text: sigRows.map(hoverTxt),
      hoverinfo: "text",
      marker: {
        color: sigRows.map((r) => (yMode === "r2_pct" ? negLog10(r.p_M7) : (r.r2_M7 || 0) * 100)),
        colorscale: "Plasma",
        size: 9.5,
        line: { color: "#0f172a", width: 1 }
      }
    };

    const traces = [traceSug, traceSig];

    if (yMode === "neglog10_p") {
      traces.push({
        x: [80, 40000],
        y: [EXOME_LOG10, EXOME_LOG10],
        mode: "lines",
        name: "Exome Threshold (p = 3.4e-7)",
        line: { color: "#e11d48", width: 1.8, dash: "dash" }
      });
    }

    Plotly.react(
      scatterEl,
      traces,
      {
        title: {
          text:
            yMode === "r2_pct"
              ? "Explained Variance R² (%) vs. Canonical Protein Length (AA, log scale)"
              : "Unified M7 -log10(p) vs. Canonical Protein Length (AA, log scale)",
          font: { size: 13 }
        },
        margin: { t: 40, r: 20, b: 50, l: 58 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: { title: "Canonical Protein Length in Amino Acids (L_AA, log scale)", type: "log", gridcolor: "#e2e8f0" },
        yaxis: {
          title: yMode === "r2_pct" ? "Total Explained Variance R² (%) in M7" : "Unified Model M7 -log10(p)",
          gridcolor: "#e2e8f0",
          range: yMode === "r2_pct" ? [0, 28] : [0, 42]
        },
        legend: { orientation: "h", y: 1.13, x: 0.5, xanchor: "center", font: { size: 11 } },
        font: { family: "Inter, sans-serif", size: 12 }
      },
      { responsive: true, displayModeBar: false }
    );

    const fig10Img = document.getElementById("img-fig10-genesize");
    const fig10Link1 = document.getElementById("link-fig10-genesize-1");
    const fig10Link2 = document.getElementById("link-fig10-genesize-2");
    const fig10Src =
      state.af === "af0001"
        ? "assets/fig10_m7_pvalue_vs_gene_size_aa_af0001.png?v=20261026d"
        : "assets/fig10_m7_pvalue_vs_gene_size_aa_af001.png?v=20261026d";
    if (fig10Img) fig10Img.src = fig10Src;
    if (fig10Link1) fig10Link1.href = fig10Src;
    if (fig10Link2) fig10Link2.href = fig10Src;

    const bins = (DATA.gene_size_bins_by_af && DATA.gene_size_bins_by_af[state.af]) || DATA.gene_size_bins || [];
    if (bins.length) {
      const xLabels = bins.map((b) => b.aa_bin);
      const traceRate = {
        x: xLabels,
        y: bins.map((b) => b.sig_M7_rate_pct),
        name: "Exome Sig. Discovery Rate (%)",
        type: "bar",
        marker: { color: "#e11d48" },
        text: bins.map((b) => `${b.sig_M7} (${b.sig_M7_rate_pct.toFixed(2)}%)`),
        textposition: "outside"
      };
      const traceMedR2 = {
        x: xLabels,
        y: bins.map((b) => b.median_r2_sig_M7_pct),
        name: "Median R² of Sig. M7 Genes (%)",
        type: "scatter",
        mode: "lines+markers",
        yaxis: "y2",
        line: { color: "#0f172a", width: 2.6 },
        marker: { size: 8, color: "#2563eb" }
      };

      Plotly.react(
        binsEl,
        [traceRate, traceMedR2],
        {
          title: { text: "Discovery Rate (%) vs. Required Median R² Across Protein-Length Strata", font: { size: 13 } },
          margin: { t: 40, r: 58, b: 55, l: 55 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          xaxis: { title: "Canonical Protein Coding Length Stratum (Amino Acids)" },
          yaxis: { title: "M7 Discovery Rate (%)", range: [0, 8.8], gridcolor: "#e2e8f0" },
          yaxis2: {
            title: "Median R² of Sig. Genes (%)",
            overlaying: "y",
            side: "right",
            range: [0, 31],
            showgrid: false
          },
          legend: { orientation: "h", y: 1.13, x: 0.5, xanchor: "center", font: { size: 11 } },
          font: { family: "Inter, sans-serif", size: 12 }
        },
        { responsive: true, displayModeBar: false }
      );
    }
  }

  // 7. Render Interactive Sortable Gene Table
  function getFilteredRows() {
    const cfgKey = getConfigKey();
    let rows = (DATA.configs[cfgKey] || []).slice();

    if (state.group !== "ALL") {
      rows = rows.filter((r) => r.group === state.group);
    }

    if (state.pathway !== "ALL") {
      rows = rows.filter((r) => r.pathway === state.pathway);
    }

    if (state.search.trim() !== "") {
      const q = state.search.trim().toUpperCase();
      rows = rows.filter(
        (r) => r.gene.toUpperCase().includes(q) || r.gene_id.toUpperCase().includes(q)
      );
    }

    const activePCol = `p_${state.model}`;
    if (state.sigFilter === "exome") {
      rows = rows.filter((r) => r[activePCol] !== null && r[activePCol] < EXOME_ALPHA);
    } else if (state.sigFilter === "sug") {
      rows = rows.filter((r) => r[activePCol] !== null && r[activePCol] < 2.5e-6);
    } else if (state.sigFilter === "rescued") {
      rows = rows.filter(
        (r) =>
          r[activePCol] !== null &&
          r[activePCol] < EXOME_ALPHA &&
          (r.p_bro === null || r.p_bro >= EXOME_ALPHA)
      );
    }

    const col = state.sortCol;
    const asc = state.sortAsc ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return va.localeCompare(vb) * asc;
      return (va - vb) * asc;
    });

    return rows;
  }

  function formatPCell(p) {
    if (p === null || p === undefined || isNaN(p)) return "—";
    const s = fmtP(p);
    if (p < EXOME_ALPHA) return `<span class="p-sig">${s}</span>`;
    if (p < 2.5e-6) return `<span class="p-sug">${s}</span>`;
    return s;
  }

  function renderGeneTable() {
    const rows = getFilteredRows();
    document.getElementById("table-count-label").textContent =
      `Showing ${Math.min(rows.length, 300)} of ${rows.length} matching gene-phenotype pairs`;

    const tbody = document.getElementById("gene-table-body");
    const html = rows
      .slice(0, 300)
      .map((r) => {
        const key = `${r.gene}_${r.group}`;
        const isSel = key === state.selectedGeneKey ? "selected-row" : "";
        return `
        <tr class="${isSel}" data-key="${key}">
          <td><strong>${r.gene}</strong></td>
          <td><span class="pill-group pill-${r.group}">${r.group}</span></td>
          <td>${(r.aa_len || 0).toLocaleString()} AA</td>
          <td>${r.n_var}</td>
          <td>${r.n_lof} / ${r.n_mis}</td>
          <td>${r.vif ?? "1.02"}</td>
          <td>${formatPCell(r.p_M1)}</td>
          <td>${formatPCell(r.p_M2)}</td>
          <td>${formatPCell(r.p_M3)}</td>
          <td>${formatPCell(r.p_M5)}</td>
          <td>${formatPCell(r.p_M7)}</td>
          <td><strong>${fmtPct(r.r2_M7)}</strong></td>
          <td>${formatPCell(r.p_am)} (${fmtPct(r.pr2_am)})</td>
          <td>${formatPCell(r.p_lof)} (${fmtPct(r.pr2_lof)})</td>
          <td>${formatPCell(r.p_con)} (${fmtPct(r.pr2_con)})</td>
          <td>${formatPCell(r.p_bro)}</td>
        </tr>`;
      })
      .join("");
    tbody.innerHTML = html;

    tbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        state.selectedGeneKey = tr.getAttribute("data-key");
        document.getElementById("select-inspector-gene").value = state.selectedGeneKey;
        renderGeneInspector();
        renderGeneTable();
      });
    });
  }

  // 8. Export Filtered Table to CSV
  function exportTableCSV() {
    const rows = getFilteredRows();
    const headers = [
      "gene_id", "gene", "group", "pathway", "n_var", "n_lof", "n_mis", "n_firth", "max_vif",
      "p_M1_LoF_only", "p_M2_AM_only", "p_M3_Constraint_only", "p_M4_LoF_Constraint",
      "p_M5_AM_LoF", "p_M7_AM_LoF_Constraint", "r2_M7",
      "p_pathogenicity", "partial_r2_am", "p_pLoF", "partial_r2_lof",
      "p_constraint", "partial_r2_con", "browser_min_p"
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.gene_id, r.gene, r.group, r.pathway, r.n_var, r.n_lof, r.n_mis, r.n_firth, r.vif,
          r.p_M1, r.p_M2, r.p_M3, r.p_M4, r.p_M5, r.p_M7, r.r2_M7,
          r.p_am, r.pr2_am, r.p_lof, r.pr2_lof, r.p_con, r.pr2_con, r.p_bro
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ibd_collinearity_free_metareg_${getConfigKey()}_${state.group}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function refreshAll() {
    updateKPIs();
    renderProgressionChart();
    renderUnifiedVsBrowserChart();
    populateInspectorDropdown();
    renderGeneInspector();
    renderPathwayCards();
    renderGeneSizePlots();
    renderGeneTable();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ctrl-af").addEventListener("change", (e) => {
      state.af = e.target.value;
      refreshAll();
    });
    document.getElementById("ctrl-spec").addEventListener("change", (e) => {
      state.spec = e.target.value;
      refreshAll();
    });
    document.getElementById("ctrl-group").addEventListener("change", (e) => {
      state.group = e.target.value;
      refreshAll();
    });
    document.getElementById("ctrl-model").addEventListener("change", (e) => {
      state.model = e.target.value;
      state.sortCol = `p_${state.model}`;
      state.sortAsc = true;
      refreshAll();
    });

    document.getElementById("select-inspector-gene").addEventListener("change", (e) => {
      state.selectedGeneKey = e.target.value;
      renderGeneInspector();
      renderGeneTable();
    });

    document.getElementById("select-variant-gene").addEventListener("change", (e) => {
      state.variantGeneKey = e.target.value;
      renderVariantProfileChart();
    });

    document.getElementById("select-variant-xaxis").addEventListener("change", (e) => {
      state.variantXAxis = e.target.value;
      renderVariantProfileChart();
    });

    document.getElementById("input-gene-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      renderGeneTable();
    });

    document.getElementById("select-sig-filter").addEventListener("change", (e) => {
      state.sigFilter = e.target.value;
      renderGeneTable();
    });

    document.getElementById("select-pathway-filter").addEventListener("change", (e) => {
      state.pathway = e.target.value;
      renderPathwayCards();
      renderUnifiedVsBrowserChart();
      renderGeneTable();
    });

    const gsYSelect = document.getElementById("select-genesize-yaxis");
    if (gsYSelect) {
      gsYSelect.addEventListener("change", () => {
        renderGeneSizePlots();
      });
    }

    document.getElementById("btn-export-csv").addEventListener("click", exportTableCSV);

    document.querySelectorAll("table.results-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (state.sortCol === col) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortCol = col;
          state.sortAsc = col.startsWith("r2_") || col.startsWith("pr2_") ? false : true;
        }
        renderGeneTable();
      });
    });

    refreshAll();
    renderVariantProfileChart();
  });
})();
