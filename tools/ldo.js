/* Linear regulator — dropout, dissipation, junction temperature. */
IB.register({
  id: "ldo",
  name: "LDO / Linear Regulator",
  nav: "LDO",
  group: "Power conversion",
  tag: "Linear · thermal limited",
  blurb: "A linear regulator turns the voltage it drops into heat. Check the headroom against dropout, "
       + "then check the junction temperature before you believe the current rating.",
  eq: "Pd = (Vin − Vout)·Iout + Vin·Iq   ·   Tj = Ta + Pd·θJA",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { vin: 12, vout: 5, iout: 0.3, iq: 0.005, vdo: 0.4, ta: 25, tj: 125, th: 60 };

    var PKG = [
      { v: "250", label: "SOT-23 — 250 °C/W" },
      { v: "160", label: "SOT-89 — 160 °C/W" },
      { v: "90",  label: "SOIC-8 — 90 °C/W" },
      { v: "60",  label: "SOT-223 — 60 °C/W" },
      { v: "50",  label: "DPAK on 1 in² copper — 50 °C/W" },
      { v: "62",  label: "TO-220, free air — 62 °C/W" },
      { v: "8",   label: "TO-220 on a heatsink — 8 °C/W" }
    ];

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Operating point" }));
    var T = IB.tiles(top, [
      { id: "head", k: "Headroom", u: "V" },
      { id: "pd", k: "Dissipation", u: "W" },
      { id: "tj", k: "Junction temp", u: "°C" },
      { id: "eff", k: "Efficiency", u: "%" },
      { id: "imax", k: "Thermal limit", u: "" },
      { id: "waste", k: "Wasted", u: "W" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "ldoChips" }));
    top.appendChild(el("p", { class: "hint", id: "ldoHint" }));

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", text: "Junction temperature against load" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 300", role: "img",
      "aria-label": "Junction temperature against output current for three thermal resistances" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint", id: "ldoCurveHint" }));

    var cmpPanel = el("div", { class: "panel" });
    left.appendChild(cmpPanel);
    cmpPanel.appendChild(el("span", { class: "eyebrow", text: "What the package buys you · at this load" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); cmpPanel.appendChild(tw);
    cmpPanel.appendChild(el("p", { class: "hint",
      text: "Typical figures for orientation only — θJA depends heavily on the copper you give it, "
          + "so take the number from the datasheet's thermal table with your own board area." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Regulator" }));
    var fVin = IB.field(rail, { id: "ld-vin", label: "Input voltage", unit: "V", value: P.vin,
      min: 0.5, max: 60, step: 0.1, onInput: function (v) { P.vin = v; draw(); } });
    var fVout = IB.field(rail, { id: "ld-vout", label: "Output voltage", unit: "V", value: P.vout,
      min: 0.5, max: 50, step: 0.1, onInput: function (v) { P.vout = v; draw(); } });
    var fI = IB.field(rail, { id: "ld-i", label: "Load current", unit: "mA", value: P.iout * 1000,
      min: 0.1, max: 5000, log: true, onInput: function (v) { P.iout = v / 1000; draw(); } });
    var fVdo = IB.field(rail, { id: "ld-vdo", label: "Dropout voltage", unit: "V", value: P.vdo,
      min: 0.02, max: 3, step: 0.01, onInput: function (v) { P.vdo = v; draw(); },
      hint: "A true LDO is 0.1–0.5 V at full load; an old 7805-style regulator wants 2 V." });
    var fIq = IB.field(rail, { id: "ld-iq", label: "Quiescent current", unit: "mA", value: P.iq * 1000,
      min: 0, max: 50, step: 0.001, onInput: function (v) { P.iq = v / 1000; draw(); },
      hint: "Matters only for battery standby — and then it matters a lot." });
    IB.select(rail, { id: "ld-pkg", label: "Package / mounting", value: String(P.th),
      options: PKG, onInput: function (v) { P.th = +v; fTh.set(+v, true); draw(); } });
    var fTh = IB.field(rail, { id: "ld-th", label: "θJA", unit: "°C/W", value: P.th,
      min: 2, max: 400, log: true, onInput: function (v) { P.th = v; draw(); },
      hint: "Override with the datasheet value for your copper area." });
    var fTa = IB.field(rail, { id: "ld-ta", label: "Ambient", unit: "°C", value: P.ta,
      min: -40, max: 100, step: 1, onInput: function (v) { P.ta = v; draw(); } });
    var fTj = IB.field(rail, { id: "ld-tj", label: "Max junction temp", unit: "°C", value: P.tj,
      min: 85, max: 175, step: 5, onInput: function (v) { P.tj = v; draw(); } });

    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Common rails" })]),
      el("div", { class: "btnrow" }, [
        preset("12 → 5 V, 300 mA", 12, 5, 300, 0.4, 60),
        preset("5 → 3.3 V, 500 mA", 5, 3.3, 500, 0.25, 90),
        preset("LiPo → 3.3 V", 4.2, 3.3, 150, 0.15, 250),
        preset("24 → 5 V, 100 mA", 24, 5, 100, 0.4, 60)
      ])
    ]));
    function preset(label, vin, vout, mA, vdo, th) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.vin = vin; P.vout = vout; P.iout = mA / 1000; P.vdo = vdo; P.th = th;
        fVin.set(vin, true); fVout.set(vout, true); fI.set(mA, true); fVdo.set(vdo, true); fTh.set(th, true);
        document.getElementById("ld-pkg").value = String(th);
        draw();
      });
      return b;
    }

    function pd(vin, iout) { return Math.max(0, vin - P.vout) * iout + vin * P.iq; }

    function draw() {
      var head = P.vin - P.vout;
      var dis = pd(P.vin, P.iout);
      var tj = P.ta + dis * P.th;
      var pout = P.vout * P.iout, pin = P.vin * (P.iout + P.iq);
      var eff = pin > 0 ? pout / pin : 0;
      // current at which Tj hits the limit
      var budget = (P.tj - P.ta) / P.th;                 // watts allowed
      var imax = Math.max(0, (budget - P.vin * P.iq) / Math.max(head, 1e-9));

      T.head.set(IB.sigfig(head, 3), head < P.vdo ? "hot" : (head < P.vdo * 1.5 ? "warnv" : "goodv"));
      T.pd.set(IB.sigfig(dis, 3), dis > budget ? "hot" : "");
      T.tj.set(IB.fx(tj), tj > P.tj ? "hot" : (tj > P.tj - 25 ? "warnv" : "goodv"));
      T.eff.set(IB.fx(eff * 100), eff < 0.5 ? "warnv" : "");
      T.imax.set(imax > 1 ? IB.sigfig(imax, 3) + " A" : IB.fx(imax * 1000) + " mA",
        imax < P.iout ? "hot" : "");
      T.waste.set(IB.sigfig(dis, 3));

      var chips = document.getElementById("ldoChips");
      IB.clear(chips);
      chips.appendChild(el("span", { class: "chip on " + (head < P.vdo ? "crit" : head < P.vdo * 1.5 ? "warn" : "good"),
        text: head < P.vdo ? "in dropout — output will sag" :
          IB.sigfig(head - P.vdo, 2) + " V above dropout" }));
      chips.appendChild(el("span", { class: "chip on " + (tj > P.tj ? "crit" : tj > P.tj - 25 ? "warn" : "good"),
        text: tj > P.tj ? "over temperature — it will shut down or die" :
          IB.fx(P.tj - tj) + " °C of thermal margin" }));

      document.getElementById("ldoHint").textContent =
        "Every amp passes through the pass device with " + IB.sigfig(head, 3) + " V across it, so the "
        + "regulator burns " + IB.sigfig(dis, 3) + " W to deliver " + IB.sigfig(pout, 3) + " W. "
        + (eff < 0.5 ? "Below about 50 % a buck converter is usually the right answer — it moves the "
            + "same power without the heat." : "Linear is fine here: the heat is manageable and you get "
            + "no switching noise.");

      // Tj vs current for this and two neighbouring thermal resistances
      var iHi = Math.max(P.iout * 2.5, imax * 1.4, 0.05), series = [], legend = [];
      var ths = [P.th * 0.5, P.th, P.th * 2], colors = ["var(--s3)", "var(--s1)", "var(--s2)"];
      ths.forEach(function (th, i) {
        var pts = [], k;
        for (k = 0; k <= 80; k++) {
          var ii = iHi * k / 80;
          pts.push([ii * 1000, P.ta + pd(P.vin, ii) * th]);
        }
        series.push({ pts: pts, color: colors[i], width: i === 1 ? 2.4 : 1.6, dash: i === 1 ? null : "5 4" });
        legend.push({ color: colors[i], label: IB.fx(th) + " °C/W", dash: i === 1 ? null : "5 4" });
      });
      IB.chart(cv, {
        w: 660, h: 300, pad: [24, 24, 46, 54],
        x: { min: 0, max: iHi * 1000, label: "load current  (mA)", fmt: function (v) { return IB.fx(v); } },
        y: { min: P.ta, max: Math.max(P.tj * 1.15, tj * 1.1), label: "junction  (°C)",
             fmt: function (v) { return IB.fx(v); } },
        series: series,
        hlines: [{ y: P.tj, color: "var(--crit)", dash: "5 4", label: "Tj max " + IB.fx(P.tj) + " °C" }],
        dots: [{ x: P.iout * 1000, y: Math.min(tj, Math.max(P.tj * 1.15, tj * 1.1)), color: "var(--ink)" }],
        legend: legend
      });
      document.getElementById("ldoCurveHint").textContent =
        "At " + IB.fx(P.th) + " °C/W the part reaches its junction limit at " +
        (imax > 1 ? IB.sigfig(imax, 3) + " A" : IB.fx(imax * 1000) + " mA") +
        " with this input voltage. Halve the thermal resistance — more copper, a bigger package, a "
        + "heatsink — and that roughly doubles. Note the limit is about the voltage you are dropping, "
        + "not the regulator's headline current rating.";

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Package" }), el("th", { text: "θJA" }), el("th", { text: "Tj here" }),
        el("th", { text: "Margin" }), el("th", { text: "Max current" })
      ])]));
      var tb = el("tbody", {});
      PKG.forEach(function (p) {
        var th = +p.v, t = P.ta + dis * th;
        var im = Math.max(0, ((P.tj - P.ta) / th - P.vin * P.iq) / Math.max(head, 1e-9));
        tb.appendChild(el("tr", { class: Math.abs(th - P.th) < 1e-9 ? "on" : "" }, [
          el("td", { text: p.label.split(" — ")[0] }),
          el("td", { text: IB.fx(th) }),
          el("td", { text: IB.fx(t) + " °C" }),
          el("td", { text: IB.fx(P.tj - t) + " °C" }),
          el("td", { text: im > 1 ? IB.sigfig(im, 3) + " A" : IB.fx(im * 1000) + " mA" })
        ]));
      });
      tab.appendChild(tb);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "A linear regulator passes the load current and drops the difference: "
        + "<code>Pd = (Vin − Vout)·Iout + Vin·Iq</code>, and efficiency is close to "
        + "<code>Vout/Vin</code> however good the part is. Junction temperature is the single-resistance "
        + "estimate <code>Tj = Ta + Pd·θJA</code>, and the thermal current limit follows from "
        + "solving that for the load. Below the dropout voltage the pass device is fully on and the output "
        + "simply follows the input down, minus <code>Iout·Rds(on)</code>. "
        + "<strong>Not modelled:</strong> dropout rises with load and temperature; θJA is a board "
        + "property as much as a package one (the datasheet number assumes a specific test board); "
        + "thermal shutdown and current foldback are not simulated, so a real part protects itself rather "
        + "than reaching the temperatures plotted here; and transient response, PSRR, noise and the output "
        + "capacitor's ESR requirement — often what actually decides stability — are out of scope." })
    ]));

    draw();
  }
});
