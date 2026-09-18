/* Buck converter — duty, inductor ripple, output ripple, loss budget. */
IB.register({
  id: "buck",
  name: "Buck Converter",
  nav: "Buck",
  group: "Power conversion",
  tag: "Step-down · switching",
  blurb: "Pick an inductor and a switching frequency and see the ripple you get, where continuous "
       + "conduction ends, and which loss is actually costing you the efficiency.",
  eq: "D ≈ Vout/Vin   ·   ΔIL = (Vin−Vout)·D / (L·f)",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { vin: 12, vout: 5, iout: 2, f: 500e3, L: 10e-6, C: 47e-6, esr: 0.01,
              rds: 0.030, dcr: 0.040, vd: 0.4 };

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Operating point" }));
    var T = IB.tiles(top, [
      { id: "duty", k: "Duty cycle", u: "%" },
      { id: "ripple", k: "Inductor ripple", u: "A" },
      { id: "rr", k: "Ripple ratio", u: "%" },
      { id: "ipk", k: "Peak inductor", u: "A" },
      { id: "vr", k: "Output ripple", u: "" },
      { id: "eff", k: "Efficiency", u: "%" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "buckChips" }));
    top.appendChild(el("p", { class: "hint", id: "buckHint" }));

    var wavePanel = el("div", { class: "panel" });
    left.appendChild(wavePanel);
    wavePanel.appendChild(el("span", { class: "eyebrow", text: "Inductor current · two switching periods" }));
    var wv = svgEl("svg", { viewBox: "0 0 660 300", role: "img",
      "aria-label": "Triangular inductor current waveform around the DC output current" });
    wavePanel.appendChild(el("div", { class: "scroller" }, [wv]));
    wavePanel.appendChild(el("p", { class: "hint", id: "waveHint" }));

    var lPanel = el("div", { class: "panel" });
    left.appendChild(lPanel);
    lPanel.appendChild(el("span", { class: "eyebrow", text: "Ripple against inductance" }));
    var lv = svgEl("svg", { viewBox: "0 0 660 280", role: "img",
      "aria-label": "Ripple ratio against inductance with the 30 percent design target" });
    lPanel.appendChild(el("div", { class: "scroller" }, [lv]));
    lPanel.appendChild(el("p", { class: "hint", id: "lHint" }));

    var lossPanel = el("div", { class: "panel" });
    left.appendChild(lossPanel);
    lossPanel.appendChild(el("span", { class: "eyebrow", text: "Loss budget · estimate" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); lossPanel.appendChild(tw);

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Converter" }));
    var fVin = IB.field(rail, { id: "bk-vin", label: "Input voltage", unit: "V", value: P.vin,
      min: 1, max: 60, step: 0.1, onInput: function (v) { P.vin = v; draw(); } });
    var fVout = IB.field(rail, { id: "bk-vout", label: "Output voltage", unit: "V", value: P.vout,
      min: 0.5, max: 50, step: 0.1, onInput: function (v) { P.vout = v; draw(); } });
    var fI = IB.field(rail, { id: "bk-i", label: "Output current", unit: "A", value: P.iout,
      min: 0.01, max: 40, log: true, onInput: function (v) { P.iout = v; draw(); } });
    var fF = IB.field(rail, { id: "bk-f", label: "Switching frequency", unit: "kHz", value: P.f / 1000,
      min: 20, max: 4000, log: true, onInput: function (v) { P.f = v * 1000; draw(); } });
    var fL = IB.field(rail, { id: "bk-l", label: "Inductor", unit: "µH", value: P.L * 1e6,
      min: 0.1, max: 2000, log: true, onInput: function (v) { P.L = v / 1e6; draw(); } });
    var fC = IB.field(rail, { id: "bk-c", label: "Output capacitance", unit: "µF", value: P.C * 1e6,
      min: 0.1, max: 10000, log: true, onInput: function (v) { P.C = v / 1e6; draw(); } });
    var fEsr = IB.field(rail, { id: "bk-esr", label: "Capacitor ESR", unit: "mΩ", value: P.esr * 1000,
      min: 0.1, max: 2000, log: true, onInput: function (v) { P.esr = v / 1000; draw(); },
      hint: "Ceramics are 2–10 mΩ; an electrolytic is hundreds, and its ESR usually dominates "
          + "the output ripple." });
    var fRds = IB.field(rail, { id: "bk-rds", label: "MOSFET Rds(on)", unit: "mΩ", value: P.rds * 1000,
      min: 0.5, max: 500, log: true, onInput: function (v) { P.rds = v / 1000; draw(); } });
    var fDcr = IB.field(rail, { id: "bk-dcr", label: "Inductor DCR", unit: "mΩ", value: P.dcr * 1000,
      min: 0.5, max: 2000, log: true, onInput: function (v) { P.dcr = v / 1000; draw(); } });
    var fVd = IB.field(rail, { id: "bk-vd", label: "Low-side drop", unit: "V", value: P.vd,
      min: 0, max: 1.2, step: 0.05, onInput: function (v) { P.vd = v; draw(); },
      hint: "0 for a synchronous converter, 0.3–0.5 V for a Schottky, 0.7 V for a silicon diode." });

    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Typical designs" })]),
      el("div", { class: "btnrow" }, [
        preset("12 → 5 V, 2 A", 12, 5, 2, 500, 10, 47),
        preset("24 → 12 V, 3 A", 24, 12, 3, 350, 22, 100),
        preset("5 → 3.3 V, 1 A", 5, 3.3, 1, 1000, 4.7, 22),
        preset("48 → 12 V, 5 A", 48, 12, 5, 250, 33, 220)
      ])
    ]));
    function preset(label, vin, vout, i, kHz, uH, uF) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.vin = vin; P.vout = vout; P.iout = i; P.f = kHz * 1000; P.L = uH / 1e6; P.C = uF / 1e6;
        fVin.set(vin, true); fVout.set(vout, true); fI.set(i, true);
        fF.set(kHz, true); fL.set(uH, true); fC.set(uF, true);
        draw();
      });
      return b;
    }

    function duty() {
      // include the conduction drops so the duty is not the idealised ratio
      var vsw = P.iout * P.rds, vl = P.iout * P.dcr;
      return IB.clamp((P.vout + vl + P.vd) / (P.vin - vsw + P.vd), 0, 1);
    }
    function dIL(L) { return (P.vin - P.vout) * duty() / (L * P.f); }

    function draw() {
      var D = duty(), di = dIL(P.L);
      var rr = di / Math.max(P.iout, 1e-9);
      var ipk = P.iout + di / 2, ivalley = P.iout - di / 2;
      var vRippleC = di / (8 * P.C * P.f), vRippleE = di * P.esr;
      var vr = vRippleC + vRippleE;
      var iBoundary = di / 2;                         // below this DC current it enters DCM

      // losses
      var irms2 = P.iout * P.iout + di * di / 12;      // RMS^2 of the triangle on a DC level
      var pHigh = irms2 * P.rds * D;
      var pLow = P.vd > 0 ? P.iout * P.vd * (1 - D) : irms2 * P.rds * (1 - D);
      var pDcr = irms2 * P.dcr;
      var pOut = P.vout * P.iout;
      var pLoss = pHigh + pLow + pDcr;
      var eff = pOut / (pOut + pLoss);

      T.duty.set(IB.fx(D * 100, 1));
      T.ripple.set(IB.sigfig(di, 3));
      T.rr.set(IB.fx(rr * 100), rr > 0.6 ? "hot" : (rr > 0.45 || rr < 0.15 ? "warnv" : "goodv"));
      T.ipk.set(IB.sigfig(ipk, 3));
      T.vr.set(IB.engU(vr, "V", 3), vr / P.vout > 0.02 ? "warnv" : "");
      T.eff.set(IB.fx(eff * 100, 1), eff < 0.85 ? "warnv" : "goodv");

      var chips = document.getElementById("buckChips");
      IB.clear(chips);
      chips.appendChild(el("span", { class: "chip on " + (P.iout > iBoundary ? "good" : "warn"),
        text: P.iout > iBoundary ? "continuous conduction above " + IB.sigfig(iBoundary, 3) + " A"
          : "discontinuous — below the " + IB.sigfig(iBoundary, 3) + " A boundary" }));
      chips.appendChild(el("span", { class: "chip on " + (rr > 0.6 ? "crit" : rr > 0.45 || rr < 0.15 ? "warn" : "good"),
        text: IB.fx(rr * 100) + " % ripple ratio (aim for 30 %)" }));
      chips.appendChild(el("span", { class: "chip on " + (D > 0.9 || D < 0.08 ? "warn" : "good"),
        text: IB.fx(D * 100, 1) + " % duty" }));

      document.getElementById("buckHint").textContent =
        "The inductor sees " + IB.sigfig(P.vin - P.vout, 3) + " V while the high side is on and "
        + IB.sigfig(P.vout, 3) + " V the rest of the time, so its current ramps " + IB.sigfig(di, 3)
        + " A peak-to-peak around the " + IB.sigfig(P.iout, 3) + " A output. Peak current is "
        + IB.sigfig(ipk, 3) + " A — that, not the average, is what has to stay below the "
        + "inductor's saturation rating and the switch's current limit.";

      // inductor current waveform, two periods
      var Tp = 1 / P.f, pts = [], k, N = 200;
      for (k = 0; k <= N; k++) {
        var t = 2 * Tp * k / N, ph = (t % Tp) / Tp, i;
        if (ph < D) i = ivalley + di * (ph / D);
        else i = ipk - di * ((ph - D) / (1 - D));
        pts.push([t * 1e6, i]);
      }
      IB.chart(wv, {
        w: 660, h: 300, pad: [26, 24, 46, 56],
        x: { min: 0, max: 2 * Tp * 1e6, label: "time  (µs)", fmt: function (v) { return IB.sigfig(v, 3); } },
        y: { min: Math.min(0, ivalley - di * 0.25), max: ipk + di * 0.35, label: "inductor current  (A)",
             fmt: function (v) { return IB.sigfig(v, 3); } },
        series: [{ pts: pts, color: "var(--s1)", width: 2.2, fill: true, fillTo: 0, fillOpacity: 0.1 }],
        hlines: [
          { y: P.iout, color: "var(--s2)", dash: "5 4", label: "DC output " + IB.sigfig(P.iout, 3) + " A" },
          { y: ipk, color: "var(--ink-3)", dash: "2 4", label: "peak " + IB.sigfig(ipk, 3) + " A" }
        ],
        vlines: [{ x: D * Tp * 1e6, color: "var(--ink-3)", dash: "3 3", label: "switch opens" }]
      });
      document.getElementById("waveHint").textContent =
        "Rising slope is (Vin−Vout)/L = " + IB.sigfig((P.vin - P.vout) / P.L / 1e6, 3)
        + " A/µs, falling slope Vout/L = " + IB.sigfig(P.vout / P.L / 1e6, 3) + " A/µs. "
        + "The valley sits at " + IB.sigfig(ivalley, 3) + " A"
        + (ivalley < 0 ? " — negative, so a synchronous converter is pulling current backwards; a "
            + "diode version would go discontinuous here instead." : ".");

      // ripple ratio vs L
      var lLo = P.L / 20, lHi = P.L * 20, rpts = [];
      for (k = 0; k <= 100; k++) {
        var L = lLo * Math.pow(lHi / lLo, k / 100);
        rpts.push([L * 1e6, dIL(L) / Math.max(P.iout, 1e-9) * 100]);
      }
      IB.chart(lv, {
        w: 660, h: 280, pad: [24, 24, 46, 54],
        x: { min: lLo * 1e6, max: lHi * 1e6, log: true, label: "inductance  (µH)",
             fmt: function (v) { return IB.eng(v, 2); } },
        y: { min: 0, max: Math.max(120, rr * 100 * 1.4), label: "ripple ratio  (%)",
             fmt: function (v) { return IB.fx(v); } },
        series: [{ pts: rpts, color: "var(--s3)", width: 2.2 }],
        hlines: [{ y: 30, color: "var(--ink-3)", dash: "5 4", label: "30 % target" }],
        dots: [{ x: P.L * 1e6, y: Math.min(rr * 100, Math.max(120, rr * 100 * 1.4)), color: "var(--ink)" }]
      });
      var lFor30 = (P.vin - P.vout) * D / (0.3 * P.iout * P.f);
      document.getElementById("lHint").textContent =
        "For a 30 % ripple ratio at this load you want about " + IB.engU(lFor30, "H", 3)
        + ". Bigger inductors cut ripple and conducted noise but respond more slowly to load steps and "
        + "cost size; smaller ones are faster and cheaper until core loss and peak current bite.";

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Where it goes" }), el("th", { text: "Power" }), el("th", { text: "Share of loss" })
      ])]));
      var tb = el("tbody", {});
      [["High-side conduction, I²R·D", pHigh],
       [P.vd > 0 ? "Low-side diode, Vf·I·(1−D)" : "Low-side conduction, I²R·(1−D)", pLow],
       ["Inductor DCR", pDcr]].forEach(function (r) {
        tb.appendChild(el("tr", {}, [
          el("td", { text: r[0] }),
          el("td", { text: IB.engU(r[1], "W", 3) }),
          el("td", { text: pLoss > 0 ? IB.fx(r[1] / pLoss * 100) + " %" : "—" })
        ]));
      });
      tb.appendChild(el("tr", { class: "on" }, [
        el("td", { text: "Total conduction loss" }),
        el("td", { text: IB.engU(pLoss, "W", 3) }),
        el("td", { text: IB.fx(100) + " %" })
      ]));
      tab.appendChild(tb);
      lossPanel.querySelector(".hint") && lossPanel.removeChild(lossPanel.querySelector(".hint"));
      lossPanel.appendChild(el("p", { class: "hint",
        text: "Conduction losses only. Switching, gate-drive, core and controller losses are not "
            + "included, so the real efficiency will be a few points lower — more at light load "
            + "and at high frequency, where those terms dominate." }));
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "In continuous conduction the inductor volt-seconds balance each cycle, so "
        + "<code>D = (Vout + Idc·DCR + Vd)/(Vin − Idc·Rds + Vd)</code> — the ideal "
        + "<code>Vout/Vin</code> plus the conduction drops. Ripple is "
        + "<code>ΔIL = (Vin−Vout)·D/(L·f)</code>, peak current is the average plus half of "
        + "that, and the converter enters discontinuous conduction when the DC current falls below "
        + "<code>ΔIL/2</code>. Output ripple is the capacitive term <code>ΔIL/(8·f·C)</code> "
        + "plus the resistive term <code>ΔIL·ESR</code>. The RMS inductor current used for losses is "
        + "<code>√(Idc² + ΔIL²/12)</code>. "
        + "<strong>Out of scope:</strong> switching and gate-drive losses, core loss, dead time, control-loop "
        + "stability and compensation, input capacitor RMS rating (roughly "
        + "<code>Iout·√(D(1−D))</code>, worth checking separately), layout parasitics, and the "
        + "inductor's saturation curve — an inductor well past saturation has far less inductance than "
        + "its label and the ripple above is then optimistic." })
    ]));

    draw();
  }
});
