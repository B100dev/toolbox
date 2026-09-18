/* Battery pack — voltage, sag under load, runtime and the discharge curve. */
IB.register({
  id: "pack",
  name: "Pack & Runtime",
  nav: "Pack",
  group: "Wiring and batteries",
  tag: "Batteries · sag · endurance",
  blurb: "Cells in series, a current draw, and the internal resistance nobody puts on the label. "
       + "Get the loaded voltage, the C-rate you are asking for, and how long it lasts.",
  eq: "Vload = S·(OCV − I·Rcell)   ·   t = Ah·usable / I",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { S: 4, mAh: 1500, C: 75, ir: 4, I: 25, usable: 80, chem: "lipo" };

    var CHEM = {
      lipo: {
        name: "LiPo / Li-ion", full: 4.20, nom: 3.70, floor: 3.50, dead: 3.00,
        ocv: [[1, 4.20], [0.9, 4.08], [0.8, 4.00], [0.7, 3.92], [0.6, 3.85], [0.5, 3.79],
              [0.4, 3.75], [0.3, 3.71], [0.2, 3.66], [0.1, 3.55], [0.05, 3.45], [0, 3.20]]
      },
      lfp: {
        name: "LiFePO₄", full: 3.60, nom: 3.20, floor: 2.90, dead: 2.50,
        ocv: [[1, 3.60], [0.9, 3.35], [0.8, 3.32], [0.7, 3.30], [0.6, 3.29], [0.5, 3.28],
              [0.4, 3.27], [0.3, 3.25], [0.2, 3.22], [0.1, 3.15], [0.05, 3.05], [0, 2.50]]
      }
    };
    function ocv(soc) {
      var t = CHEM[P.chem].ocv, i;
      soc = IB.clamp(soc, 0, 1);
      for (i = 0; i < t.length - 1; i++) {
        if (soc <= t[i][0] && soc >= t[i + 1][0]) {
          var f = (soc - t[i + 1][0]) / (t[i][0] - t[i + 1][0]);
          return t[i + 1][1] + f * (t[i][1] - t[i + 1][1]);
        }
      }
      return t[t.length - 1][1];
    }

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Under this load" }));
    var T = IB.tiles(top, [
      { id: "vnom", k: "Nominal / full", u: "V" },
      { id: "vload", k: "Loaded now", u: "V" },
      { id: "sag", k: "Sag", u: "V" },
      { id: "crate", k: "Draw", u: "C" },
      { id: "run", k: "Runtime", u: "" },
      { id: "wh", k: "Usable energy", u: "Wh" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "packChips" }));
    top.appendChild(el("p", { class: "hint", id: "packHint" }));

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", text: "Discharge at a constant draw" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 320", role: "img",
      "aria-label": "Pack voltage against time, resting and under load, with the cutoff line" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint", id: "packCurveHint" }));

    var tabPanel = el("div", { class: "panel" });
    left.appendChild(tabPanel);
    tabPanel.appendChild(el("span", { class: "eyebrow", text: "Runtime against draw" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); tabPanel.appendChild(tw);

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Pack" }));
    IB.select(rail, { id: "pk-chem", label: "Chemistry", value: P.chem,
      options: [{ value: "lipo", label: "LiPo / Li-ion (4.2 V)" }, { value: "lfp", label: "LiFePO₄ (3.6 V)" }],
      onInput: function (v) { P.chem = v; draw(); } });
    var fS = IB.field(rail, { id: "pk-s", label: "Cells in series", unit: "S", value: P.S,
      min: 1, max: 20, step: 1, onInput: function (v) { P.S = Math.round(v); draw(); } });
    var fAh = IB.field(rail, { id: "pk-ah", label: "Capacity", unit: "mAh", value: P.mAh,
      min: 50, max: 60000, log: true, onInput: function (v) { P.mAh = v; draw(); } });
    var fC = IB.field(rail, { id: "pk-c", label: "C rating", unit: "C", value: P.C,
      min: 0.5, max: 200, log: true, onInput: function (v) { P.C = v; draw(); },
      hint: "Printed on the label, and usually optimistic. Treat it as a ceiling, not a target." });
    var fIr = IB.field(rail, { id: "pk-ir", label: "Internal R per cell", unit: "mΩ", value: P.ir,
      min: 0.2, max: 200, log: true, onInput: function (v) { P.ir = v; draw(); },
      hint: "A healthy 1500 mAh LiPo cell is 2–6 mΩ; a tired one is double that." });
    var fI = IB.field(rail, { id: "pk-i", label: "Load current", unit: "A", value: P.I,
      min: 0.05, max: 400, log: true, onInput: function (v) { P.I = v; draw(); } });
    var fU = IB.field(rail, { id: "pk-u", label: "Capacity you use", unit: "%", value: P.usable,
      min: 20, max: 100, step: 1, onInput: function (v) { P.usable = v; draw(); },
      hint: "Landing at 80 % used keeps a lithium pack alive far longer than running it flat." });

    var linkRow = el("div", { class: "field" });
    rail.appendChild(linkRow);
    function refreshLink() {
      IB.clear(linkRow);
      var mc = IB.store.get("motorCurrent", null);
      linkRow.appendChild(el("div", { class: "frow" }, [el("label", { text: "Presets" })]));
      var row = el("div", { class: "btnrow" }, [
        preset("3S 1500 quad", { S: 3, mAh: 1500, C: 75, ir: 4, I: 22 }),
        preset("6S 6000 cinelifter", { S: 6, mAh: 6000, C: 30, ir: 2.5, I: 60 }),
        preset("4S 18650 pack", { S: 4, mAh: 3000, C: 3, ir: 30, I: 6, chem: "lipo" }),
        preset("12 V LiFePO₄ 100 Ah", { S: 4, mAh: 100000, C: 1, ir: 1.5, I: 30, chem: "lfp" })
      ]);
      linkRow.appendChild(row);
      if (mc) {
        var b = el("button", { type: "button",
          text: "Use the motor bench draw (" + IB.sigfig(mc, 3) + " A)" });
        b.addEventListener("click", function () { P.I = mc; fI.set(mc, true); draw(); });
        row.appendChild(b);
      }
    }
    function preset(label, v) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        Object.keys(v).forEach(function (k) { P[k] = v[k]; });
        fS.set(P.S, true); fAh.set(P.mAh, true); fC.set(P.C, true); fIr.set(P.ir, true); fI.set(P.I, true);
        if (v.chem) document.getElementById("pk-chem").value = v.chem;
        draw();
      });
      return b;
    }

    function draw() {
      var ch = CHEM[P.chem];
      var Ah = P.mAh / 1000;
      var Rpack = P.S * P.ir / 1000;
      var sag = P.I * Rpack;
      var vFull = P.S * ch.full, vNom = P.S * ch.nom;
      var vLoadFull = P.S * ch.full - sag;
      var cRate = P.I / Ah;
      var maxA = P.C * Ah;
      var usableAh = Ah * P.usable / 100;
      var runtimeH = usableAh / P.I;
      var wh = usableAh * vNom;
      var lossW = P.I * P.I * Rpack;

      T.vnom.set(IB.sigfig(vNom, 3) + " / " + IB.sigfig(vFull, 3));
      T.vload.set(IB.sigfig(vLoadFull, 4), vLoadFull < P.S * ch.floor ? "hot" : "");
      T.sag.set(IB.sigfig(sag, 3), sag > vFull * 0.12 ? "warnv" : "");
      T.crate.set(IB.sigfig(cRate, 3), cRate > P.C ? "hot" : (cRate > P.C * 0.8 ? "warnv" : "goodv"));
      T.run.set(runtimeH * 60 < 90 ? IB.sigfig(runtimeH * 60, 3) + " min" : IB.sigfig(runtimeH, 3) + " h");
      T.wh.set(IB.sigfig(wh, 3));

      var chips = document.getElementById("packChips");
      IB.clear(chips);
      chips.appendChild(el("span", { class: "chip on " + (cRate > P.C ? "crit" : cRate > P.C * 0.8 ? "warn" : "good"),
        text: cRate > P.C ? "over the " + IB.sigfig(P.C, 3) + "C rating" :
          IB.fx(cRate / P.C * 100) + " % of the rating (" + IB.sigfig(maxA, 3) + " A)" }));
      chips.appendChild(el("span", { class: "chip on " + (sag / vFull > 0.15 ? "crit" : sag / vFull > 0.08 ? "warn" : "good"),
        text: IB.fx(sag / vFull * 100, 1) + " % sag · " + IB.sigfig(lossW, 3) + " W lost inside the pack" }));

      document.getElementById("packHint").textContent =
        "Pack resistance is " + IB.sigfig(Rpack * 1000, 3) + " mΩ, so " + IB.sigfig(P.I, 3) + " A costs "
        + IB.sigfig(sag, 3) + " V before the wires even start. That is " + IB.sigfig(lossW, 3)
        + " W heating the cells — " + IB.fx(lossW / (P.I * vLoadFull) * 100, 1)
        + " % of what the load sees, and the reason a sagging pack gets warm.";

      // discharge curve
      var N = 160, rest = [], load = [], k, tEndMin = runtimeH * 60 / (P.usable / 100);
      for (k = 0; k <= N; k++) {
        var tm = tEndMin * k / N;
        var soc = 1 - (tm / 60) * P.I / Ah;
        if (soc < 0) break;
        rest.push([tm, P.S * ocv(soc)]);
        load.push([tm, P.S * ocv(soc) - sag]);
      }
      var cutoff = P.S * ch.floor;
      var yMin = Math.min(P.S * ch.dead, cutoff - 0.2), yMax = vFull * 1.03;
      IB.chart(cv, {
        w: 660, h: 320, pad: [24, 24, 46, 56],
        x: { min: 0, max: Math.max(tEndMin, 1), label: "minutes at " + IB.sigfig(P.I, 3) + " A",
             fmt: function (v) { return IB.sigfig(v, 3); } },
        y: { min: yMin, max: yMax, label: "pack voltage  (V)", fmt: function (v) { return IB.fx(v, 1); } },
        series: [
          { pts: rest, color: "var(--s3)", width: 1.8, dash: "5 4" },
          { pts: load, color: "var(--s1)", width: 2.4, fill: true, fillTo: yMin, fillOpacity: 0.12 }
        ],
        hlines: [{ y: cutoff, color: "var(--crit)", dash: "5 4",
          label: IB.sigfig(ch.floor, 3) + " V/cell — stop here" }],
        vlines: [{ x: runtimeH * 60, color: "var(--ink-2)", dash: "3 3",
          label: IB.sigfig(runtimeH * 60, 3) + " min at " + IB.fx(P.usable) + " %" }],
        legend: [{ color: "var(--s3)", label: "resting", dash: "5 4" }, { color: "var(--s1)", label: "under load" }]
      });

      // when does the loaded curve hit the floor?
      var hit = null;
      for (k = 0; k < load.length; k++) if (load[k][1] <= cutoff) { hit = load[k][0]; break; }
      document.getElementById("packCurveHint").textContent = hit !== null
        ? "Under load the pack reaches " + IB.sigfig(ch.floor, 3) + " V/cell after " + IB.sigfig(hit, 3)
          + " min — " + (hit < runtimeH * 60 ? "sooner than your capacity target, so sag is what ends the run."
            : "after your capacity target, so capacity is the binding limit.")
          + " Let off the throttle and it springs back up by the full " + IB.sigfig(sag, 3) + " V."
        : "The pack never reaches the cutoff at this draw — capacity runs out first.";

      // runtime table across draws
      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Draw" }), el("th", { text: "C rate" }), el("th", { text: "Sag" }),
        el("th", { text: "Loaded (full)" }), el("th", { text: "Runtime" }), el("th", { text: "Pack heat" })
      ])]));
      var tb = el("tbody", {});
      [0.25, 0.5, 1, 1.5, 2, 3].map(function (m) { return P.I * m; }).forEach(function (ii) {
        var sg = ii * Rpack;
        var rt = usableAh / ii * 60;
        tb.appendChild(el("tr", { class: Math.abs(ii - P.I) < 1e-9 ? "on" : "" }, [
          el("td", { text: IB.sigfig(ii, 3) + " A" }),
          el("td", { text: IB.sigfig(ii / Ah, 3) + " C" }),
          el("td", { text: IB.sigfig(sg, 3) + " V" }),
          el("td", { text: IB.sigfig(vFull - sg, 4) + " V" }),
          el("td", { text: rt < 90 ? IB.sigfig(rt, 3) + " min" : IB.sigfig(rt / 60, 3) + " h" }),
          el("td", { text: IB.sigfig(ii * ii * Rpack, 3) + " W" })
        ]));
      });
      tab.appendChild(tb);
      refreshLink();
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "Cells in series add voltage and internal resistance: <code>Rpack = S · Rcell</code>, and the "
        + "terminal voltage is <code>S·OCV(SoC) − I·Rpack</code>. Runtime is simply "
        + "<code>usable Ah / I</code> — constant current, no Peukert correction, which is close enough "
        + "for lithium chemistries and optimistic for lead-acid. The open-circuit curve is a typical "
        + "shape for the chemistry, not a measurement of your cells: real packs vary by manufacturer, age "
        + "and temperature, and internal resistance climbs sharply in the cold and as cells age. "
        + "C rating is the manufacturer's continuous claim; sustained draws above about 80 % of it shorten "
        + "pack life whatever the label says. Nothing here models temperature rise, cell imbalance, or the "
        + "voltage recovery that makes a rested pack read higher than a working one." })
    ]));

    draw();
  }
});
