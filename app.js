/**
 * DoRA Geometric Analysis Suite - Main Interactive Application Logic
 * Reads and visualizes dora_analysis_metrics.json with zero missing metrics.
 */

(function () {
  'use strict';

  // Global Application State
  const state = {
    data: null,
    activeTab: 'tab-overview',
    m1Model: 'prose_half1',
    m5Model: 'prose_half1',
    explorer: {
      model: 'prose_half1',
      moduleType: 'ALL',
      attType: 'ALL',
      search: '',
      sortCol: 'layer_num',
      sortAsc: true,
      filteredRows: []
    }
  };

  // DOM Elements
  const elements = {
    statusBadge: document.getElementById('data-status-badge'),
    baseModel: document.getElementById('header-base-model'),
    paramCount: document.getElementById('header-param-count'),
    projections: document.getElementById('header-projections'),
    jsonFileInput: document.getElementById('json-file-input'),
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    // Overview
    benchmarksContainer: document.getElementById('benchmark-cards-container'),
    milestoneTableBody: document.getElementById('milestone-table-body'),
    // Module 1
    m1Select: document.getElementById('m1-model-select'),
    m1TableBody: document.getElementById('m1-table-body'),
    m1TableBadge: document.getElementById('m1-table-badge'),
    m1ChartContainer: document.getElementById('m1-chart-container'),
    // Module 2
    m2TableBody: document.getElementById('m2-table-body'),
    rankInflationShowcase: document.getElementById('rank-inflation-showcase'),
    // Module 3
    m3CardsContainer: document.getElementById('m3-cards-container'),
    m3TableBody: document.getElementById('m3-table-body'),
    // Module 4
    m4AnchoredTableBody: document.getElementById('m4-anchored-table-body'),
    // Module 5
    m5Select: document.getElementById('m5-model-select'),
    m5FrobTableBody: document.getElementById('m5-frob-table-body'),
    m5DynTableBody: document.getElementById('m5-dyn-table-body'),
    m5FrobBadge: document.getElementById('m5-frob-badge'),
    // Explorer
    filterModel: document.getElementById('filter-model'),
    filterModuleType: document.getElementById('filter-module-type'),
    filterAttType: document.getElementById('filter-att-type'),
    filterSearch: document.getElementById('filter-search'),
    filterCountBadge: document.getElementById('filter-count-badge'),
    explorerTableBody: document.getElementById('explorer-table-body'),
    explorerHeaders: document.querySelectorAll('#explorer-table th[data-sort]'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    // Modal
    modalBackdrop: document.getElementById('layer-modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalLayerBadge: document.getElementById('modal-layer-badge'),
    modalBody: document.getElementById('modal-body-content'),
    modalCloseBtn: document.getElementById('modal-close-btn')
  };

  // Helper Formatter Functions
  function fmt(val, precision = 4) {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    return Number(val).toFixed(precision);
  }

  function fmtPct(val, precision = 2) {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    return (Number(val) * 100).toFixed(precision) + '%';
  }

  function fmtSci(val, precision = 1) {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    return Number(val).toExponential(precision);
  }

  function fmtInt(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toLocaleString();
  }

  // =========================================================================
  // Initialization & Data Loading
  // =========================================================================
  async function init() {
    setupEventListeners();
    tryLoadDefaultJson();
  }

  async function tryLoadDefaultJson() {
    // 1. Check if metrics are already embedded via data.js (works 100% on file:// without CORS issues)
    if (window.DORA_METRICS) {
      loadData(window.DORA_METRICS, 'data.js');
      return;
    }

    // 2. Fallback to HTTP fetch if served over a web server
    try {
      elements.statusBadge.textContent = 'Fetching JSON...';
      const response = await fetch('./dora_analysis_metrics.json');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const jsonData = await response.json();
      loadData(jsonData, 'dora_analysis_metrics.json');
    } catch (err) {
      console.warn('Could not auto-fetch ./dora_analysis_metrics.json (likely file:// protocol):', err);
      elements.statusBadge.textContent = 'Click to Select JSON';
      elements.statusBadge.classList.add('badge-amber');
      elements.statusBadge.style.cursor = 'pointer';
      elements.statusBadge.onclick = () => elements.jsonFileInput.click();
    }
  }

  function loadData(jsonData, sourceName = 'metrics.json') {
    state.data = jsonData;
    elements.statusBadge.textContent = `Loaded (${sourceName})`;
    elements.statusBadge.className = 'status-badge';

    // Render metadata
    if (jsonData.meta) {
      const bModel = jsonData.meta.base_model || 'google/gemma-4-E4B';
      const bUrl = jsonData.meta.base_model_hf_url || 'https://huggingface.co/google/gemma-4-E4B';
      elements.baseModel.innerHTML = `<a href="${bUrl}" target="_blank" rel="noopener noreferrer" class="model-hf-link" style="color:var(--accent-cyan); font-weight:600;">${bModel} ↗</a>`;

      const params = jsonData.meta.base_model_total_params;
      const mem = jsonData.meta.base_model_memory_footprint_mb;
      if (params) {
        const pB = (params / 1e9).toFixed(3);
        const mGB = mem ? (mem / 1024).toFixed(2) + ' GB' : '15.25 GB';
        elements.paramCount.textContent = `${pB}B (~${mGB} in bf16)`;
      }
    }

    // Render all tabs
    renderOverview();
    renderModule1();
    renderModule2();
    renderModule3();
    renderModule4();
    renderModule5();
    renderExplorer();

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(err => console.debug('MathJax error:', err));
    }
  }

  // =========================================================================
  // Tab 1: Executive Overview Renderers
  // =========================================================================
  function renderOverview() {
    if (!state.data || !state.data.training_eval_benchmarks) return;
    const benches = state.data.training_eval_benchmarks;

    // Render 4 Model Cards
    elements.benchmarksContainer.innerHTML = '';
    const entries = Object.entries(benches);

    entries.forEach(([expName, b]) => {
      const card = document.createElement('div');
      card.className = 'bench-card';
      const hours = (b.train_runtime_sec / 3600).toFixed(2);
      const isPoetry = expName.includes('poetry');
      const hfUrl = b.huggingface_url || `https://huggingface.co/NIVED2003/gemma-4-E4B-dora-${expName.replace('_', '-')}`;

      card.innerHTML = `
        <div class="bench-header">
          <div>
            <div class="bench-name">
              <a href="${hfUrl}" target="_blank" rel="noopener noreferrer" class="model-hf-link">
                ${expName} ↗
              </a>
            </div>
            <div class="bench-task">${b.direction}</div>
          </div>
          <span class="badge ${isPoetry ? 'badge-amber' : 'badge-emerald'}">${b.domain}</span>
        </div>
        <div class="bench-stats-grid">
          <div class="bench-stat-cell">
            <span class="stat-label">Eval Loss</span>
            <span class="bench-stat-val text-cyan">${fmt(b.final_eval_loss, 3)}</span>
          </div>
          <div class="bench-stat-cell">
            <span class="stat-label">Perplexity</span>
            <span class="bench-stat-val text-emerald">${fmt(b.final_perplexity, 2)}</span>
          </div>
          <div class="bench-stat-cell">
            <span class="stat-label">Train Samples</span>
            <span class="bench-stat-val">${fmtInt(b.train_samples)}</span>
          </div>
          <div class="bench-stat-cell">
            <span class="stat-label">GPU Runtime</span>
            <span class="bench-stat-val">${hours}h</span>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
          <a href="${hfUrl}" target="_blank" rel="noopener noreferrer" class="btn-hf-link">
            <span>🤗</span>
            <span>Hugging Face Model Card ↗</span>
          </a>
          <span class="tag" style="font-family:var(--font-mono); font-size:0.7rem;">r=16 &bull; &alpha;=32</span>
        </div>
      `;
      elements.benchmarksContainer.appendChild(card);
    });

    // Render Milestone Trajectory Table
    elements.milestoneTableBody.innerHTML = '';
    entries.forEach(([expName, b]) => {
      const m = b.milestones;
      const row = document.createElement('tr');
      const deltaLoss = (m['25pct'].eval_loss - m['100pct'].eval_loss).toFixed(3);
      const hfUrl = b.huggingface_url || `https://huggingface.co/NIVED2003/gemma-4-E4B-dora-${expName.replace('_', '-')}`;

      row.innerHTML = `
        <td>
          <a href="${hfUrl}" target="_blank" rel="noopener noreferrer" class="model-hf-link" title="Open on Hugging Face Hub">
            <strong><code>${expName}</code></strong> <span style="font-size:0.85em; color:#fbbf24;">🤗↗</span>
          </a>
        </td>
        <td><span class="tag">${b.direction}</span></td>
        <td><code>${fmt(m['25pct'].eval_loss, 3)}</code> <span class="text-dim">(${fmt(m['25pct'].perplexity, 2)})</span></td>
        <td><code>${fmt(m['50pct'].eval_loss, 3)}</code> <span class="text-dim">(${fmt(m['50pct'].perplexity, 2)})</span></td>
        <td><code>${fmt(m['75pct'].eval_loss, 3)}</code> <span class="text-dim">(${fmt(m['75pct'].perplexity, 2)})</span></td>
        <td><strong class="text-emerald"><code>${fmt(m['100pct'].eval_loss, 3)}</code></strong> <strong class="text-cyan">(${fmt(m['100pct'].perplexity, 2)})</strong></td>
        <td><span class="badge badge-emerald">-${deltaLoss}</span></td>
      `;
      elements.milestoneTableBody.appendChild(row);
    });
  }

  // =========================================================================
  // Tab 2: Module 1 Renderers (Decoupling Dynamics)
  // =========================================================================
  function renderModule1() {
    if (!state.data || !state.data.core_dora_metrics) return;
    const modelKey = state.m1Model;
    const core = state.data.core_dora_metrics[modelKey];
    if (!core) return;

    elements.m1TableBadge.textContent = modelKey;
    elements.m1TableBody.innerHTML = '';

    const moduleTypes = Object.keys(core);
    const chartData = [];

    moduleTypes.forEach(mod => {
      const m = core[mod];
      const r = m.pearson_r;
      const rho = m.spearman_rho;
      const isDecoupled = r < 0;
      chartData.push({ module: mod, r: r, rho: rho });

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong><code>${mod}</code></strong></td>
        <td><code>${fmt(m.mean_delta_M)}</code> <span class="text-dim">(${fmt(m.std_delta_M)})</span></td>
        <td><code>${fmt(m.mean_delta_D)}</code> <span class="text-dim">(${fmt(m.std_delta_D)})</span></td>
        <td><strong class="${r < 0 ? 'text-cyan' : 'text-amber'}">${fmt(r)}</strong> <span class="text-dim">($p=${fmtSci(m.pearson_pvalue)})</span></td>
        <td><code>${fmt(rho)}</code> <span class="text-dim">($p=${fmtSci(m.spearman_pvalue)})</span></td>
        <td><span class="badge ${isDecoupled ? 'badge-cyan' : 'badge-amber'}">${isDecoupled ? 'Flexible Decoupling' : 'Coupled Scaling'}</span></td>
      `;
      elements.m1TableBody.appendChild(row);
    });

    renderModule1Chart(chartData);
  }

  function renderModule1Chart(data) {
    const width = 500;
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Y scale range [-1.0, +1.0]
    const zeroY = margin.top + chartH / 2;
    const barWidth = chartW / data.length - 12;

    let barsSvg = '';
    data.forEach((d, i) => {
      const x = margin.left + i * (barWidth + 12) + 6;
      const rClamped = Math.max(-1, Math.min(1, d.r));
      const barH = Math.abs(rClamped) * (chartH / 2);
      const y = rClamped >= 0 ? zeroY - barH : zeroY;
      const fill = rClamped < 0 ? '#06b6d4' : '#f59e0b';

      barsSvg += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${fill}" opacity="0.85">
          <title>${d.module}: Pearson r = ${fmt(d.r, 3)}</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${height - 15}" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="'JetBrains Mono', monospace">${d.module.replace('_proj', '')}</text>
        <text x="${x + barWidth / 2}" y="${rClamped >= 0 ? y - 6 : y + barH + 14}" fill="${fill}" font-size="11" font-weight="600" text-anchor="middle" font-family="'JetBrains Mono', monospace">${fmt(d.r, 2)}</text>
      `;
    });

    elements.m1ChartContainer.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}">
        <!-- Grid line 0 -->
        <line x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="4,4"/>
        <!-- Y axis limits -->
        <text x="${margin.left - 10}" y="${margin.top + 8}" fill="#64748b" font-size="10" text-anchor="end" font-family="'JetBrains Mono', monospace">+1.0</text>
        <text x="${margin.left - 10}" y="${zeroY + 4}" fill="#64748b" font-size="10" text-anchor="end" font-family="'JetBrains Mono', monospace">0.0</text>
        <text x="${margin.left - 10}" y="${margin.top + chartH}" fill="#64748b" font-size="10" text-anchor="end" font-family="'JetBrains Mono', monospace">-1.0</text>
        <!-- Bars -->
        ${barsSvg}
      </svg>
    `;
  }

  // =========================================================================
  // Tab 3: Module 2 Renderers (Rank Inflation & Extended Diagnostics)
  // =========================================================================
  function renderModule2() {
    if (!state.data || !state.data.extended_geometric_metrics) return;
    const ext = state.data.extended_geometric_metrics;

    elements.m2TableBody.innerHTML = '';
    elements.rankInflationShowcase.innerHTML = '';

    Object.entries(ext).forEach(([expName, e]) => {
      const row = document.createElement('tr');
      const hfUrl = state.data.training_eval_benchmarks?.[expName]?.huggingface_url || `https://huggingface.co/NIVED2003/gemma-4-E4B-dora-${expName.replace('_', '-')}`;

      row.innerHTML = `
        <td>
          <a href="${hfUrl}" target="_blank" rel="noopener noreferrer" class="model-hf-link">
            <strong><code>${expName}</code></strong> <span style="font-size:0.85em; color:#fbbf24;">↗</span>
          </a>
        </td>
        <td><code>${fmt(e.mean_bora_asymmetry_ratio)}</code></td>
        <td><code>${fmt(e.mean_map_magnitude_ratio)}</code></td>
        <td><code>${fmt(e.mean_map_cosine_sim)}</code></td>
        <td><code>${fmt(e.mean_spectral_entropy)}</code></td>
        <td><strong class="text-amber"><code>${fmt(e.mean_r_eff_delta_V)}</code></strong></td>
        <td><strong class="text-cyan"><code>${fmt(e.mean_r_eff_delta_W)}</code></strong></td>
        <td><span class="badge badge-emerald"><strong>${fmt(e.mean_rank_inflation_ratio, 1)}&times;</strong></span></td>
      `;
      elements.m2TableBody.appendChild(row);

      // Rank Inflation Showcase Card
      const showcaseCard = document.createElement('div');
      showcaseCard.className = 'rank-card';
      const rV = e.mean_r_eff_delta_V;
      const rW = e.mean_r_eff_delta_W;
      const ratio = e.mean_rank_inflation_ratio;

      showcaseCard.innerHTML = `
        <div class="rank-card-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${expName}</span>
          <a href="${hfUrl}" target="_blank" rel="noopener noreferrer" class="model-hf-link" style="font-size:0.75rem; color:#fbbf24;">🤗 Hub ↗</a>
        </div>
        <div class="rank-bar-wrap">
          <div class="rank-bar-header">
            <span>Low-Rank Core $\\Delta V$ (Rank &le; 16)</span>
            <strong class="text-amber">${fmt(rV, 2)}</strong>
          </div>
          <div class="rank-bar-track">
            <div class="rank-bar-fill fill-delta-v" style="width: ${(rV / 16) * 100}%;"></div>
          </div>
        </div>
        <div class="rank-bar-wrap">
          <div class="rank-bar-header">
            <span>Full-Rank Merged $\\Delta W$ (Expanded)</span>
            <strong class="text-cyan">${fmt(rW, 1)}</strong>
          </div>
          <div class="rank-bar-track">
            <div class="rank-bar-fill fill-delta-w" style="width: 100%;"></div>
          </div>
        </div>
        <div class="rank-multiplier-badge">
          Rank Inflation: +${fmt(ratio, 1)}&times;
        </div>
      `;
      elements.rankInflationShowcase.appendChild(showcaseCard);
    });
  }

  // =========================================================================
  // Tab 4: Module 3 Renderers (Within-Domain Stability)
  // =========================================================================
  function renderModule3() {
    if (!state.data || !state.data.within_domain_stability) return;
    const within = state.data.within_domain_stability;

    elements.m3CardsContainer.innerHTML = '';
    elements.m3TableBody.innerHTML = '';

    Object.entries(within).forEach(([compKey, comp]) => {
      // Comparison Card
      const card = document.createElement('div');
      card.className = 'stability-card';
      const isPoetry = compKey.includes('poetry');

      card.innerHTML = `
        <div class="stability-header">
          <div class="stability-domain-badge">${compKey}</div>
          <span class="badge ${isPoetry ? 'badge-amber' : 'badge-emerald'}">${isPoetry ? 'Poetry Splits' : 'Prose Splits'}</span>
        </div>
        <div class="grid grid-2">
          <div class="bench-stat-cell">
            <span class="stat-label">Weight Cosine Sim</span>
            <span class="stat-num text-cyan">${fmt(comp.mean_cosine_similarity)}</span>
          </div>
          <div class="bench-stat-cell">
            <span class="stat-label">Top-5% TIES Conflict</span>
            <span class="stat-num text-emerald">${fmtPct(comp.mean_conflict_top_5pct)}</span>
          </div>
        </div>
        <div class="stability-metric-row">
          <div class="stability-metric-label">
            <span>TIES Sign Conflict (Top 5% Coordinates)</span>
            <strong>${fmtPct(comp.mean_conflict_top_5pct)} (vs 50% Null)</strong>
          </div>
          <div class="stability-bar-track">
            <div class="stability-bar-fill" style="width: ${comp.mean_conflict_top_5pct * 100}%; background: var(--accent-emerald);"></div>
          </div>
        </div>
        <div class="stability-metric-row">
          <div class="stability-metric-label">
            <span>Output Space Overlap ($U$, Left Subspace)</span>
            <strong>${fmt(comp.mean_left_subspace_overlap_output)}</strong>
          </div>
          <div class="stability-bar-track">
            <div class="stability-bar-fill" style="width: ${comp.mean_left_subspace_overlap_output * 100 * 3}%; background: var(--accent-cyan);"></div>
          </div>
        </div>
        <div class="stability-metric-row">
          <div class="stability-metric-label">
            <span>Input Space Overlap ($V$, Right Subspace)</span>
            <strong>${fmt(comp.mean_right_subspace_overlap_input)}</strong>
          </div>
          <div class="stability-bar-track">
            <div class="stability-bar-fill" style="width: ${comp.mean_right_subspace_overlap_input * 100 * 3}%; background: var(--accent-indigo);"></div>
          </div>
        </div>
      `;
      elements.m3CardsContainer.appendChild(card);

      // Table Row
      const row = document.createElement('tr');
      const asym = (comp.mean_left_subspace_overlap_output / (comp.mean_right_subspace_overlap_input + 1e-12)).toFixed(2);
      row.innerHTML = `
        <td><strong><code>${compKey}</code></strong></td>
        <td><strong class="text-cyan">${fmt(comp.mean_cosine_similarity)}</strong></td>
        <td><strong class="text-emerald">${fmtPct(comp.mean_conflict_top_5pct)}</strong></td>
        <td>${fmtPct(comp.mean_conflict_top_10pct)}</td>
        <td>${fmtPct(comp.mean_conflict_top_20pct)}</td>
        <td><span class="text-dim">50.00%</span></td>
        <td><code>${fmt(comp.mean_left_subspace_overlap_output)}</code></td>
        <td><code>${fmt(comp.mean_right_subspace_overlap_input)}</code></td>
        <td><span class="badge badge-accent">${asym}&times; Left/Right</span></td>
      `;
      elements.m3TableBody.appendChild(row);
    });
  }

  // =========================================================================
  // Tab 5: Module 4 Renderers (Cross-Domain Divergence)
  // =========================================================================
  function renderModule4() {
    if (!state.data) return;
    const cross = state.data.cross_domain_divergence?.poetry_vs_prose;
    const withinP = state.data.within_domain_stability?.poetry_h1_vs_h2;
    const withinPr = state.data.within_domain_stability?.prose_h1_vs_h2;
    if (!cross || !withinP || !withinPr) return;

    elements.m4AnchoredTableBody.innerHTML = '';

    const metrics = [
      {
        name: 'Weight Update Cosine Similarity',
        cross: cross.mean_cosine_similarity,
        ceilP: withinP.mean_cosine_similarity,
        ceilPr: withinPr.mean_cosine_similarity
      },
      {
        name: 'Left Subspace Overlap (Output Space)',
        cross: cross.mean_left_subspace_overlap_output,
        ceilP: withinP.mean_left_subspace_overlap_output,
        ceilPr: withinPr.mean_left_subspace_overlap_output
      },
      {
        name: 'Right Subspace Overlap (Input Space)',
        cross: cross.mean_right_subspace_overlap_input,
        ceilP: withinP.mean_right_subspace_overlap_input,
        ceilPr: withinPr.mean_right_subspace_overlap_input
      }
    ];

    metrics.forEach(m => {
      const relP = ((m.cross / m.ceilP) * 100).toFixed(2);
      const relPr = ((m.cross / m.ceilPr) * 100).toFixed(2);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${m.name}</strong></td>
        <td><strong class="text-cyan"><code>${fmt(m.cross)}</code></strong></td>
        <td><code>${fmt(m.ceilP)}</code></td>
        <td><span class="badge badge-emerald"><strong>${relP}%</strong></span></td>
        <td><code>${fmt(m.ceilPr)}</code></td>
        <td><span class="badge badge-cyan"><strong>${relPr}%</strong></span></td>
      `;
      elements.m4AnchoredTableBody.appendChild(row);
    });
  }

  // =========================================================================
  // Tab 6: Module 5 Renderers (Two-Way Grouping)
  // =========================================================================
  function renderModule5() {
    if (!state.data || !state.data.two_way_asymmetry) return;
    const modelKey = state.m5Model;
    const tw = state.data.two_way_asymmetry[modelKey];
    if (!tw) return;

    elements.m5FrobBadge.textContent = modelKey;
    elements.m5FrobTableBody.innerHTML = '';
    elements.m5DynTableBody.innerHTML = '';

    const bands = [
      { key: 'early_0_13', label: 'Early (Layers 0–13)' },
      { key: 'mid_14_27', label: 'Mid (Layers 14–27)' },
      { key: 'late_28_41', label: 'Late (Layers 28–41)' }
    ];

    // Frobenius Grid
    bands.forEach(b => {
      const gKey = `${b.key}_x_global`;
      const sKey = `${b.key}_x_sliding_window`;
      const row = document.createElement('tr');

      row.innerHTML = `
        <td><strong>${b.label}</strong></td>
        <td><code class="text-cyan">${fmt(tw[gKey]?.mean_delta_W_frob_norm)}</code></td>
        <td><code>${fmt(tw[sKey]?.mean_delta_W_frob_norm)}</code></td>
        <td><strong><code>${fmt(tw[b.key]?.mean_delta_W_frob_norm)}</code></strong></td>
      `;
      elements.m5FrobTableBody.appendChild(row);
    });

    // Marginal Row
    const margRow = document.createElement('tr');
    margRow.innerHTML = `
      <td><strong>Attention Marginal</strong></td>
      <td><strong class="text-cyan">${fmt(tw['global']?.mean_delta_W_frob_norm)}</strong></td>
      <td><strong>${fmt(tw['sliding_window']?.mean_delta_W_frob_norm)}</strong></td>
      <td>—</td>
    `;
    elements.m5FrobTableBody.appendChild(margRow);

    // Dynamics Grid (Delta M / Delta D)
    bands.forEach(b => {
      const gKey = `${b.key}_x_global`;
      const sKey = `${b.key}_x_sliding_window`;
      const row = document.createElement('tr');

      const mG = fmt(tw[gKey]?.mean_delta_M);
      const mS = fmt(tw[sKey]?.mean_delta_M);
      const dG = fmt(tw[gKey]?.mean_delta_D);
      const dS = fmt(tw[sKey]?.mean_delta_D);

      row.innerHTML = `
        <td><strong>${b.label}</strong></td>
        <td><code>${mG}</code> / <code>${mS}</code></td>
        <td><code>${dG}</code> / <code>${dS}</code></td>
      `;
      elements.m5DynTableBody.appendChild(row);
    });
  }

  // =========================================================================
  // Tab 7: 294 Layer Explorer (Complete Raw Data Inspector)
  // =========================================================================
  function renderExplorer() {
    if (!state.data || !state.data.extended_geometric_metrics) return;
    const modelKey = state.explorer.model;
    const ext = state.data.extended_geometric_metrics[modelKey];
    if (!ext || !ext.per_layer_summary) return;

    let rows = [...ext.per_layer_summary];

    // Filter by Module Type
    if (state.explorer.moduleType !== 'ALL') {
      rows = rows.filter(r => r.module_type === state.explorer.moduleType);
    }

    // Filter by Attention Type
    if (state.explorer.attType !== 'ALL') {
      rows = rows.filter(r => r.attention_type === state.explorer.attType);
    }

    // Filter by Search Query
    if (state.explorer.search) {
      const q = state.explorer.search.toLowerCase();
      rows = rows.filter(r =>
        r.module_name.toLowerCase().includes(q) ||
        String(r.layer_num).includes(q) ||
        r.module_type.toLowerCase().includes(q)
      );
    }

    // Sort Rows
    const col = state.explorer.sortCol;
    const asc = state.explorer.sortAsc;
    rows.sort((a, b) => {
      let vA = a[col];
      let vB = b[col];
      if (typeof vA === 'string') vA = vA.toLowerCase();
      if (typeof vB === 'string') vB = vB.toLowerCase();
      if (vA < vB) return asc ? -1 : 1;
      if (vA > vB) return asc ? 1 : -1;
      return 0;
    });

    state.explorer.filteredRows = rows;
    elements.filterCountBadge.textContent = `Showing ${rows.length} of 294 Projections`;

    elements.explorerTableBody.innerHTML = '';
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge badge-info">L${r.layer_num}</span></td>
        <td><strong><code>${r.module_type}</code></strong></td>
        <td><span class="tag">${r.attention_type}</span></td>
        <td><span class="text-amber"><code>${fmt(r.r_eff_delta_V, 2)}</code></span></td>
        <td><span class="text-cyan"><code>${fmt(r.r_eff_delta_W, 1)}</code></span></td>
        <td><strong class="text-emerald">${fmt(r.rank_inflation_ratio, 1)}&times;</strong></td>
        <td><code>${fmt(r.map_magnitude_ratio)}</code></td>
        <td><code>${fmt(r.map_cosine_sim)}</code></td>
        <td><code>${fmt(r.spectral_entropy)}</code></td>
        <td><code>${fmt(r.bora_asymmetry_ratio)}</code></td>
        <td><button class="btn btn-secondary btn-xs" data-inspect-idx="${idx}">Inspect</button></td>
      `;

      tr.onclick = (e) => {
        if (!e.target.closest('button')) {
          showLayerModal(r);
        }
      };
      tr.querySelector('button').onclick = () => showLayerModal(r);

      elements.explorerTableBody.appendChild(tr);
    });
  }

  function showLayerModal(layerData) {
    elements.modalLayerBadge.textContent = `Layer ${layerData.layer_num} • ${layerData.attention_type}`;
    elements.modalTitle.textContent = layerData.module_name;

    elements.modalBody.innerHTML = `
      <div class="modal-metric-grid">
        <div class="modal-metric-item">
          <span class="modal-metric-label">Module Type</span>
          <span class="modal-metric-val text-cyan">${layerData.module_type}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">Attention Architecture</span>
          <span class="modal-metric-val">${layerData.attention_type}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">r_eff(&Delta;V) [Core Rank &le; 16]</span>
          <span class="modal-metric-val text-amber">${fmt(layerData.r_eff_delta_V, 4)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">r_eff(&Delta;W) [Full Merged Update]</span>
          <span class="modal-metric-val text-cyan">${fmt(layerData.r_eff_delta_W, 2)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">Rank Inflation Multiplier</span>
          <span class="modal-metric-val text-emerald">${fmt(layerData.rank_inflation_ratio, 2)}&times;</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">MAP Magnitude Ratio ||W'|| / ||W0||</span>
          <span class="modal-metric-val">${fmt(layerData.map_magnitude_ratio, 6)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">MAP Global Matrix Cosine Sim</span>
          <span class="modal-metric-val text-emerald">${fmt(layerData.map_cosine_sim, 6)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">BiDoRA Spectral Entropy</span>
          <span class="modal-metric-val">${fmt(layerData.spectral_entropy, 4)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">Top-1 Dominance ($\lambda_1 / \sum \lambda_i$)</span>
          <span class="modal-metric-val">${fmtPct(layerData.top1_dominance)}</span>
        </div>
        <div class="modal-metric-item">
          <span class="modal-metric-label">BoRA Row vs Col Asymmetry</span>
          <span class="modal-metric-val">${fmt(layerData.bora_asymmetry_ratio, 4)}</span>
        </div>
      </div>
    `;

    elements.modalBackdrop.classList.add('active');
  }

  function exportVisibleAsCsv() {
    const rows = state.explorer.filteredRows;
    if (!rows || rows.length === 0) return;

    const headers = [
      'module_name',
      'layer_num',
      'module_type',
      'attention_type',
      'r_eff_delta_V',
      'r_eff_delta_W',
      'rank_inflation_ratio',
      'map_magnitude_ratio',
      'map_cosine_sim',
      'spectral_entropy',
      'top1_dominance',
      'bora_asymmetry_ratio'
    ];

    const csvLines = [headers.join(',')];
    rows.forEach(r => {
      const line = headers.map(h => r[h] !== undefined ? r[h] : '').join(',');
      csvLines.push(line);
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dora_layers_${state.explorer.model}_${rows.length}modules.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.navTabs.forEach(t => t.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        state.activeTab = tabId;
      });
    });

    // File Input
    elements.jsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const json = JSON.parse(evt.target.result);
          loadData(json, file.name);
        } catch (err) {
          alert('Error parsing JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Module 1 Model Selector
    elements.m1Select.addEventListener('change', (e) => {
      state.m1Model = e.target.value;
      renderModule1();
    });

    // Module 5 Model Selector
    elements.m5Select.addEventListener('change', (e) => {
      state.m5Model = e.target.value;
      renderModule5();
    });

    // Explorer Filters
    elements.filterModel.addEventListener('change', (e) => {
      state.explorer.model = e.target.value;
      renderExplorer();
    });

    elements.filterModuleType.addEventListener('change', (e) => {
      state.explorer.moduleType = e.target.value;
      renderExplorer();
    });

    elements.filterAttType.addEventListener('change', (e) => {
      state.explorer.attType = e.target.value;
      renderExplorer();
    });

    elements.filterSearch.addEventListener('input', (e) => {
      state.explorer.search = e.target.value;
      renderExplorer();
    });

    // Explorer Column Sort
    elements.explorerHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (state.explorer.sortCol === col) {
          state.explorer.sortAsc = !state.explorer.sortAsc;
        } else {
          state.explorer.sortCol = col;
          state.explorer.sortAsc = true;
        }
        renderExplorer();
      });
    });

    // Export CSV
    elements.btnExportCsv.addEventListener('click', exportVisibleAsCsv);

    // Modal Close
    elements.modalCloseBtn.addEventListener('click', () => {
      elements.modalBackdrop.classList.remove('active');
    });

    elements.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.modalBackdrop) {
        elements.modalBackdrop.classList.remove('active');
      }
    });

    // Drag and Drop on Body
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const json = JSON.parse(evt.target.result);
              loadData(json, file.name);
            } catch (err) {
              alert('Error reading dropped JSON: ' + err.message);
            }
          };
          reader.readAsText(file);
        }
      }
    });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
