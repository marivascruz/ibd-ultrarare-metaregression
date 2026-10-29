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
    aaLenFilter: "all",
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
        subEl.textContent = `Cohort Hits (Unique Genes) | p<2.5e-6: ${sAllPairs[m.ucol]}`;
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
        title: "Exome Browser Best Burden -log10(p) [PTV / Nsyn]",
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

    const benchOR = rec.b_bench ? Math.exp(Math.min(rec.b_bench, 8)).toFixed(2) : "—";
    document.getElementById("inspector-gene-summary").innerHTML =
      `<strong>${rec.gene}</strong> (<span class="pill-group pill-${rec.group}">${rec.group}</span>) &nbsp;|&nbsp; ` +
      `Length: <strong>${(rec.aa_len || 0).toLocaleString()} AA</strong> &nbsp;|&nbsp; ` +
      `Variants: <strong>${rec.n_var}</strong> (pLoF: ${rec.n_lof}, Missense: ${rec.n_mis}, Firth: ${rec.n_firth}, Max VIF: ${rec.vif ?? "1.02"}) &nbsp;|&nbsp; ` +
      `M5 <em>p</em> = <strong>${fmtP(rec.p_M5)}</strong> &nbsp;|&nbsp; ` +
      `M7 <em>p</em> = <strong>${fmtP(rec.p_M7)}</strong> (<em>R</em>² = <strong>${fmtPct(rec.r2_M7)}</strong>) &nbsp;|&nbsp; ` +
      `&Delta;log-OR<sub>bench</sub> = <strong>${rec.b_bench !== null && rec.b_bench !== undefined ? "+" + Number(rec.b_bench).toFixed(2) : "—"}</strong> (OR = <strong>${benchOR}&times;</strong>)` +
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
    const modEBs = [rec.eb_am, rec.eb_lof, rec.eb_con];

    const tracePR2 = {
      x: modNames,
      y: pr2,
      type: "bar",
      marker: { color: ["#d97706", "#e11d48", "#0d9488"] },
      text: pr2.map(
        (v, i) =>
          `${v.toFixed(2)}% (p=${fmtP(modPs[i])}, β_EB=${modEBs[i] ?? "—"}, raw β=${modBetas[i] ?? "—"})`
      ),
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

  function syncCohortButtons() {
    document.querySelectorAll(".enr-cohort-btn").forEach((btn) => {
      const c = btn.getAttribute("data-cohort");
      const active = c === state.group;
      btn.style.background = active ? "#0f172a" : "#e2e8f0";
      btn.style.color = active ? "#ffffff" : "#0f172a";
      btn.style.borderColor = active ? "#0f172a" : "#cbd5e1";
    });
    const grpSel = document.getElementById("ctrl-group");
    if (grpSel && grpSel.value !== state.group) {
      grpSel.value = state.group;
    }
  }

  function renderUnbiasedTableRows(erows, libFilter, sortCol) {
    let filtered = (erows || []).slice();
    if (libFilter && libFilter !== "ALL") {
      if (libFilter === "CLINICAL_DISGENET_HPO") {
        filtered = filtered.filter(
          (r) => r.library === "DisGeNET" || r.library === "Human_Phenotype_Ontology"
        );
      } else if (libFilter === "ALL_MOLECULAR") {
        filtered = filtered.filter(
          (r) =>
            r.library !== "DisGeNET" &&
            r.library !== "Human_Phenotype_Ontology" &&
            r.library !== "Functional_Biological_Modules"
        );
      } else {
        filtered = filtered.filter((r) => r.library === libFilter);
      }
    }
    filtered.sort((a, b) => {
      const va = a[sortCol] !== undefined && a[sortCol] !== null ? Number(a[sortCol]) : 1.0;
      const vb = b[sortCol] !== undefined && b[sortCol] !== null ? Number(b[sortCol]) : 1.0;
      return va - vb;
    });
    return filtered
      .slice(0, 25)
      .map((r) => {
        const shortLib = (r.library || "")
          .replace("Functional_Biological_Modules", "Functional_Module")
          .replace("Human_Phenotype_Ontology", "HPO_Clinical")
          .replace("_2023", "")
          .replace("_2022", "")
          .replace("_2021_Human", "")
          .replace("_Human", "");
        let badgeStyle = "background:#e2e8f0;color:#0f172a;font-size:0.68rem;";
        if (r.library === "Functional_Biological_Modules") {
          badgeStyle = "background:#0f766e;color:#ffffff;font-size:0.68rem;";
        } else if (r.library === "DisGeNET") {
          badgeStyle = "background:#7c3aed;color:#ffffff;font-size:0.68rem;";
        } else if (r.library === "Human_Phenotype_Ontology") {
          badgeStyle = "background:#be123c;color:#ffffff;font-size:0.68rem;";
        }
        const pLen = r.p_len_adj !== undefined ? r.p_len_adj : r.pval;
        const orLen = r.or_len_adj !== undefined ? r.or_len_adj : r.odds_ratio;
        const pFish = r.p_fisher !== undefined ? r.p_fisher : r.pval;
        const orFish = r.or_fisher !== undefined ? r.or_fisher : r.odds_ratio;
        const pComp = r.p_comp !== undefined ? r.p_comp : null;
        const zComp = r.z_comp !== undefined ? r.z_comp : null;
        const nHits = r.n_hits !== undefined ? r.n_hits : r.n_overlap;
        const nUniv = r.n_pathway_univ !== undefined ? r.n_pathway_univ : "—";
        const expUn = r.exp_hits_unadj !== undefined ? Number(r.exp_hits_unadj).toFixed(2) : "—";
        const expLen = r.exp_hits_len_adj !== undefined ? Number(r.exp_hits_len_adj).toFixed(2) : "—";
        const medR2 = r.med_r2_hits_pct !== undefined ? `${Number(r.med_r2_hits_pct).toFixed(1)}%` : "—";
        const genesShow = r.genes_with_aa || r.genes || "";
        return `
        <tr>
          <td><span class="badge" style="${badgeStyle}">${shortLib}</span></td>
          <td><strong>${r.term}</strong></td>
          <td style="white-space:nowrap;"><strong>${nHits} / ${nUniv}</strong> <span style="color:#64748b;font-size:0.72rem;">(${expUn} &rarr; ${expLen})</span></td>
          <td style="white-space:nowrap;"><strong style="color:#0f766e;">${Number(orLen).toFixed(1)}&times;</strong> (${formatPCell(pLen)})</td>
          <td style="white-space:nowrap;"><strong>${Number(orFish).toFixed(1)}&times;</strong> (${formatPCell(pFish)})</td>
          <td style="white-space:nowrap;">${zComp !== null ? `<strong>${Number(zComp) >= 0 ? "+" : ""}${Number(zComp).toFixed(2)}</strong> (${formatPCell(pComp)})` : "—"}</td>
          <td><strong style="color:#be123c;">${medR2}</strong></td>
          <td style="font-size:0.73rem;color:#1e40af;line-height:1.35;">${genesShow}</td>
        </tr>`;
      })
      .join("");
  }

  // 6. Render Interactive Pathway Cards (Threshold & Cohort Stratified)
  function renderPathwayCards() {
    syncCohortButtons();
    const container = document.getElementById("pathway-cards-grid");
    const activePathways =
      (DATA.pathways_lt2000aa_by_af_cohort &&
        DATA.pathways_lt2000aa_by_af_cohort[state.af] &&
        DATA.pathways_lt2000aa_by_af_cohort[state.af][state.group]) ||
      (DATA.pathways_by_af && DATA.pathways_by_af[state.af]) ||
      DATA.pathways;
    if (!container || !activePathways) return;

    const cohortLabelMap = {
      ALL: "All Cohorts Combined (IBD + CD + UC)",
      CD: "Crohn's Disease (CD)",
      UC: "Ulcerative Colitis (UC)",
      IBD: "Combined IBD Meta-Analysis (IBD)"
    };
    const pTitle = document.getElementById("pathway-section-title");
    if (pTitle) {
      pTitle.innerHTML =
        state.af === "af0001"
          ? `4. Deep Biological Pathway Architecture — Paper 1: Ultra-Rare (AF &le; 0.0001) [${cohortLabelMap[state.group] || state.group}]`
          : `4. Deep Biological Pathway Architecture — Paper 2: Rare (AF &le; 0.001) [${cohortLabelMap[state.group] || state.group}]`;
    }

    const allAaTitle = document.getElementById("all-aa-unbiased-title");
    if (allAaTitle) {
      allAaTitle.innerHTML = `Unbiased Exact-Universe &amp; Length-Adjusted Ontology Enrichment (All Protein Lengths — Cohort: <span style="color:#0d9488;">${cohortLabelMap[state.group] || state.group}</span>, ${state.af === "af0001" ? "AF &le; 0.0001" : "AF &le; 0.001"})`;
    }

    const fig7Img = document.getElementById("img-fig7-pathway");
    const fig7Link1 = document.getElementById("link-fig7-pathway-1");
    const fig7Link2 = document.getElementById("link-fig7-pathway-2");
    const fig7Src =
      state.af === "af0001"
        ? "assets/fig7_pathway_enrichment_network_af0001.png?v=20261028f"
        : "assets/fig7_pathway_enrichment_network_af001.png?v=20261028f";
    if (fig7Img) fig7Img.src = fig7Src;
    if (fig7Link1) fig7Link1.href = fig7Src;
    if (fig7Link2) fig7Link2.href = fig7Src;

    const baseMods = (DATA.pathways_by_af && DATA.pathways_by_af[state.af]) || DATA.pathways;
    container.innerHTML = baseMods
      .map((pm, idx) => {
        const isActive = state.pathway === pm.id;
        const cohMod = activePathways[idx] || pm;
        const activeGenesList =
          cohMod.genes_lt2000_active && cohMod.genes_ge2000
            ? cohMod.genes_lt2000_active.concat(
                cohMod.genes_ge2000.filter((g) => (pm.genes || []).includes(g))
              )
            : pm.genes;
        const showGenes = activeGenesList && activeGenesList.length ? activeGenesList : pm.genes;
        const cntLabel =
          cohMod.n_total !== undefined
            ? `${cohMod.n_total} hits in ${state.group} (${cohMod.n_lt2000} &lt;2k AA)`
            : `${pm.genes.length} genes`;
        return `
        <div class="method-box pathway-card ${isActive ? "active-pathway" : ""}" data-pway="${pm.id}" style="cursor:pointer; border-left: 4px solid ${isActive ? "#e11d48" : "#0d9488"}; background: ${isActive ? "#fff1f2" : "#f8fafc"};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <h4 style="margin:0; font-size:0.9rem;">${pm.name}</h4>
            <span class="badge" style="background:#0f172a; color:#fff; font-size:0.7rem;">OR ${pm.or} (p=${pm.fisher_p})</span>
          </div>
          <p style="font-size:0.79rem; margin-bottom:0.45rem;">${pm.desc}</p>
          <div style="font-size:0.75rem; color:#0f172a; font-weight:600;">
            Active Hits (${cntLabel}): <span style="color:#2563eb;">${showGenes.join(", ")}</span>
          </div>
        </div>`;
      })
      .join("");

    const enrTbody = document.getElementById("enrichr-table-body");
    if (enrTbody) {
      const sliceKey = `${state.af}_${state.group}_all_aa`;
      const unbRows =
        (DATA.unbiased_enrichment && DATA.unbiased_enrichment[sliceKey]) ||
        (DATA.enrichr_by_af && DATA.enrichr_by_af[state.af]) ||
        [];
      const libSel = document.getElementById("select-allaa-lib");
      const sortSel = document.getElementById("select-allaa-sort");
      const libVal = libSel ? libSel.value : "ALL";
      const sortVal = sortSel ? sortSel.value : "p_len_adj";
      enrTbody.innerHTML = renderUnbiasedTableRows(unbRows, libVal, sortVal);
    }

    container.querySelectorAll(".pathway-card").forEach((el) => {
      el.addEventListener("click", () => {
        const pid = el.getAttribute("data-pway");
        state.pathway = state.pathway === pid ? "ALL" : pid;
        document.getElementById("select-pathway-filter").value = state.pathway;
        renderPathwayCards();
        renderLt2000Section();
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
        ? "assets/fig10_m7_pvalue_vs_gene_size_aa_af0001.png?v=20261028c"
        : "assets/fig10_m7_pvalue_vs_gene_size_aa_af001.png?v=20261028c";
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

  // 6C. Render Size-Restricted (< 2,000 AA) Pathway Analysis Section (Cohort-Stratified & Unbiased)
  function renderLt2000Section() {
    syncCohortButtons();
    const cohortLabelMap = {
      ALL: "All Cohorts Combined (IBD + CD + UC)",
      CD: "Crohn's Disease (CD)",
      UC: "Ulcerative Colitis (UC)",
      IBD: "Combined IBD Meta-Analysis (IBD)"
    };
    const sumMapCoh =
      (DATA.lt2000aa_summary_by_af_cohort && DATA.lt2000aa_summary_by_af_cohort[state.af]) || {};
    const modMapCoh =
      (DATA.pathways_lt2000aa_by_af_cohort && DATA.pathways_lt2000aa_by_af_cohort[state.af]) || {};
    const s =
      sumMapCoh[state.group] ||
      (DATA.lt2000aa_summary_by_af && DATA.lt2000aa_summary_by_af[state.af]);
    const mods =
      modMapCoh[state.group] ||
      (DATA.pathways_lt2000aa_by_af && DATA.pathways_lt2000aa_by_af[state.af]) ||
      [];

    const regimeSel = document.getElementById("select-lt2000-regime");
    const activeRegime = regimeSel ? regimeSel.value : "lt2000_aa";
    const regimeLabelMap = {
      lt2000_aa: "<em>L</em><sub>AA</sub> &lt; 2,000 AA Only (Compact/Standard)",
      all_aa: "All Protein Lengths (Adding Back <em>L</em><sub>AA</sub> &ge; 2,000 AA)",
      ge2000_aa: "<em>L</em><sub>AA</sub> &ge; 2,000 AA Stratum Only (Giant Scaffolds)"
    };

    const sliceKeyLt = `${state.af}_${state.group}_${activeRegime}`;
    const unbLtRows =
      (DATA.unbiased_enrichment && DATA.unbiased_enrichment[sliceKeyLt]) ||
      (DATA.enrichr_lt2000aa_by_af && DATA.enrichr_lt2000aa_by_af[state.af]) ||
      [];

    if (!s || !mods.length) return;

    const secTitle = document.getElementById("lt2000-section-title");
    if (secTitle) {
      secTitle.innerHTML =
        state.af === "af0001"
          ? `4C. Unbiased Size-Restricted &amp; Add-Back Pathway Architecture — Paper 1: Ultra-Rare (AF &le; 0.0001) [${cohortLabelMap[state.group] || state.group}]`
          : `4C. Unbiased Size-Restricted &amp; Add-Back Pathway Architecture — Paper 2: Rare (AF &le; 0.001) [${cohortLabelMap[state.group] || state.group}]`;
    }

    const unbSub = document.getElementById("lt2000-unbiased-subtitle");
    if (unbSub) {
      unbSub.innerHTML = `Unbiased Reference Ontology Enrichment (${regimeLabelMap[activeRegime]}) — Active Cohort: <span style="color:#0d9488;">${cohortLabelMap[state.group] || state.group}</span> (${state.af === "af0001" ? "AF &le; 0.0001" : "AF &le; 0.001"})`;
    }

    const enrTitleEl = document.getElementById("lt2000-enrichr-title");
    if (enrTitleEl) {
      enrTitleEl.innerHTML = `Unbiased Exact-Universe &amp; Length-Adjusted Ontology Enrichment (${regimeLabelMap[activeRegime]} — Cohort: <span style="color:#0d9488;">${state.group}</span>)`;
    }

    const kpiBg = document.getElementById("kpi-lt2000-bg");
    const kpiBgSub = document.getElementById("kpi-lt2000-bg-sub");
    const kpiSig = document.getElementById("kpi-lt2000-sig");
    const kpiSigSub = document.getElementById("kpi-lt2000-sig-sub");
    const kpiR2 = document.getElementById("kpi-lt2000-r2");
    const kpiR2Sub = document.getElementById("kpi-lt2000-r2-sub");
    const kpiMods = document.getElementById("kpi-lt2000-mods");
    const kpiModsSub = document.getElementById("kpi-lt2000-mods-sub");

    if (kpiBg) kpiBg.textContent = `${s.bg_lt2000.toLocaleString()} / ${s.bg_total.toLocaleString()} (${s.bg_lt2000_pct}%)`;
    if (kpiBgSub) kpiBgSub.textContent = `Exact tested universe in ${state.group}: only ${s.bg_ge2000} genes (2.66%) have canonical length ≥ 2,000 AA`;

    if (state.af === "af0001") {
      if (kpiSig) kpiSig.textContent = `${s.n_sig_strict_lt2000}/${s.n_sig_strict_total} Strict (${s.pct_strict_lt2000}%) | ${s.n_sig_sug_lt2000}/${s.n_sig_sug_total} Sug (${s.pct_sug_lt2000}%)`;
      if (kpiSigSub) kpiSigSub.textContent = `[${state.group}] Median length = ${s.med_aa_lt2000.toLocaleString()} AA (<2,000 AA) vs. ${s.med_aa_ge2000.toLocaleString()} AA (≥2,000 AA)`;
    } else {
      if (kpiSig) kpiSig.textContent = `${s.n_sig_strict_lt2000} / ${s.n_sig_strict_total} (${s.pct_strict_lt2000}%)`;
      if (kpiSigSub) kpiSigSub.textContent = `[${state.group}] Median length = ${s.med_aa_lt2000.toLocaleString()} AA (<2,000 AA) vs. ${s.med_aa_ge2000.toLocaleString()} AA (≥2,000 AA)`;
    }

    if (kpiR2) kpiR2.textContent = `${s.med_r2_lt2000.toFixed(2)}% vs. ${s.med_r2_ge2000.toFixed(2)}% (${s.r2_ratio}×)`;
    if (kpiR2Sub) kpiR2Sub.textContent = `[${state.group}] Compact < 2,000 AA significant genes explain ${s.r2_ratio}× more variance per gene than ≥ 2,000 AA genes`;

    const nUnbSig = unbLtRows.filter((r) => (r.p_len_adj || 1) < 0.01).length;
    if (kpiMods) kpiMods.innerHTML = `${nUnbSig} Top Unbiased Terms (<em>p</em><sub>len</sub> &lt; 0.01)`;
    if (kpiModsSub) {
      const topTerm = unbLtRows[0] ? `${unbLtRows[0].term} (OR_len = ${Number(unbLtRows[0].or_len_adj).toFixed(1)}×)` : "";
      kpiModsSub.textContent = `Lead in ${state.group}: ${topTerm}`;
    }

    // Left Chart: Top 12 Unbiased Ontology Enrichments (<2,000 AA) in Active Cohort: Length-Adjusted OR vs Exact-Universe Fisher OR
    const orPlotEl = document.getElementById("plot-lt2000-modules-or");
    if (orPlotEl && unbLtRows.length) {
      const libSelChart = document.getElementById("select-lt2000-lib");
      const libValChart = libSelChart ? libSelChart.value : "ALL";
      let chartRows = unbLtRows.slice();
      if (libValChart && libValChart !== "ALL") {
        if (libValChart === "CLINICAL_DISGENET_HPO") {
          chartRows = chartRows.filter(
            (r) => r.library === "DisGeNET" || r.library === "Human_Phenotype_Ontology"
          );
        } else if (libValChart === "ALL_MOLECULAR") {
          chartRows = chartRows.filter(
            (r) =>
              r.library !== "DisGeNET" &&
              r.library !== "Human_Phenotype_Ontology" &&
              r.library !== "Functional_Biological_Modules"
          );
        } else {
          chartRows = chartRows.filter((r) => r.library === libValChart);
        }
      }
      if (!chartRows.length) chartRows = unbLtRows.slice();
      const top10 = chartRows.slice(0, 10).slice().reverse();
      const shortTerms = top10.map((r) => {
        const clean = r.term.replace(/\s*\(GO:\d+\)/, "").replace(/\s*R-HSA-\d+/, "").replace(/\s*WP\d+/, "");
        return clean.length > 36 ? clean.slice(0, 34) + "…" : clean;
      });
      const traceLenOR = {
        y: shortTerms,
        x: top10.map((r) => Number(r.or_len_adj || r.odds_ratio || 0)),
        name: "Length & Variant-Count Adjusted OR (OR_len)",
        type: "bar",
        orientation: "h",
        marker: { color: "#0d9488" },
        text: top10.map((r) => `${Number(r.or_len_adj || 0).toFixed(1)}× (p=${fmtP(r.p_len_adj)})`),
        textposition: "outside",
        hovertext: top10.map(
          (r) =>
            `<b>${r.term}</b> [${r.library}]<br>` +
            `Cohort: <b>${state.group}</b> (L_AA < 2,000 AA)<br>` +
            `Hits / Tested Pathway Size: <b>${r.n_hits} / ${r.n_pathway_univ}</b> (Exp_len = ${Number(r.exp_hits_len_adj).toFixed(2)})<br>` +
            `Length-Adjusted OR = <b>${Number(r.or_len_adj).toFixed(2)}×</b> (Poisson-Binomial p = ${fmtP(r.p_len_adj)})<br>` +
            `Exact-Universe Fisher OR = ${Number(r.or_fisher).toFixed(2)}× (p = ${fmtP(r.p_fisher)})<br>` +
            `Competitive Z = +${Number(r.z_comp).toFixed(2)} (p = ${fmtP(r.p_comp)})<br>` +
            `Genes: ${r.genes_with_aa || r.genes}`
        ),
        hoverinfo: "text"
      };

      const traceFishOR = {
        y: shortTerms,
        x: top10.map((r) => Number(r.or_fisher || r.odds_ratio || 0)),
        name: "Exact-Universe Unadjusted Fisher OR",
        type: "bar",
        orientation: "h",
        marker: { color: "#94a3b8" },
        hoverinfo: "skip"
      };

      const maxX = Math.max(...top10.map((r) => Math.max(Number(r.or_len_adj || 0), Number(r.or_fisher || 0))), 10);
      const shortRegime = activeRegime === "all_aa" ? "All Lengths (w/ >=2,000 AA)" : activeRegime === "ge2000_aa" ? ">=2,000 AA Stratum" : "<2,000 AA Only";
      Plotly.react(
        orPlotEl,
        [traceFishOR, traceLenOR],
        {
          title: {
            text: `Top Unbiased Pathways (${shortRegime}) in ${state.group}: Length-Adj OR vs. Fisher OR`,
            font: { size: 11.8 }
          },
          barmode: "group",
          margin: { t: 42, r: 95, b: 45, l: 195 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          xaxis: { title: "Enrichment Odds Ratio (OR)", range: [0, maxX * 1.38], gridcolor: "#e2e8f0" },
          yaxis: { tickfont: { size: 10 } },
          legend: { orientation: "h", y: 1.13, x: 0.45, xanchor: "center", font: { size: 10 } },
          font: { family: "Inter, sans-serif", size: 11 }
        },
        { responsive: true, displayModeBar: false }
      );
    }

    // Right Chart: Cross-Disease Comparison (CD vs UC vs IBD in activeRegime) for Top Unbiased Pathways
    const r2PlotEl = document.getElementById("plot-lt2000-r2-comparison");
    if (r2PlotEl && DATA.unbiased_enrichment) {
      const cdRows = DATA.unbiased_enrichment[`${state.af}_CD_${activeRegime}`] || [];
      const ucRows = DATA.unbiased_enrichment[`${state.af}_UC_${activeRegime}`] || [];
      const ibdRows = DATA.unbiased_enrichment[`${state.af}_IBD_${activeRegime}`] || [];

      // Collect union of top 4 pathways from CD, top 4 from UC, top 3 from IBD
      const seenTerms = new Set();
      const compareTerms = [];
      [cdRows.slice(0, 4), ucRows.slice(0, 4), ibdRows.slice(0, 3)].forEach((list) => {
        list.forEach((r) => {
          const key = `${r.library}||${r.term}`;
          if (!seenTerms.has(key)) {
            seenTerms.add(key);
            compareTerms.push({ key, library: r.library, term: r.term });
          }
        });
      });

      const lookupNegLogP = (rows, key) => {
        const found = rows.find((r) => `${r.library}||${r.term}` === key);
        if (!found || !found.p_len_adj) return 0;
        return -Math.log10(Math.max(Number(found.p_len_adj), 1e-16));
      };
      const lookupHover = (rows, key, cohName) => {
        const found = rows.find((r) => `${r.library}||${r.term}` === key);
        if (!found) return `<b>${cohName}</b>: Not in top enriched list`;
        return (
          `<b>${cohName} — ${found.term}</b><br>` +
          `Length-Adjusted OR = ${Number(found.or_len_adj).toFixed(1)}× (p_len = ${fmtP(found.p_len_adj)})<br>` +
          `Hits: ${found.n_hits}/${found.n_pathway_univ} (${found.genes_with_aa || found.genes})`
        );
      };

      const revTerms = compareTerms.slice().reverse();
      const shortCompare = revTerms.map((t) => {
        const clean = t.term.replace(/\s*\(GO:\d+\)/, "").replace(/\s*R-HSA-\d+/, "").replace(/\s*WP\d+/, "");
        return clean.length > 34 ? clean.slice(0, 32) + "…" : clean;
      });

      const trCD = {
        y: shortCompare,
        x: revTerms.map((t) => lookupNegLogP(cdRows, t.key)),
        name: "CD (Crohn's Disease)",
        type: "bar",
        orientation: "h",
        marker: { color: "#dc2626" },
        hovertext: revTerms.map((t) => lookupHover(cdRows, t.key, "CD")),
        hoverinfo: "text"
      };
      const trUC = {
        y: shortCompare,
        x: revTerms.map((t) => lookupNegLogP(ucRows, t.key)),
        name: "UC (Ulcerative Colitis)",
        type: "bar",
        orientation: "h",
        marker: { color: "#2563eb" },
        hovertext: revTerms.map((t) => lookupHover(ucRows, t.key, "UC")),
        hoverinfo: "text"
      };
      const trIBD = {
        y: shortCompare,
        x: revTerms.map((t) => lookupNegLogP(ibdRows, t.key)),
        name: "IBD (Combined Meta)",
        type: "bar",
        orientation: "h",
        marker: { color: "#0d9488" },
        hovertext: revTerms.map((t) => lookupHover(ibdRows, t.key, "IBD")),
        hoverinfo: "text"
      };

      const shortRegime2 = activeRegime === "all_aa" ? "All Lengths w/ >=2k AA" : activeRegime === "ge2000_aa" ? ">=2,000 AA Stratum" : "<2,000 AA";
      Plotly.react(
        r2PlotEl,
        [trIBD, trUC, trCD],
        {
          title: {
            text: `Disease Specificity (${shortRegime2}): CD vs. UC vs. IBD Unbiased Enrichment (-log10 p_len)`,
            font: { size: 11.8 }
          },
          barmode: "group",
          margin: { t: 42, r: 25, b: 45, l: 190 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          xaxis: { title: "Length-Adjusted Significance (-log10 p_len-adj)", gridcolor: "#e2e8f0" },
          yaxis: { tickfont: { size: 10 } },
          legend: { orientation: "h", y: 1.13, x: 0.45, xanchor: "center", font: { size: 10 } },
          font: { family: "Inter, sans-serif", size: 11 }
        },
        { responsive: true, displayModeBar: false }
      );
    }

    // 9 Size-Restricted Module Cards (Cohort-Stratified)
    const cardsGrid = document.getElementById("lt2000-pathway-cards-grid");
    if (cardsGrid) {
      cardsGrid.innerHTML = mods
        .map((m) => {
          const isActive = state.pathway === m.id && state.aaLenFilter === "lt2000";
          const isEnriched = m.fisher_p_lt2000_num < 0.05 && m.n_lt2000 > 0;
          const borderCol = isActive ? "#e11d48" : isEnriched ? "#0d9488" : "#94a3b8";
          const badgeBg = isEnriched ? "#0f766e" : "#64748b";
          return `
          <div class="method-box lt2000-card" data-pway="${m.id}" style="cursor:pointer; border-left: 4px solid ${borderCol}; background: ${isActive ? "#fff1f2" : "#f8fafc"};">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; margin-bottom:0.35rem;">
              <h4 style="margin:0; font-size:0.86rem; color:#0f172a;">${m.name}</h4>
              <span class="badge" style="background:${badgeBg}; color:#fff; font-size:0.68rem; white-space:nowrap;">
                [${state.group}] &lt;2k OR ${m.or_lt2000.toFixed(1)}&times; (p=${m.fisher_p_lt2000})
              </span>
            </div>
            <div style="font-size:0.74rem; color:#334155; margin-bottom:0.4rem; display:flex; gap:0.65rem; flex-wrap:wrap;">
              <span><strong>Retained in ${state.group}:</strong> ${m.n_lt2000}/${m.n_total} (${m.pct_retained}%)</span>
              <span><strong>Med Length:</strong> ${m.med_aa_lt2000.toLocaleString()} AA</span>
              <span><strong>Med R&sup2;:</strong> <span style="color:#be123c;font-weight:700;">${m.med_r2_lt2000.toFixed(1)}%</span> (vs ${m.med_r2_ge2000.toFixed(1)}% &ge;2k)</span>
            </div>
            <div style="font-size:0.74rem; color:#0f172a; margin-bottom:0.3rem; line-height:1.4;">
              <strong style="color:#0d9488;">&lt; 2,000 AA Hits in ${state.group} (${m.n_lt2000}):</strong>
              <span style="color:#1d4ed8; font-weight:600;">${m.genes_lt2000_fmt || "None"}</span>
            </div>
            <div style="font-size:0.71rem; color:#64748b; line-height:1.35;">
              <strong>&ge; 2,000 AA Excluded (${(m.genes_ge2000 || []).length}):</strong>
              <span>${m.genes_ge2000_fmt || "None"}</span>
            </div>
          </div>`;
        })
        .join("");

      cardsGrid.querySelectorAll(".lt2000-card").forEach((el) => {
        el.addEventListener("click", () => {
          const pid = el.getAttribute("data-pway");
          if (state.pathway === pid && state.aaLenFilter === "lt2000") {
            state.pathway = "ALL";
            state.aaLenFilter = "all";
          } else {
            state.pathway = pid;
            state.aaLenFilter = "lt2000";
          }
          const pSel = document.getElementById("select-pathway-filter");
          if (pSel) pSel.value = state.pathway;
          const aaSel = document.getElementById("select-aalen-filter");
          if (aaSel) aaSel.value = state.aaLenFilter;
          renderPathwayCards();
          renderLt2000Section();
          renderUnifiedVsBrowserChart();
          renderGeneTable();
        });
      });
    }

    // Unbiased (< 2,000 AA / All AA / >= 2,000 AA) Ontology Table for Active Cohort
    const enrTbody = document.getElementById("lt2000-enrichr-table-body");
    if (enrTbody) {
      const libSel = document.getElementById("select-lt2000-lib");
      const sortSel = document.getElementById("select-lt2000-sort");
      const libVal = libSel ? libSel.value : "ALL";
      const sortVal = sortSel ? sortSel.value : "p_len_adj";
      enrTbody.innerHTML = renderUnbiasedTableRows(unbLtRows, libVal, sortVal);
    }

    // Head-to-Head Add-Back Comparison Table (< 2,000 AA vs All AA when adding back L_AA >= 2,000 AA)
    const abTitleEl = document.getElementById("addback-table-title");
    if (abTitleEl) {
      abTitleEl.innerHTML = `Head-to-Head Comparison: What Happens When We Add Back Genes with L<sub>AA</sub> &ge; 2,000 AA in <span style="color:#0d9488;">${state.group}</span>? (${state.af === "af0001" ? "AF &le; 0.0001" : "AF &le; 0.001"})`;
    }
    const abTbody = document.getElementById("addback-comparison-table-body");
    if (abTbody && DATA.addback_comparison) {
      const abKey = `${state.af}_${state.group}`;
      let abRows = (DATA.addback_comparison[abKey] || []).slice();
      const abFilterEl = document.getElementById("select-addback-filter");
      const abFilter = abFilterEl ? abFilterEl.value : "GAINED_ANY";

      if (abFilter === "GAINED_ANY") {
        abRows = abRows.filter((r) => (r.n_hits_ge2000_added || 0) >= 1).sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      } else if (abFilter === "FUNCTIONAL_MODULES") {
        abRows = abRows.filter((r) => r.library === "Functional_Biological_Modules").sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      } else if (abFilter === "CLINICAL_DISGENET_HPO") {
        abRows = abRows.filter((r) => r.library === "DisGeNET" || r.library === "Human_Phenotype_Ontology").sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      } else if (abFilter === "UNLOCKED_OR_AMPLIFIED") {
        abRows = abRows.filter((r) => r.addback_class === "UNLOCKED_OR_AMPLIFIED").sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      } else if (abFilter === "GIANT_SCAFFOLD_ATTENUATED") {
        abRows = abRows.filter((r) => r.addback_class === "GIANT_SCAFFOLD_ATTENUATED" || ((r.n_hits_ge2000_added || 0) >= 1 && (r.exp_len_adj_all_aa || 0) > 1.5 * (r.exp_unadj_all_aa || 0.1))).sort((a, b) => (a.p_fish_all_aa || 1) - (b.p_fish_all_aa || 1));
      } else if (abFilter === "COMPACT_INVARIANT") {
        abRows = abRows.filter((r) => r.addback_class === "COMPACT_INVARIANT").sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      } else {
        abRows.sort((a, b) => (a.p_len_all_aa || 1) - (b.p_len_all_aa || 1));
      }

      const badgeForClass = (cls) => {
        if (cls === "UNLOCKED_OR_AMPLIFIED") {
          return `<span class="badge" style="background:#0f766e;color:#fff;font-size:0.67rem;">Regime I: Unlocked / Amplified</span>`;
        }
        if (cls === "GIANT_SCAFFOLD_ATTENUATED") {
          return `<span class="badge" style="background:#b45309;color:#fff;font-size:0.67rem;">Regime II: Giant Scaffold (Len-Adjusted)</span>`;
        }
        if (cls === "COMPACT_INVARIANT") {
          return `<span class="badge" style="background:#1d4ed8;color:#fff;font-size:0.67rem;">Regime III: 100% Compact (&lt;2k AA)</span>`;
        }
        return `<span class="badge" style="background:#475569;color:#fff;font-size:0.67rem;">Shared (&lt;2k + &ge;2k)</span>`;
      };

      abTbody.innerHTML = abRows
        .slice(0, 22)
        .map((r) => {
          const shortLib = (r.library || "")
            .replace("_2023", "")
            .replace("_2022", "")
            .replace("_2021_Human", "")
            .replace("_Human", "");
          const dGe = r.n_hits_ge2000_added || 0;
          const ltOrStr = r.n_hits_lt2000 > 0 ? `${Number(r.or_len_lt2000).toFixed(1)}&times; (${fmtP(r.p_len_lt2000)})` : "0 hits";
          const allOrStr = `<strong style="color:#0f766e;">${Number(r.or_len_all_aa).toFixed(1)}&times;</strong> (${formatPCell(r.p_len_all_aa)})`;
          const ltFishStr = r.n_hits_lt2000 > 0 ? `${Number(r.or_fish_lt2000).toFixed(1)}&times;` : "0 hits";
          const allFishStr = `<strong>${Number(r.or_fish_all_aa).toFixed(1)}&times;</strong> (${formatPCell(r.p_fish_all_aa)})`;
          const zStr = `${r.z_comp_lt2000 ? (r.z_comp_lt2000 >= 0 ? "+" : "") + Number(r.z_comp_lt2000).toFixed(2) : "—"} &rarr; <strong>${r.z_comp_all_aa >= 0 ? "+" : ""}${Number(r.z_comp_all_aa).toFixed(2)}</strong>`;
          const geGenesHtml = r.genes_ge2000_added
            ? `<span style="color:#be123c;font-weight:700;">[+&ge;2k AA: ${r.genes_ge2000_added}]</span> `
            : "";
          const ltGenesHtml = r.genes_lt2000
            ? `<span style="color:#1e40af;">[&lt;2k AA: ${r.genes_lt2000}]</span>`
            : "";
          return `
          <tr>
            <td><span class="badge" style="background:#e2e8f0;color:#0f172a;font-size:0.68rem;">${shortLib}</span></td>
            <td><strong>${r.term}</strong></td>
            <td style="white-space:nowrap;">${badgeForClass(r.addback_class)}</td>
            <td style="white-space:nowrap;"><strong>${r.n_hits_lt2000} &rarr; ${r.n_hits_all_aa}/${r.n_univ_all_aa}</strong> ${dGe > 0 ? `<span style="color:#be123c;font-weight:700;">(+${dGe} &ge;2k)</span>` : `<span style="color:#64748b;">(+0)</span>`}</td>
            <td style="white-space:nowrap;">${ltOrStr} &rarr; ${allOrStr}</td>
            <td style="white-space:nowrap;">${ltFishStr} &rarr; ${allFishStr} <span style="color:#64748b;font-size:0.71rem;">(Exp ${Number(r.exp_unadj_all_aa).toFixed(2)}&rarr;${Number(r.exp_len_adj_all_aa).toFixed(2)})</span></td>
            <td style="white-space:nowrap;">${zStr}</td>
            <td style="font-size:0.73rem;line-height:1.35;">${geGenesHtml}${ltGenesHtml}</td>
          </tr>`;
        })
        .join("");
    }

    // Top Significant Compact (< 2,000 AA) Genes Table for Active Cohort
    const topGenesTbody = document.getElementById("lt2000-top-genes-table-body");
    if (topGenesTbody && s.top_genes_lt2000) {
      topGenesTbody.innerHTML = s.top_genes_lt2000
        .slice(0, 25)
        .map((g) => {
          const key = `${g.gene}_${g.group}`;
          return `
          <tr data-key="${key}" style="cursor:pointer;">
            <td><strong>${g.gene}</strong></td>
            <td><span class="pill-group pill-${g.group}">${g.group}</span></td>
            <td>${g.aa_len.toLocaleString()} AA</td>
            <td>${formatPCell(g.p_M7)}</td>
            <td><strong style="color:#be123c;">${g.r2_M7.toFixed(1)}%</strong></td>
            <td style="font-size:0.75rem;color:#334155;">AM ${g.pr2_am.toFixed(1)}% / LoF ${g.pr2_lof.toFixed(1)}% / Con ${g.pr2_con.toFixed(1)}%</td>
          </tr>`;
        })
        .join("");

      topGenesTbody.querySelectorAll("tr").forEach((tr) => {
        tr.addEventListener("click", () => {
          const key = tr.getAttribute("data-key");
          state.selectedGeneKey = key;
          const inspSel = document.getElementById("select-inspector-gene");
          if (inspSel) inspSel.value = key;
          renderGeneInspector();
          renderGeneTable();
        });
      });
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

    if (state.aaLenFilter === "lt2000") {
      rows = rows.filter((r) => (r.aa_len || 0) > 0 && r.aa_len < 2000);
    } else if (state.aaLenFilter === "ge2000") {
      rows = rows.filter((r) => (r.aa_len || 0) >= 2000);
    } else if (state.aaLenFilter === "lt1000") {
      rows = rows.filter((r) => (r.aa_len || 0) > 0 && r.aa_len < 1000);
    }

    if (state.search.trim() !== "") {
      const q = state.search.trim().toUpperCase();
      rows = rows.filter(
        (r) => r.gene.toUpperCase().includes(q) || r.gene_id.toUpperCase().includes(q)
      );
    }

    const activePCol = `p_${state.model}`;
    if (state.sigFilter === "exome") {
      rows = rows.filter(
        (r) =>
          (r[activePCol] !== null && r[activePCol] < EXOME_ALPHA) ||
          (r.p_M7 !== null && r.p_M7 < EXOME_ALPHA) ||
          (r.p_M5 !== null && r.p_M5 < EXOME_ALPHA)
      );
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

  function fmtBetaCell(ebVal, rawVal, lcbVal) {
    if (ebVal === null || ebVal === undefined || isNaN(ebVal)) return "—";
    const ebStr = (ebVal >= 0 ? "+" : "") + Number(ebVal).toFixed(2);
    const rawStr = rawVal !== null && rawVal !== undefined && !isNaN(rawVal) ? (rawVal >= 0 ? "+" : "") + Number(rawVal).toFixed(2) : "—";
    const lcbStr = lcbVal !== null && lcbVal !== undefined && !isNaN(lcbVal) ? (lcbVal >= 0 ? "+" : "") + Number(lcbVal).toFixed(2) : "—";
    const cls = ebVal >= 0.25 ? "style='color:#0f766e;font-weight:700;'" : "";
    return `<span ${cls} title="95% Lower Confidence Bound: ${lcbStr}">${ebStr}</span> <span style="color:#64748b;font-size:0.74rem;">(${rawStr})</span>`;
  }

  function fmtBenchCell(bBench) {
    if (bBench === null || bBench === undefined || isNaN(bBench)) return "—";
    const orVal = Math.exp(Math.min(Math.max(bBench, -5), 8)).toFixed(1);
    return `<strong style="color:#be123c;">+${Number(bBench).toFixed(2)}</strong> <span style="color:#475569;font-size:0.75rem;">(${orVal}&times;)</span>`;
  }

  function renderGeneTable() {
    const rows = getFilteredRows();
    document.getElementById("table-count-label").textContent =
      `Showing ${Math.min(rows.length, 300)} of ${rows.length} matching gene-phenotype pairs (Sorted by ${state.sortCol} ${state.sortAsc ? "ASC" : "DESC"})`;

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
          <td>${formatPCell(r.p_M5)}</td>
          <td>${formatPCell(r.p_M7)}</td>
          <td><strong>${fmtPct(r.r2_M7)}</strong></td>
          <td>${fmtBenchCell(r.b_bench)}</td>
          <td>${fmtBetaCell(r.eb_am, r.b_am, r.lcb_am)}</td>
          <td>${formatPCell(r.p_am)} (${fmtPct(r.pr2_am)})</td>
          <td>${fmtBetaCell(r.eb_lof, r.b_lof, r.lcb_lof)}</td>
          <td>${formatPCell(r.p_lof)} (${fmtPct(r.pr2_lof)})</td>
          <td>${fmtBetaCell(r.eb_con, r.b_con, r.lcb_con)}</td>
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
      "gene_id", "gene", "group", "pathway", "aa_len", "n_var", "n_lof", "n_mis", "n_firth", "max_vif",
      "p_M1_LoF_only", "p_M2_AM_only", "p_M3_Constraint_only", "p_M4_LoF_Constraint",
      "p_M5_AM_LoF", "p_M7_AM_LoF_Constraint", "r2_M7", "delta_log_or_bench",
      "beta_am_raw", "beta_am_eb", "beta_am_lcb95", "p_pathogenicity", "partial_r2_am",
      "beta_lof_raw", "beta_lof_eb", "beta_lof_lcb95", "p_pLoF", "partial_r2_lof",
      "beta_con_raw", "beta_con_eb", "beta_con_lcb95", "p_constraint", "partial_r2_con",
      "browser_min_p"
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.gene_id, r.gene, r.group, r.pathway, r.aa_len, r.n_var, r.n_lof, r.n_mis, r.n_firth, r.vif,
          r.p_M1, r.p_M2, r.p_M3, r.p_M4, r.p_M5, r.p_M7, r.r2_M7, r.b_bench,
          r.b_am, r.eb_am, r.lcb_am, r.p_am, r.pr2_am,
          r.b_lof, r.eb_lof, r.lcb_lof, r.p_lof, r.pr2_lof,
          r.b_con, r.eb_con, r.lcb_con, r.p_con, r.pr2_con,
          r.p_bro
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
    renderLt2000Section();
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

    const rankPresetEl = document.getElementById("select-ranking-preset");
    if (rankPresetEl) {
      rankPresetEl.addEventListener("change", (e) => {
        const parts = e.target.value.split(":");
        state.sortCol = parts[0];
        state.sortAsc = parts[1] === "asc";
        if (state.sortCol !== "p_M7" && state.sortCol !== "p_M5" && state.sigFilter === "all") {
          state.sigFilter = "exome";
          const sigFilterEl = document.getElementById("select-sig-filter");
          if (sigFilterEl) sigFilterEl.value = "exome";
        }
        renderGeneTable();
      });
    }

    document.getElementById("select-sig-filter").addEventListener("change", (e) => {
      state.sigFilter = e.target.value;
      renderGeneTable();
    });

    document.getElementById("select-pathway-filter").addEventListener("change", (e) => {
      state.pathway = e.target.value;
      renderPathwayCards();
      renderLt2000Section();
      renderUnifiedVsBrowserChart();
      renderGeneTable();
    });

    const aaLenSel = document.getElementById("select-aalen-filter");
    if (aaLenSel) {
      aaLenSel.addEventListener("change", (e) => {
        state.aaLenFilter = e.target.value;
        renderLt2000Section();
        renderGeneTable();
      });
    }

    const btnFilterLt2000 = document.getElementById("btn-filter-table-lt2000");
    if (btnFilterLt2000) {
      btnFilterLt2000.addEventListener("click", () => {
        state.aaLenFilter = "lt2000";
        state.sigFilter = "exome";
        if (aaLenSel) aaLenSel.value = "lt2000";
        const sigFilterEl = document.getElementById("select-sig-filter");
        if (sigFilterEl) sigFilterEl.value = "exome";
        renderLt2000Section();
        renderGeneTable();
        const tblSec = document.getElementById("section-gene-table");
        if (tblSec) tblSec.scrollIntoView({ behavior: "smooth" });
      });
    }

    const gsYSelect = document.getElementById("select-genesize-yaxis");
    if (gsYSelect) {
      gsYSelect.addEventListener("change", () => {
        renderGeneSizePlots();
      });
    }

    document.querySelectorAll(".enr-cohort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const coh = btn.getAttribute("data-cohort");
        if (coh) {
          state.group = coh;
          const grpSel = document.getElementById("ctrl-group");
          if (grpSel) grpSel.value = coh;
          refreshAll();
        }
      });
    });

    ["select-allaa-lib", "select-allaa-sort"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          renderPathwayCards();
        });
      }
    });

    ["select-lt2000-regime", "select-lt2000-lib", "select-lt2000-sort", "select-addback-filter"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          renderLt2000Section();
        });
      }
    });

    document.getElementById("btn-export-csv").addEventListener("click", exportTableCSV);

    document.querySelectorAll("table.results-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (state.sortCol === col) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortCol = col;
          const descCols = ["r2_M7", "pr2_am", "pr2_lof", "pr2_con", "b_bench", "eb_am", "b_am", "lcb_am", "eb_lof", "b_lof", "lcb_lof", "eb_con", "b_con", "lcb_con", "aa_len", "n_var"];
          state.sortAsc = !descCols.includes(col);
        }
        renderGeneTable();
      });
    });

    refreshAll();
    renderVariantProfileChart();
  });
})();
