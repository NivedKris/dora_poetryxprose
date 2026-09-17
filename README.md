# DoRA Geometric Analysis Suite - Web Application Dashboard

A standalone, zero-dependency, publication-grade interactive web application for exploring the empirical metrics of **Weight-Decomposed Low-Rank Adaptation (DoRA)** on `google/gemma-4-E4B` ($r=16, \alpha=32$).

---

## What's Inside This Directory

- **`index.html`**: Complete semantic single-page application structure.
- **`style.css`**: Modern dark-mode aesthetic design system with responsive layouts, glowing indicators, cards, and data tables.
- **`app.js`**: Interactive rendering engine for all 5 geometric modules, milestone trajectories, 2D cross-tabulation grids, search/filter table for all 294 target linear projection layers, and CSV export.
- **`data.js`**: Lightweight JavaScript data wrapper that enables the dashboard to load **instantly when double-clicking `index.html` locally via `file://`**, completely bypassing browser CORS restrictions!
- **`dora_analysis_metrics.json`**: The complete raw numerical database (1.34 MB, 29,619 lines) containing every layer decomposition, correlation, effective rank, TIES sign conflict, and subspace overlap.

---

## How to Run & View the Application

### Option 1: Using Python HTTP Server (Recommended)

From the root or dashboard folder, launch a lightweight local server:

```bash
cd /home/pawangcs/NK/dora_dashboard
python3 -m http.server 8080
```

Then open your browser at:
```
http://localhost:8080
```
The application will automatically fetch and load `./dora_analysis_metrics.json` with zero configuration.

### Option 2: Direct File Opening in Browser

You can also open `index.html` directly in any web browser:
```bash
# Example with Chrome or Firefox
google-chrome /home/pawangcs/NK/dora_dashboard/index.html
# or
firefox /home/pawangcs/NK/dora_dashboard/index.html
```

> **Note on local file security (`file://`):** If your browser blocks local `fetch()` requests on the `file://` protocol, simply click the **"Load Metrics JSON"** button in the top navigation bar and select `dora_analysis_metrics.json` (or drag and drop it onto the page). The app parses it instantly in memory!

---

## Features & Modules Included ("Nothing Missing")

1. **Executive Overview & Benchmarks:**
   - 4 Model Training benchmark cards (`poetry_half1`, `poetry_half2`, `prose_half1`, `prose_half2`) with eval losses, perplexities, sample counts, and H100 runtimes.
   - Milestone Generalization Trajectory table tracking eval loss and perplexity across 25%, 50%, 75%, and 100% checkpoints.
   - Classical Verse Poetry vs Contemporary Prose linguistic scope visualizer.

2. **Module 1: Decoupling Dynamics ($\Delta M$ vs $\Delta D$):**
   - Disaggregated per-module statistics across all 42 layers for all 7 linear projections (`q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`).
   - Pearson $r$, Spearman $\rho$, $p$-values, mean and std of $\Delta M$ and $\Delta D$.
   - Interactive SVG correlation profile chart displaying the attention decoupling vs MLP coupled scaling dichotomy.

3. **Module 2: Extended Diagnostics & Rank Inflation:**
   - BoRA Row vs Col Asymmetry ($0.998 - 1.004$).
   - MAP Magnitude Retention $\|W'\|_F / \|W_0\|_F$ and global matrix cosine similarity ($0.9993 - 0.9999$).
   - BiDoRA Spectral Entropy and Top-1 Dominance.
   - **Empirical Rank Inflation Showcase:** Visual comparison between the low-rank update core $r_{\text{eff}}(\Delta V) \approx 9.8 - 11.1$ (bounded by $r=16$) vs full merged update $r_{\text{eff}}(\Delta W) \approx 800$, showing the **$83\times - 104\times$ rank expansion**.

4. **Module 3: Within-Domain Stability:**
   - Side-by-side comparison of independent splits: `poetry_h1_vs_h2` vs `prose_h1_vs_h2`.
   - TIES Sign Conflict breakdown on top-5%, top-10%, and top-20% high-magnitude coordinates vs random chance ($50\%$).
   - Left (Output) vs Right (Input) Grassmannian subspace overlap showing $2\times$ asymmetry.

5. **Module 4: Cross-Domain Divergence & Anchored Alignment:**
   - Anchored Relative Divergence Index: Cross-domain alignment normalized against both Poetry and Prose within-domain empirical ceilings (showing $\mathbf{45.86\%}$ relative cosine alignment).
   - Practical model merging readiness guidance (DARE/TIES sign pruning).

6. **Module 5: Two-Way Grouping:**
   - Interactive 2D cross-tabulation grid: **Depth Bands** (Early 0–13, Mid 14–27, Late 28–41) $\times$ **Attention Architecture** (Global vs Local Sliding-Window).
   - Frobenius update norm $\|\Delta W\|_F$, $\Delta M$, and $\Delta D$ matrix grids for all 4 models.

7. **All 294 Layer Explorer (Complete Raw Tensor Inspector):**
   - Filter by Model Split, Module Type (7 types), Attention Architecture (Global / Sliding-Window).
   - Live text search across all layer numbers and module names.
   - Sortable columns (Layer, Module, $r_{\text{eff}}(\Delta V)$, $r_{\text{eff}}(\Delta W)$, Inflation Factor, MAP ratio, CosSim, Entropy).
   - One-click modal inspection of individual projection metrics.
   - **Export to CSV:** Download any filtered view of the 294 layers into a CSV file.

8. **Theoretical Foundations & Mathematical Reference:**
   - Complete mathematical definitions and notation formulas.
