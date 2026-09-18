/* Speed, torque and gearing — can this motor drive this load, and through what ratio. */
IB.register({
  id: "drive",
  name: "Speed, Torque & Gearing",
  nav: "Drive sizing",
  group: "Motors and drives",
  tag: "Sizing · operating envelope",
  blurb: "State what the output shaft has to do, then see whether the motor can do it and through which "
       + "gear ratio — with the required point plotted on the motor's own envelope.",
  eq: "τmotor = τout/(N·η)   ·   ωmotor = ωout·N",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg, TAU = Math.PI * 2;
    var P = { V: 12, Kv: 500, R: 0.8, Ilim: 10, tout: 0.6, rpmOut: 60, N: 20, eta: 0.85 };

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "What the motor is being asked for" }));
    var T = IB.tiles(top, [
      { id: "mrpm", k: "Motor speed", u: "rpm" },
      { id: "mtq", k: "Motor torque", u: "mN·m" },
      { id: "mi", k: "Current", u: "A" },
      { id: "vreq", k: "Voltage needed", u: "V" },
      { id: "pout", k: "Output power", u: "W" },
      { id: "margin", k: "Torque margin", u: "%" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "drChips" }));
    top.appendChild(el("p", { class: "hint", id: "drHint" }));

    var envPanel = el("div", { class: "panel" });
    left.appendChild(envPanel);
    envPanel.appendChild(el("span", { class: "eyebrow", text: "Motor envelope · required point reflected through the gearbox" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 320", role: "img",
      "aria-label": "Motor torque against speed with the current limit and the required operating point" });
    envPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    envPanel.appendChild(el("p", { class: "hint", id: "envHint" }));

    var ratioPanel = el("div", { class: "panel" });
    left.appendChild(ratioPanel);
    ratioPanel.appendChild(el("span", { class: "eyebrow", text: "Output speed available at the required torque" }));
    var rv = svgEl("svg", { viewBox: "0 0 660 280", role: "img",
      "aria-label": "Achievable output speed against gear ratio" });
    ratioPanel.appendChild(el("div", { class: "scroller" }, [rv]));
    ratioPanel.appendChild(el("p", { class: "hint", id: "ratioHint" }));

    var tabPanel = el("div", { class: "panel" });
    left.appendChild(tabPanel);
    tabPanel.appendChild(el("span", { class: "eyebrow", text: "Candidate ratios" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); tabPanel.appendChild(tw);
    tabPanel.appendChild(el("p", { class: "hint",
      text: "Click a row to use that ratio. Feasible means the motor can make the torque within its "
          + "current limit and still turn fast enough on the available voltage." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Load at the output shaft" }));
    var fTout = IB.field(rail, { id: "dr-t", label: "Torque required", unit: "N·m", value: P.tout,
      min: 0.001, max: 200, log: true, onInput: function (v) { P.tout = v; draw(); } });
    var fRpm = IB.field(rail, { id: "dr-rpm", label: "Speed required", unit: "rpm", value: P.rpmOut,
      min: 0.1, max: 20000, log: true, onInput: function (v) { P.rpmOut = v; draw(); } });
    var fN = IB.field(rail, { id: "dr-n", label: "Gear ratio", unit: ": 1", value: P.N,
      min: 1, max: 1000, log: true, onInput: function (v) { P.N = v; draw(); } });
    var fEta = IB.field(rail, { id: "dr-eta", label: "Gearbox efficiency", unit: "%", value: P.eta * 100,
      min: 30, max: 100, step: 1, onInput: function (v) { P.eta = v / 100; draw(); },
      hint: "Spur stages are 95–98 % each; a planetary set is around 90 %; a worm drive can be 50 % "
          + "or worse, and is usually self-locking in exchange." });

    rail.appendChild(el("span", { class: "eyebrow", text: "Motor", style: "display:block;margin:14px 0 2px" }));
    var fV = IB.field(rail, { id: "dr-v", label: "Supply voltage", unit: "V", value: P.V,
      min: 1, max: 60, step: 0.1, onInput: function (v) { P.V = v; draw(); } });
    var fKv = IB.field(rail, { id: "dr-kv", label: "Kv", unit: "rpm/V", value: P.Kv,
      min: 10, max: 4000, log: true, onInput: function (v) { P.Kv = v; draw(); } });
    var fR = IB.field(rail, { id: "dr-r", label: "Winding resistance", unit: "Ω", value: P.R,
      min: 0.005, max: 50, log: true, onInput: function (v) { P.R = v; draw(); } });
    var fIl = IB.field(rail, { id: "dr-il", label: "Current limit", unit: "A", value: P.Ilim,
      min: 0.1, max: 200, log: true, onInput: function (v) { P.Ilim = v; draw(); },
      hint: "Whichever is lower: the drive's limit or what the motor can take thermally — the "
          + "thermal tool works that second one out." });
    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Typical jobs" })]),
      el("div", { class: "btnrow" }, [
        preset("Robot drive wheel", 12, 500, 0.8, 10, 0.6, 60, 20),
        preset("Camera pan axis", 12, 100, 4, 1.5, 0.15, 12, 50),
        preset("Conveyor roller", 24, 250, 0.4, 8, 2.5, 90, 30),
        preset("Direct-drive prop", 22.2, 900, 0.06, 40, 0.35, 9000, 1)
      ])
    ]));
    function preset(label, V, Kv, R, Il, tq, rpm, N) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.V = V; P.Kv = Kv; P.R = R; P.Ilim = Il; P.tout = tq; P.rpmOut = rpm; P.N = N;
        fV.set(V, true); fKv.set(Kv, true); fR.set(R, true); fIl.set(Il, true);
        fTout.set(tq, true); fRpm.set(rpm, true); fN.set(N, true);
        draw();
      });
      return b;
    }

    function Kt() { return 9.5493 / P.Kv; }                  // N m per A
    function KvRad() { return P.Kv * TAU / 60; }             // rad/s per volt
    // motor torque available at a given motor speed, at full voltage, capped by the current limit
    function tqAvail(rpm) {
      var w = rpm * TAU / 60;
      var i = (P.V - w / KvRad()) / P.R;
      return Kt() * Math.max(0, Math.min(i, P.Ilim));
    }
    // motor speed reachable while making torque tq (volt-limited)
    function rpmAt(tq) {
      var i = tq / Kt();
      if (i > P.Ilim) return -1;                             // cannot make that torque at all
      var w = (P.V - i * P.R) * KvRad();
      return w > 0 ? w * 60 / TAU : -1;
    }
    function outSpeedAt(N) {
      var tqm = P.tout / (N * P.eta);
      var r = rpmAt(tqm);
      return r < 0 ? 0 : r / N;
    }

    function draw() {
      var tqm = P.tout / (P.N * P.eta);
      var rpmM = P.rpmOut * P.N;
      var wM = rpmM * TAU / 60;
      var iReq = tqm / Kt();
      var vReq = wM / KvRad() + iReq * P.R;
      var avail = tqAvail(rpmM);
      var margin = tqm > 0 ? (avail / tqm - 1) * 100 : 0;
      var pOut = P.tout * P.rpmOut * TAU / 60;

      T.mrpm.set(IB.fx(rpmM), rpmM > P.Kv * P.V ? "hot" : "");
      T.mtq.set(IB.fx(tqm * 1000, tqm * 1000 < 100 ? 1 : 0));
      T.mi.set(IB.sigfig(iReq, 3), iReq > P.Ilim ? "hot" : (iReq > P.Ilim * 0.8 ? "warnv" : "goodv"));
      T.vreq.set(IB.sigfig(vReq, 3), vReq > P.V ? "hot" : (vReq > P.V * 0.9 ? "warnv" : "goodv"));
      T.pout.set(IB.sigfig(pOut, 3));
      T.margin.set(margin > 500 ? ">500" : IB.fx(margin),
        margin < 0 ? "hot" : (margin < 20 ? "warnv" : "goodv"));

      var feasible = iReq <= P.Ilim && vReq <= P.V;
      var chips = document.getElementById("drChips");
      IB.clear(chips);
      chips.appendChild(el("span", { class: "chip on " + (feasible ? "good" : "crit"),
        text: feasible ? "within the envelope" :
          (iReq > P.Ilim ? "over the current limit" : "not enough voltage for that speed") }));
      chips.appendChild(el("span", { class: "chip on",
        text: "needs " + IB.sigfig(vReq, 3) + " V of " + IB.sigfig(P.V, 3) + " available" }));

      document.getElementById("drHint").textContent =
        "Through " + IB.sigfig(P.N, 3) + ":1 at " + IB.fx(P.eta * 100) + " % efficiency, "
        + IB.sigfig(P.tout, 3) + " N·m at the output becomes " + IB.fx(tqm * 1000, 1)
        + " mN·m at the motor, and " + IB.fx(P.rpmOut) + " rpm becomes " + IB.fx(rpmM)
        + " rpm. Gearing trades one for the other exactly; the efficiency term is the part you lose.";

      // envelope chart
      var noLoad = P.Kv * P.V, k, env = [];
      for (k = 0; k <= 120; k++) {
        var r = noLoad * k / 120;
        env.push([r, tqAvail(r) * 1000]);
      }
      var yMax = Math.max(Kt() * P.Ilim * 1000 * 1.3, tqm * 1000 * 1.3, 1);
      IB.chart(cv, {
        w: 660, h: 320, pad: [26, 24, 48, 58],
        x: { min: 0, max: Math.max(noLoad, rpmM * 1.1), label: "motor speed  (rpm)",
             fmt: function (v) { return IB.fx(v); } },
        y: { min: 0, max: yMax, label: "motor torque  (mN·m)",
             fmt: function (v) { return IB.fx(v, yMax < 20 ? 1 : 0); } },
        series: [{ pts: env, color: "var(--s1)", width: 2.3, fill: true, fillOpacity: 0.10 }],
        hlines: [{ y: Kt() * P.Ilim * 1000, color: "var(--warn)", dash: "5 4", label: "current limit" }],
        dots: [{ x: Math.min(rpmM, Math.max(noLoad, rpmM * 1.1)), y: Math.min(tqm * 1000, yMax),
                 color: feasible ? "var(--good)" : "var(--crit)",
                 label: feasible ? "required" : "required — outside" }]
      });
      document.getElementById("envHint").textContent =
        "The shaded region is everything this motor can do on " + IB.sigfig(P.V, 3) + " V: torque falls "
        + "linearly with speed until the current limit caps it flat. Your required point has to sit "
        + "inside it, with enough margin left for friction, wind-up and the day the battery is low.";

      // output speed vs gear ratio
      var rpts = [], best = 0, bestN = 1;
      for (k = 0; k <= 160; k++) {
        var N = Math.pow(10, Math.log10(1) + (Math.log10(1000) - Math.log10(1)) * k / 160);
        var s = outSpeedAt(N);
        rpts.push([N, s]);
        if (s > best) { best = s; bestN = N; }
      }
      IB.chart(rv, {
        w: 660, h: 280, pad: [24, 24, 46, 58],
        x: { min: 1, max: 1000, log: true, label: "gear ratio  (N : 1)",
             fmt: function (v) { return IB.fx(v); } },
        y: { min: 0, max: Math.max(best * 1.15, P.rpmOut * 1.3, 1), label: "output speed  (rpm)",
             fmt: function (v) { return IB.fx(v); } },
        series: [{ pts: rpts, color: "var(--s3)", width: 2.2 }],
        hlines: [{ y: P.rpmOut, color: "var(--ink-3)", dash: "4 3",
          label: "required " + IB.fx(P.rpmOut) + " rpm" }],
        vlines: [{ x: P.N, color: "var(--ink-2)", dash: "3 3", label: IB.sigfig(P.N, 3) + ":1" }],
        dots: [{ x: bestN, y: best, color: "var(--ink)", label: "best " + IB.fx(bestN) + ":1" }]
      });
      document.getElementById("ratioHint").textContent =
        "At the required torque, output speed peaks around " + IB.fx(bestN)
        + ":1 (" + IB.fx(best) + " rpm). Below that ratio the motor cannot make the torque without "
        + "exceeding its current limit; above it, the extra reduction just slows the output down. "
        + "Real gearboxes come in discrete ratios, so pick the nearest one that still clears your "
        + "requirement.";

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Ratio" }), el("th", { text: "Motor rpm" }), el("th", { text: "Motor torque" }),
        el("th", { text: "Current" }), el("th", { text: "Volts needed" }), el("th", { text: "Verdict" })
      ])]));
      var tb = el("tbody", {});
      var ratios = [1, 5, 10, 20, 50, 100, 200].concat([+bestN.toFixed(1), +P.N.toFixed(2)]);
      ratios = ratios.filter(function (v, i, a) { return v >= 1 && a.indexOf(v) === i; })
                     .sort(function (a, b) { return a - b; });
      ratios.forEach(function (N) {
        var tm = P.tout / (N * P.eta), i = tm / Kt();
        var rm = P.rpmOut * N, vv = rm * TAU / 60 / KvRad() + i * P.R;
        var ok = i <= P.Ilim && vv <= P.V;
        var tr = el("tr", { class: Math.abs(N - P.N) < 1e-6 ? "on" : "" }, [
          el("td", { text: IB.sigfig(N, 3) + ":1" }),
          el("td", { text: IB.fx(rm) }),
          el("td", { text: IB.fx(tm * 1000, 1) + " mN·m" }),
          el("td", { text: IB.sigfig(i, 3) + " A" }),
          el("td", { text: IB.sigfig(vv, 3) + " V" }),
          el("td", { text: ok ? "ok" : (i > P.Ilim ? "over current" : "over voltage") })
        ]);
        tr.style.cursor = "pointer";
        tr.addEventListener("click", function () { P.N = N; fN.set(N, true); draw(); });
        tb.appendChild(tr);
      });
      tab.appendChild(tb);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "A gearbox multiplies torque and divides speed: the motor must supply "
        + "<code>τout/(N·η)</code> at <code>ωout·N</code>. The motor's own envelope is the "
        + "usual straight line, <code>τ = Kt·(V − ω/Kv)/R</code>, flattened wherever the "
        + "current limit bites, and the voltage needed for a given point is "
        + "<code>ω/Kv + I·R</code>. The output-speed curve peaks because low ratios ask for more "
        + "torque than the current limit allows while high ratios simply gear the speed away. "
        + "<strong>Steady state only:</strong> no inertia, so nothing here covers acceleration — for "
        + "that you also need the reflected load inertia <code>J/N²</code>, and the ratio that "
        + "maximises acceleration is <code>√(Jload/Jmotor)</code>, which is usually not the ratio "
        + "that maximises speed. Also absent: gearbox backlash and backdriving, friction and preload, "
        + "duty-cycle heating (see the thermal tool), and the fact that a gearbox has its own input-speed "
        + "and output-torque ratings that often bind before the motor does." })
    ]));

    draw();
  }
});
