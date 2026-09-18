/* RC / RL first-order step response — time constant, rise times, corner frequency. */
IB.register({
  id: "rc",
  name: "RC / RL Time Constant",
  nav: "Time constant",
  tag: "First order · step response",
  blurb: "One resistor, one storage element, one exponential. Read off τ, the rise and settling "
       + "times, the corner frequency, and how far along the curve you are at any instant.",
  eq: "τ = RC  or  L/R   ·   fc = 1 / 2πτ   ·   t10→90 = 2.2τ",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { mode: "rc-charge", R: 10000, C: 100e-9, L: 10e-3, V: 5, tcur: 1 };

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Constants" }));
    var T = IB.tiles(top, [
      { id: "tau", k: "Time constant τ", u: "" },
      { id: "fc", k: "Corner frequency", u: "" },
      { id: "rise", k: "10 → 90 %", u: "" },
      { id: "settle", k: "To 99 % (5τ)", u: "" },
      { id: "now", k: "At the cursor", u: "" },
      { id: "energy", k: "Energy stored", u: "" }
    ], 6);

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", id: "rcTitle", text: "Step response" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 320", role: "img",
      "aria-label": "Exponential step response with time-constant markers and a movable cursor" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint",
      text: "Each time constant closes 63.2 % of whatever gap is left — which is why the curve is "
          + "practically finished at 5τ no matter where it started." }));

    var tablePanel = el("div", { class: "panel" });
    left.appendChild(tablePanel);
    tablePanel.appendChild(el("span", { class: "eyebrow", text: "Milestones" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); tablePanel.appendChild(tw);

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Circuit" }));
    IB.select(rail, { id: "rc-mode", label: "Configuration", value: P.mode,
      options: [
        { value: "rc-charge", label: "RC charging (V across C)" },
        { value: "rc-discharge", label: "RC discharging" },
        { value: "rl", label: "RL current rise (I in L)" }
      ],
      onInput: function (v) { P.mode = v; sync(); draw(); } });
    var fV = IB.field(rail, { id: "rc-v", label: "Supply", unit: "V", value: P.V, min: 0.1, max: 60,
      step: 0.1, onInput: function (v) { P.V = v; draw(); } });
    var fR = IB.field(rail, { id: "rc-r", label: "Resistance", unit: "Ω", value: P.R,
      min: 0.1, max: 1e7, log: true, onInput: function (v) { P.R = v; draw(); } });
    var fC = IB.field(rail, { id: "rc-c", label: "Capacitance", unit: "F", value: P.C,
      min: 1e-12, max: 1e-1, log: true, onInput: function (v) { P.C = v; draw(); },
      hint: "Type it in farads — 100 nF is 1e-7." });
    var fL = IB.field(rail, { id: "rc-l", label: "Inductance", unit: "H", value: P.L,
      min: 1e-9, max: 10, log: true, onInput: function (v) { P.L = v; draw(); } });
    var fT = IB.field(rail, { id: "rc-t", label: "Cursor at", unit: "τ", value: P.tcur,
      min: 0, max: 5, step: 0.01, onInput: function (v) { P.tcur = v; draw(); },
      hint: "In time constants, so it stays meaningful whatever R and C you pick." });

    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Common values" })]),
      el("div", { class: "btnrow" }, [
        preset("Debounce", { R: 10000, C: 100e-9 }),
        preset("Anti-alias 1 kHz", { R: 1600, C: 100e-9 }),
        preset("RC reset", { R: 47000, C: 1e-6 }),
        preset("Buck inductor", { R: 0.5, L: 33e-6, mode: "rl" })
      ])
    ]));
    function preset(label, vals) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        if (vals.mode) { P.mode = vals.mode; document.getElementById("rc-mode").value = vals.mode; sync(); }
        if (vals.R !== undefined) { P.R = vals.R; fR.set(vals.R, true); }
        if (vals.C !== undefined) { P.C = vals.C; fC.set(vals.C, true); }
        if (vals.L !== undefined) { P.L = vals.L; fL.set(vals.L, true); }
        draw();
      });
      return b;
    }

    function isRL() { return P.mode === "rl"; }
    function sync() {
      fC.el.hidden = isRL();
      fL.el.hidden = !isRL();
      document.getElementById("rcTitle").textContent = isRL()
        ? "Current rise in the inductor" : (P.mode === "rc-charge" ? "Capacitor charging" : "Capacitor discharging");
    }

    function draw() {
      var tau = isRL() ? P.L / P.R : P.R * P.C;
      var fc = 1 / (2 * Math.PI * tau);
      var final = isRL() ? P.V / P.R : P.V;                 // amps for RL, volts for RC
      var unit = isRL() ? "A" : "V";
      var rising = P.mode !== "rc-discharge";

      function val(t) {
        var k = 1 - Math.exp(-t / tau);
        return rising ? final * k : final * Math.exp(-t / tau);
      }

      var energy = isRL() ? 0.5 * P.L * final * final : 0.5 * P.C * P.V * P.V;
      T.tau.set(IB.engU(tau, "s", 3));
      T.fc.set(IB.engU(fc, "Hz", 3));
      T.rise.set(IB.engU(2.1972 * tau, "s", 3));
      T.settle.set(IB.engU(5 * tau, "s", 3));
      T.now.set(IB.sigfig(val(P.tcur * tau), 3) + " " + unit);
      T.energy.set(IB.engU(energy, "J", 3));

      // curve over 5 tau
      var pts = [], i, N = 240;
      for (i = 0; i <= N; i++) {
        var t = 5 * tau * i / N;
        pts.push([t / tau, val(t)]);
      }
      var yMax = final * 1.16;
      IB.chart(cv, {
        w: 660, h: 320, pad: [24, 22, 46, 58],
        x: { min: 0, max: 5, label: "time  (time constants, τ = " + IB.engU(tau, "s", 3) + ")",
             ticks: [0, 1, 2, 3, 4, 5], fmt: function (v) { return v + "τ"; } },
        y: { min: 0, max: yMax, label: (isRL() ? "current  (A)" : "voltage  (V)"),
             fmt: function (v) { return IB.sigfig(v, 3); } },
        series: [{ pts: pts, color: rising ? "var(--s2)" : "var(--s1)", width: 2.3, fill: true,
                   fillOpacity: 0.13 }],
        hlines: [
          { y: final, color: "var(--rule)", dash: "2 4", label: IB.sigfig(final, 3) + " " + unit + " final" },
          { y: rising ? final * 0.632 : final * 0.368, color: "var(--ink-3)", dash: "4 3",
            label: rising ? "63.2 % at 1τ" : "36.8 % at 1τ" }
        ],
        vlines: [{ x: 1, color: "var(--ink-3)", dash: "4 3" }],
        dots: [{ x: P.tcur, y: val(P.tcur * tau), color: "var(--ink)",
                 label: IB.sigfig(val(P.tcur * tau), 3) + " " + unit }]
      });

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Elapsed" }), el("th", { text: "Time" }),
        el("th", { text: rising ? "Reached" : "Remaining" }), el("th", { text: isRL() ? "Current" : "Voltage" })
      ])]));
      var tb = el("tbody", {});
      [0.5, 1, 2, 3, 4, 5].forEach(function (k) {
        var pct = rising ? (1 - Math.exp(-k)) * 100 : Math.exp(-k) * 100;
        tb.appendChild(el("tr", { class: Math.abs(k - P.tcur) < 0.03 ? "on" : "" }, [
          el("td", { text: k + "τ" }),
          el("td", { text: IB.engU(k * tau, "s", 3) }),
          el("td", { text: IB.fx(pct, pct > 99 ? 2 : 1) + " %" }),
          el("td", { text: IB.sigfig(val(k * tau), 4) + " " + unit })
        ]));
      });
      tab.appendChild(tb);

      fR.hint(isRL()
        ? "With " + IB.eng(P.R, 3) + "Ω in the loop the current settles at " + IB.sigfig(final, 3) + " A."
        : "Charging current starts at V/R = " + IB.engU(P.V / P.R, "A", 3) + " and decays with the same τ.");
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "A single energy store behind a single resistance always gives <code>x(t) = x∞ + (x₀ − x∞)"
        + "e^(−t/τ)</code>. For RC, τ = RC and the capacitor voltage rises; for RL, τ = L/R and "
        + "the inductor current rises while its voltage decays. One τ covers 63.2 % of the remaining gap, "
        + "three covers 95 %, five covers 99.3 %. The 10–90 % rise time is <code>τ·ln9 = 2.197τ</code>, "
        + "and the −3 dB corner of the same network is <code>1/2πτ</code> — the step and frequency "
        + "views are the same fact. Stored energy is ½CV² or ½LI². Ideal parts only: no ESR, no "
        + "leakage, no core saturation, and a source that can deliver the initial V/R inrush." })
    ]));

    sync(); draw();
  }
});
