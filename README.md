# Toolbox

Twelve small engineering tools on one static page: two live motor simulations and ten calculators.
No build step, no dependencies, no server — plain HTML, CSS and JavaScript.

**Motors and drives**

| Tool | What it does |
|---|---|
| Brushless motor bench | Six-step BLDC commutation, live: rotating field, Hall sequence, trapezoidal drive, torque–speed curve, loss split |
| Brushed motor bench | Commutator reversing the armature, plus the four classic performance curves |
| Speed, torque & gearing | Reflects a load through a gearbox onto the motor's envelope; finds the ratio that maximises output speed |
| Motor thermal limit | Winding temperature over time, continuous current rating, what duty cycling buys |

**Power conversion**

| Tool | What it does |
|---|---|
| LDO / linear regulator | Headroom vs dropout, dissipation, junction temperature, thermal current limit by package |
| Buck converter | Duty, inductor ripple waveform, CCM/DCM boundary, output ripple, conduction loss budget |

**Circuits**

| Tool | What it does |
|---|---|
| RC / RL time constant | τ, rise and settling times, corner frequency, milestone table |
| LC resonance & filter | f₀, Z₀, Q, bandwidth, Bode magnitude and the step response |
| Voltage divider | Output, loading error, Thévenin impedance, nearest E24 pair |
| Current-limiting resistor | Series resistor sizing, standard value, power rating, sensitivity to Vf spread |

**Wiring and batteries**

| Tool | What it does |
|---|---|
| Wire gauge & drop | AWG geometry, temperature-corrected resistance, voltage drop, copper heating |
| Pack & runtime | Pack voltage, sag from internal resistance, C-rate, discharge curve |

## Publishing on GitHub Pages

1. Create a repository and copy these files into its root (keep the `tools/` folder as-is).
2. Commit and push to `main`.
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then choose
   branch `main` and folder `/ (root)`. Save.
5. Wait for the green check, then open `https://<your-username>.github.io/<repo-name>/`.

To serve it from a subfolder such as `docs/`, put these files there and pick `/docs` in step 4 instead.

## Files

```
index.html          page shell, header, footer, script tags
icon.svg            site icon (master); favicon-32.png, apple-touch-icon.png, icon-512.png are renders of it
app.css             all styling, including the dark theme
app.js              router, number formatting, form fields, the SVG chart renderer
tools/motor.js      brushless motor simulation
tools/brushed.js    brushed motor simulation
tools/drive.js      speed, torque and gearing
tools/thermal.js    motor thermal limit
tools/ldo.js        linear regulator
tools/buck.js       buck converter
tools/rc.js         RC / RL time constant
tools/lc.js         LC resonance and filter
tools/divider.js    voltage divider
tools/limit.js      current-limiting resistor
tools/wire.js       wire gauge and voltage drop
tools/pack.js       battery pack and runtime
.nojekyll           tells GitHub Pages to serve the files as-is
```

## How it works

Each tool registers itself with `IB.register({ id, name, nav, group, tag, blurb, eq, mount })` in `app.js`.
`mount(root, head)` builds that tool's DOM into the page; navigation is hash-based
(`#/motor`, `#/wire`, …), so back and forward work and no server rewrites are needed.
That also means GitHub Pages needs no `404.html` redirect trick — every route is the same file.

To add a tool, copy the shape of `tools/divider.js` (the simplest one), then add a
`<script src="tools/yourtool.js"></script>` line to `index.html` before the `IB.start()` call.
The order of those script tags is the order tools appear in the nav; the index groups them by the `group` field, in the order listed in `GROUP_ORDER` near the bottom of `app.js`.

Shared helpers available to a tool:

- `IB.field(host, {...})` — a labelled number input with an optional linear or logarithmic slider
- `IB.select`, `IB.segmented`, `IB.tiles` — the other control and readout components
- `IB.chart(svgNode, {...})` — one SVG line-chart renderer: linear or log x, series, reference
  lines, point markers, legend
- `IB.eng(x)`, `IB.sigfig(x, n)`, `IB.fx(x, d)` — engineering and fixed-point number formatting
- `IB.store` — best-effort `localStorage` wrapper (used to pass the motor bench's current to the
  pack tool, and to remember the theme)

## Notes

- Fonts load from Google Fonts. Offline, or if you drop those two `<link>` tags, the page falls
  back to the system sans and monospace and everything still works.
- Light and dark themes are both defined explicitly; the toggle in the header sets
  `data-theme` on `<html>` and otherwise the OS preference wins.
- The physics is stated on each tool page, together with what it deliberately ignores.
  The wire ampacity figure is a current-density rule of thumb, not a code table — size real
  installations to NEC 310.16 or the relevant IEC/ISO table.
- If you publish this publicly, consider adding a LICENSE file so others know what they may do
  with it.
