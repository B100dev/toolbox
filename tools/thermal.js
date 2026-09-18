/* Motor thermal performance — winding temperature, duty cycle, continuous rating. */
IB.register({
  id: "thermal",
  name: "Motor Thermal Limit",
  nav: "Thermal",
  group: "Motors and drives",
  tag: "Winding temperature · duty cycle",
  blurb: "What actually limits a motor is heat, not torque. Find the winding temperature, the current "
       + "it can hold forever, and how much more it can take in bursts.",
  eq: "ΔT = I²R·Rth   ·   τth = Rth·Cth   ·   R(T) = R₂₀(1+αΔT)",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var ALPHA = 0.00393;
    var P = { R20: 0.12, I: 8, rth: 3.5, cth: 45, ta: 25, tmax: 155, duty: 100, period: 30 };

    var CLASS = [
      { v: "105", label: "Class A — 105 °C" },
      { v: "120", label: "Class E — 120 °C" },
      { v: "130", label: "Class B — 130 °C" },
      { v: "155", label: "Class F — 155 °C" },
      { v: "180", label: "Class H — 180 °C" },
      { v: "200", label: "Class N — 200 °C" }
    ];

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "At this current and duty" }));
    var T = IB.tiles(top, [
      { id: "loss", k: "Copper loss", u: "W" },
      { id: "tss", k: "Settled winding", u: "°C" },
      { id: "tpk", k: "Peak winding", u: "°C" },
      { id: "tau", k: "Thermal τ", u: "" },
      { id: "cont", k: "Continuous limit", u: "A" },
      { id: "ttl", k: "Time to limit", u: "" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "thChips" }));
    top.appendChild(el("p", { class: "hint", id: "thHint" }));

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", text: "Winding temperature from cold" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 320", role: "img",
      "aria-label": "Winding temperature against time with the insulation limit marked" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint", id: "thCurveHint" }));

    var dutyPanel = el("div", { class: "panel" });
    left.appendChild(dutyPanel);
    dutyPanel.appendChild(el("span", { class: "eyebrow", text: "What the duty cycle buys · current allowed at the limit" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); dutyPanel.appendChild(tw);
    dutyPanel.appendChild(el("p", { class: "hint",
      text: "Valid when the on/off period is short compared with the thermal time constant, so the "
          + "winding sees the average loss. For long cycles use the curve above instead." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Motor and cooling" }));
    var fR = IB.field(rail, { id: "th-r", label: "Winding resistance at 20 °C", unit: "Ω", value: P.R20,
      min: 0.005, max: 50, log: true, onInput: function (v) { P.R20 = v; draw(); } });
    var fI = IB.field(rail, { id: "th-i", label: "Current", unit: "A", value: P.I,
      min: 0.05, max: 200, log: true, onInput: function (v) { P.I = v; draw(); } });
    var fRth = IB.field(rail, { id: "th-rth", label: "Thermal resistance", unit: "°C/W", value: P.rth,
      min: 0.05, max: 60, log: true, onInput: function (v) { P.rth = v; draw(); },
      hint: "Winding to ambient. A small outrunner in still air is 3–8 °C/W; bolted to a metal "
          + "frame with airflow, well under 1." });
    var fCth = IB.field(rail, { id: "th-cth", label: "Thermal capacity", unit: "J/°C", value: P.cth,
      min: 1, max: 5000, log: true, onInput: function (v) { P.cth = v; draw(); },
      hint: "Roughly 0.39 J/g·°C for copper, 0.46 for steel — so a 100 g rotor-and-stator "
          + "mass is around 40 J/°C." });
    var fTa = IB.field(rail, { id: "th-ta", label: "Ambient", unit: "°C", value: P.ta,
      min: -40, max: 80, step: 1, onInput: function (v) { P.ta = v; draw(); } });
    IB.select(rail, { id: "th-cls", label: "Insulation class", value: String(P.tmax),
      options: CLASS, onInput: function (v) { P.tmax = +v; fTmax.set(+v, true); draw(); } });
    var fTmax = IB.field(rail, { id: "th-tmax", label: "Winding limit", unit: "°C", value: P.tmax,
      min: 80, max: 220, step: 5, onInput: function (v) { P.tmax = v; draw(); } });
    var fDuty = IB.field(rail, { id: "th-duty", label: "Duty cycle", unit: "%", value: P.duty,
      min: 5, max: 100, step: 1, onInput: function (v) { P.duty = v; draw(); } });
    var fPer = IB.field(rail, { id: "th-per", label: "Cycle period", unit: "s", value: P.period,
      min: 0.5, max: 600, log: true, onInput: function (v) { P.period = v; draw(); },
      hint: "One on-plus-off cycle. Short cycles average out; long ones let the winding swing." });

    var linkRow = el("div", { class: "field" });
    rail.appendChild(linkRow);
    function refreshLink() {
      IB.clear(linkRow);
      linkRow.appendChild(el("div", { class: "frow" }, [el("label", { text: "Presets" })]));
      var row = el("div", { class: "btnrow" }, [
        preset("Drone motor, still air", 0.06, 20, 4.5, 30, 155),
        preset("Gearmotor in a frame", 1.2, 3, 8, 60, 130),
        preset("Industrial servo", 0.35, 12, 0.6, 900, 155)
      ]);
      linkRow.appendChild(row);
      var mc = IB.store.get("motorCurrent", null);
      if (mc) {
        var b = el("button", { type: "button", text: "Use the motor bench current (" + IB.sigfig(mc, 3) + " A)" });
        b.addEventListener("click", function () { P.I = mc; fI.set(mc, true); draw(); });
        row.appendChild(b);
      }
    }
    function preset(label, r, i, rth, cth, tmax) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.R20 = r; P.I = i; P.rth = rth; P.cth = cth; P.tmax = tmax;
        fR.set(r, true); fI.set(i, true); fRth.set(rth, true); fCth.set(cth, true); fTmax.set(tmax, true);
        document.getElementById("th-cls").value = String(tmax);
        draw();
      });
      return b;
    }

    function rAt(T) { return P.R20 * (1 + ALPHA * (T - 20)); }
    function lossAt(T, I) { return I * I * rAt(T); }
    // steady state with the copper tempco folded in (can run away)
    function settle(I) {
      var A = I * I * P.R20 * P.rth;
      var den = 1 - A * ALPHA;
      if (den <= 0) return Infinity;                        // thermal runaway
      return (P.ta + A * (1 - 20 * ALPHA)) / den;
    }
    function contLimit() {
      return Math.sqrt(Math.max(0, (P.tmax - P.ta) / (P.rth * rAt(P.tmax))));
    }

    function draw() {
      var tau = P.rth * P.cth;
      var dutyF = P.duty / 100;
      var loss = lossAt(settle(P.I) === Infinity ? P.tmax : Math.min(settle(P.I), P.tmax), P.I);
      var tssCont = settle(P.I);
      var iRms = P.I * Math.sqrt(dutyF);
      var tssDuty = settle(iRms);
      var cont = contLimit();

      // numeric run from cold over 6 tau with the duty profile
      var tEnd = Math.max(6 * tau, P.period * 4), N = 900, dt = tEnd / N;
      var Tw = P.ta, pts = [], peak = P.ta, k, timeToLimit = null;
      for (k = 0; k <= N; k++) {
        var t = k * dt;
        var on = (t % P.period) < P.period * dutyF;
        var Pin = on ? lossAt(Tw, P.I) : 0;
        Tw += (Pin - (Tw - P.ta) / P.rth) / P.cth * dt;
        if (Tw > peak) peak = Tw;
        if (timeToLimit === null && Tw >= P.tmax) timeToLimit = t;
        pts.push([t, Tw]);
      }

      T.loss.set(IB.sigfig(loss * dutyF, 3));
      T.tss.set(isFinite(tssDuty) ? IB.fx(tssDuty) : "runaway",
        !isFinite(tssDuty) || tssDuty > P.tmax ? "hot" : (tssDuty > P.tmax - 20 ? "warnv" : "goodv"));
      T.tpk.set(IB.fx(peak), peak > P.tmax ? "hot" : (peak > P.tmax - 20 ? "warnv" : ""));
      T.tau.set(tau < 120 ? IB.sigfig(tau, 3) + " s" : IB.sigfig(tau / 60, 3) + " min");
      T.cont.set(IB.sigfig(cont, 3), P.I > cont ? "hot" : "goodv");
      T.ttl.set(timeToLimit === null ? "never" :
        (timeToLimit < 120 ? IB.sigfig(timeToLimit, 3) + " s" : IB.sigfig(timeToLimit / 60, 3) + " min"),
        timeToLimit === null ? "goodv" : "hot");

      var chips = document.getElementById("thChips");
      IB.clear(chips);
      chips.appendChild(el("span", { class: "chip on " + (P.I > cont ? (dutyF < 1 ? "warn" : "crit") : "good"),
        text: P.I > cont ? IB.fx(P.I / cont * 100) + " % of the continuous rating"
          : IB.fx(P.I / cont * 100) + " % of continuous — sustainable" }));
      chips.appendChild(el("span", { class: "chip on " + (!isFinite(tssDuty) ? "crit" : "good"),
        text: !isFinite(tssDuty) ? "thermal runaway: resistance rises faster than cooling removes heat"
          : "R rises to " + IB.eng(rAt(Math.min(tssDuty, P.tmax)), 3) + "Ω when hot" }));

      document.getElementById("thHint").textContent =
        "Copper gains 0.39 % resistance per °C, so a winding that starts at " + IB.eng(P.R20, 3)
        + "Ω dissipates more as it heats — the loss and the temperature chase each other up. "
        + "At " + IB.sigfig(P.I, 3) + " A continuous the settled winding is "
        + (isFinite(tssCont) ? IB.fx(tssCont) + " °C" : "unbounded")
        + ", against a " + IB.fx(P.tmax) + " °C insulation limit.";

      var yMax = Math.max(P.tmax * 1.15, peak * 1.1);
      IB.chart(cv, {
        w: 660, h: 320, pad: [24, 24, 46, 56],
        x: { min: 0, max: tEnd, label: tEnd > 300 ? "time  (s)" : "time  (s)",
             fmt: function (v) { return IB.sigfig(v, 3); } },
        y: { min: P.ta, max: yMax, label: "winding  (°C)", fmt: function (v) { return IB.fx(v); } },
        series: [{ pts: pts, color: "var(--s2)", width: 2.2, fill: true, fillTo: P.ta, fillOpacity: 0.12 }],
        hlines: [
          { y: P.tmax, color: "var(--crit)", dash: "5 4", label: "insulation limit " + IB.fx(P.tmax) + " °C" },
          { y: P.ta, color: "var(--rule)", dash: "2 4", label: "ambient" }
        ],
        vlines: timeToLimit !== null ? [{ x: timeToLimit, color: "var(--ink-2)", dash: "3 3",
          label: IB.sigfig(timeToLimit, 3) + " s" }] : []
      });
      document.getElementById("thCurveHint").textContent = dutyF < 1
        ? "With " + IB.fx(P.duty) + " % duty on a " + IB.sigfig(P.period, 3) + " s cycle the winding "
          + "ripples around its mean. The ripple depends on how the period compares with τ = "
          + IB.sigfig(tau, 3) + " s: much shorter and it averages out, much longer and each burst is a "
          + "separate heat-up."
        : "Continuous operation. The winding reaches 63 % of its final rise in one τ ("
          + IB.sigfig(tau, 3) + " s) and is essentially settled after five.";

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Duty" }), el("th", { text: "Current allowed" }), el("th", { text: "Loss while on" }),
        el("th", { text: "Mean loss" }), el("th", { text: "× continuous" })
      ])]));
      var tb = el("tbody", {});
      [100, 50, 25, 10, 5].forEach(function (d) {
        var f = d / 100;
        var ia = cont / Math.sqrt(f);
        tb.appendChild(el("tr", { class: Math.abs(d - P.duty) < 0.5 ? "on" : "" }, [
          el("td", { text: d + " %" }),
          el("td", { text: IB.sigfig(ia, 3) + " A" }),
          el("td", { text: IB.sigfig(ia * ia * rAt(P.tmax), 3) + " W" }),
          el("td", { text: IB.sigfig(ia * ia * rAt(P.tmax) * f, 3) + " W" }),
          el("td", { text: IB.sigfig(1 / Math.sqrt(f), 3) + "×" })
        ]));
      });
      tab.appendChild(tb);
      refreshLink();
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "A single lumped node: the winding holds <code>Cth</code> joules per degree and loses heat to "
        + "ambient through <code>Rth</code>, so <code>Cth·dT/dt = I²R(T) − (T−Ta)/Rth</code>, "
        + "integrated numerically for the curve. Copper's resistance climbs with temperature, "
        + "<code>R(T) = R₂₀(1 + 0.00393·(T−20))</code>, which feeds back into the loss — "
        + "if <code>I²R₂₀·Rth·α ≥ 1</code> there is no steady state at all and the "
        + "winding runs away. Since the loss goes as current squared, the allowed current scales as "
        + "<code>1/√duty</code>: half the duty buys 41 % more current, not double. "
        + "<strong>What one node misses:</strong> the winding heats far faster than the housing, so a real "
        + "motor needs at least two nodes (winding→iron→ambient) with very different time constants, "
        + "and a short overload can cook the winding long before the case feels warm. Iron and magnet "
        + "losses, which rise with speed, are not counted; neither is forced cooling, magnet "
        + "demagnetisation above roughly 120 °C for common neodymium grades, nor bearing and lubricant "
        + "limits. Insulation classes are the IEC 60085 hot-spot ratings — running at the limit is "
        + "the point at which rated life is defined, not a safe place to live." })
    ]));

    draw();
  }
});
