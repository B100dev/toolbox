/* Series RLC — resonance, Q, bandwidth and the frequency response. */
IB.register({
  id: "lc",
  name: "LC Resonance & Filter",
  nav: "Resonance",
  group: "Circuits",
  tag: "Second order · frequency response",
  blurb: "Set L, C and the series resistance and read the resonant frequency, characteristic impedance, "
       + "Q and bandwidth — with the response curve for whichever node you tap.",
  eq: "f₀ = 1/2π√(LC)   ·   Z₀ = √(L/C)   ·   Q = Z₀/R",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { L: 10e-3, C: 100e-6, R: 2, tap: "lp" };

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Resonance" }));
    var T = IB.tiles(top, [
      { id: "f0", k: "Resonance f₀", u: "Hz" },
      { id: "z0", k: "Impedance Z₀", u: "Ω" },
      { id: "q", k: "Q factor", u: "" },
      { id: "bw", k: "Bandwidth", u: "Hz" },
      { id: "zeta", k: "Damping ζ", u: "" },
      { id: "peak", k: "Peak gain", u: "dB" }
    ], 6);
    top.appendChild(el("p", { class: "hint", id: "lcVerdict" }));

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", id: "lcTitle", text: "Magnitude response" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 320", role: "img",
      "aria-label": "Magnitude response in decibels against log frequency, marked at resonance" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint", id: "lcSlope" }));

    var ringPanel = el("div", { class: "panel" });
    left.appendChild(ringPanel);
    ringPanel.appendChild(el("span", { class: "eyebrow", text: "Step response · how it rings" }));
    var rv = svgEl("svg", { viewBox: "0 0 660 260", role: "img",
      "aria-label": "Step response showing overshoot and ringing decay" });
    ringPanel.appendChild(el("div", { class: "scroller" }, [rv]));
    ringPanel.appendChild(el("p", { class: "hint", id: "lcRing" }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Components" }));
    var fL = IB.field(rail, { id: "lc-l", label: "Inductance", unit: "H", value: P.L,
      min: 1e-9, max: 1, log: true, onInput: function (v) { P.L = v; draw(); } });
    var fC = IB.field(rail, { id: "lc-c", label: "Capacitance", unit: "F", value: P.C,
      min: 1e-12, max: 1e-1, log: true, onInput: function (v) { P.C = v; draw(); } });
    var fR = IB.field(rail, { id: "lc-r", label: "Series resistance", unit: "Ω", value: P.R,
      min: 0.001, max: 10000, log: true, onInput: function (v) { P.R = v; draw(); },
      hint: "Coil DCR plus capacitor ESR plus whatever you deliberately add to damp it." });
    IB.select(rail, { id: "lc-tap", label: "Output taken across", value: P.tap,
      options: [
        { value: "lp", label: "The capacitor — low pass" },
        { value: "hp", label: "The inductor — high pass" },
        { value: "bp", label: "The resistor — band pass" }
      ],
      onInput: function (v) { P.tap = v; draw(); } });

    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Starting points" })]),
      el("div", { class: "btnrow" }, [
        preset("Tank (from the animation)", 10e-3, 100e-6, 2),
        preset("AM broadcast, 1 MHz", 220e-6, 115e-12, 6),
        preset("Buck output filter", 33e-6, 220e-6, 0.05),
        preset("Audio crossover, 2 kHz", 1.2e-3, 5.6e-6, 4)
      ])
    ]));
    function preset(label, L, C, R) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.L = L; P.C = C; P.R = R;
        fL.set(L, true); fC.set(C, true); fR.set(R, true);
        draw();
      });
      return b;
    }

    /* ---- response ---- */
    function mag(f) {
      var w = 2 * Math.PI * f;
      var re = 1 - w * w * P.L * P.C, im = w * P.R * P.C;
      var den = Math.sqrt(re * re + im * im);
      if (P.tap === "lp") return 1 / den;
      if (P.tap === "hp") return (w * w * P.L * P.C) / den;
      return (w * P.R * P.C) / den;
    }
    function dB(x) { return 20 * Math.log10(Math.max(x, 1e-9)); }

    function draw() {
      var f0 = 1 / (2 * Math.PI * Math.sqrt(P.L * P.C));
      var z0 = Math.sqrt(P.L / P.C);
      var q = z0 / P.R;
      var bw = f0 / q;
      var zeta = 1 / (2 * q);

      // peak of the selected response
      var lo = f0 / 1000, hi = f0 * 1000, i, N = 420, pts = [], peak = -999, peakF = f0;
      for (i = 0; i <= N; i++) {
        var f = lo * Math.pow(hi / lo, i / N);
        var d = dB(mag(f));
        pts.push([f, d]);
        if (d > peak) { peak = d; peakF = f; }
      }

      T.f0.set(IB.eng(f0, 4));
      T.z0.set(IB.eng(z0, 3));
      T.q.set(IB.sigfig(q, 3), q < 0.5 ? "warnv" : (q > 20 ? "goodv" : ""));
      T.bw.set(IB.eng(bw, 3));
      T.zeta.set(IB.sigfig(zeta, 3));
      T.peak.set(IB.fx(peak, 1), peak > 6 ? "warnv" : "");

      var regime = zeta < 0.999 ? (zeta < 0.4 ? "under-damped and will ring" : "lightly damped")
        : (zeta > 1.001 ? "over-damped — no ringing, but a soft knee" : "critically damped");
      document.getElementById("lcVerdict").textContent =
        "ζ = " + IB.sigfig(zeta, 3) + ": " + regime + ". Energy takes about " +
        IB.sigfig(q / Math.PI, 2) + " cycles to fall to a third once you stop driving it, and the loop "
        + "circulates " + IB.sigfig(q, 3) + "× more volt-amps at resonance than it draws.";

      var names = { lp: "Low pass · across the capacitor", hp: "High pass · across the inductor",
        bp: "Band pass · across the resistor" };
      document.getElementById("lcTitle").textContent = names[P.tap];
      document.getElementById("lcSlope").textContent = P.tap === "bp"
        ? "A band-pass tap rolls off at 6 dB per octave either side and peaks at 0 dB — Q sets how "
          + "sharp the peak is, never how tall."
        : "Past the corner this falls at 40 dB per decade: two energy stores, two poles. Below Q = 0.707 "
          + "the response sags before it ever gets there.";

      var yMin = Math.max(-80, Math.min(-20, peak - 70)), yMax = Math.max(6, peak + 6);
      IB.chart(cv, {
        w: 660, h: 320, pad: [24, 24, 46, 54],
        x: { min: lo, max: hi, log: true, label: "frequency  (Hz)",
             fmt: function (v) { return IB.eng(v, 1); } },
        y: { min: yMin, max: yMax, label: "gain  (dB)", fmt: function (v) { return IB.fx(v, 0); } },
        series: [{ pts: pts, color: "var(--s3)", width: 2.2 }],
        hlines: [
          { y: 0, color: "var(--rule)", dash: "2 4" },
          { y: peak - 3, color: "var(--ink-3)", dash: "4 3", label: "−3 dB" }
        ],
        vlines: [{ x: f0, color: "var(--s2)", dash: "5 4", label: "f₀ " + IB.engU(f0, "Hz", 3) }],
        dots: [{ x: peakF, y: peak, color: "var(--ink)" }]
      });

      // step response of the low-pass node (the one people care about for overshoot)
      var wn = 2 * Math.PI * f0, tEnd = 8 / (zeta * wn > 0 ? zeta * wn : wn), k;
      tEnd = Math.min(tEnd, 40 / wn * Math.max(1, q));
      var sp = [], maxV = 1;
      for (k = 0; k <= 300; k++) {
        var t = tEnd * k / 300, v;
        if (zeta < 1) {
          var wd = wn * Math.sqrt(1 - zeta * zeta);
          v = 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
        } else if (Math.abs(zeta - 1) < 1e-6) {
          v = 1 - Math.exp(-wn * t) * (1 + wn * t);
        } else {
          var s1 = -wn * (zeta - Math.sqrt(zeta * zeta - 1)), s2 = -wn * (zeta + Math.sqrt(zeta * zeta - 1));
          v = 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
        }
        maxV = Math.max(maxV, v);
        sp.push([t * 1000, v]);
      }
      var os = (maxV - 1) * 100;
      IB.chart(rv, {
        w: 660, h: 260, pad: [22, 22, 44, 54],
        x: { min: 0, max: tEnd * 1000, label: "time  (ms)", fmt: function (v) { return IB.sigfig(v, 3); } },
        y: { min: 0, max: Math.max(1.35, maxV * 1.12), label: "× step", fmt: function (v) { return IB.fx(v, 2); } },
        series: [{ pts: sp, color: "var(--s1)", width: 2.1 }],
        hlines: [{ y: 1, color: "var(--rule)", dash: "2 4", label: "settled" }]
      });
      document.getElementById("lcRing").textContent = zeta < 1
        ? "Step the input and the capacitor voltage overshoots by " + IB.fx(os, 1) + " % before settling. "
          + "Damped ring frequency is " + IB.engU(f0 * Math.sqrt(1 - zeta * zeta), "Hz", 3) + "."
        : "Over-damped: no overshoot, but it takes its time getting there.";
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "Series RLC driven by an ideal source. Resonance is where the reactances cancel, "
        + "<code>ω₀ = 1/√(LC)</code>; the characteristic impedance <code>Z₀ = √(L/C)</code> "
        + "is what each of them measures there, and <code>Q = Z₀/R</code> compares that circulating "
        + "impedance with the losses. Bandwidth between the −3 dB points is <code>f₀/Q</code>, and the "
        + "damping ratio is <code>ζ = 1/2Q</code>. The plotted magnitude comes straight from "
        + "<code>H(jω)</code> for the selected node — no approximation — and the step response is "
        + "the standard second-order solution for the capacitor node. Real parts diverge from this: "
        + "capacitor ESR and inductor DCR are lumped into your R, but core loss, self-resonance and "
        + "the source impedance are not modelled, and every real inductor stops being one above its own "
        + "self-resonant frequency." })
    ]));

    draw();
  }
});
