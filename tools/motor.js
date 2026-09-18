/* Brushless (BLDC) six-step commutation bench — live sim. */
IB.register({
  id: "motor",
  name: "Brushless Motor Bench",
  nav: "BLDC bench",
  group: "Motors and drives",
  live: true,
  tag: "Three-phase · trapezoidal drive",
  blurb: "Six switch states, one rotating field, and a rotor that never quite catches it. Set the supply "
       + "and the controller limit, load the shaft, and watch where the watts go.",
  eq: "e = ω/Kv   ·   I = (D·V − e)/R   ·   τ = Kt·I·sin(θfield − θrotor)",

  mount: function (root, head) {
    var el = IB.el, svg = IB.svg, TAU = Math.PI * 2, D2R = Math.PI / 180;
    var P = { V: 11.1, Ilim: 20, load: 0.020, Kv: 1000, R: 0.120, p: 7 };
    var J = 3.0e-5, Bvisc = 2.0e-6, Tcoul = 0.0015;
    var slowMode = "auto", slow = 0.002, AUTO_HZ = 0.34, lastSlow = 0.002;
    var w = 1000, thDisp = 0, raf = null, last = 0;
    var out = { I: 0, D: 1, tq: 0, pin: 0, cu: 0, mech: 0, fric: 0, eff: 0, limited: false, stalled: false };

    var chipState = el("span", { class: "chip idle on", text: "idle" });
    var chipRate = el("span", { class: "chip mono", text: "—" });
    head.appendChild(el("div", { class: "headside" }, [chipState, chipRate]));

    var tilesHost = el("div", {});
    root.appendChild(tilesHost);
    var T = IB.tiles(tilesHost, [
      { id: "rpm", k: "Shaft speed", u: "rpm" },
      { id: "amp", k: "Phase current", u: "A" },
      { id: "trq", k: "Shaft torque", u: "mN·m" },
      { id: "pin", k: "Electrical in", u: "W" },
      { id: "eff", k: "Efficiency", u: "%" },
      { id: "heat", k: "Coil heat", u: "W" }
    ], 6);

    var cols = el("div", { class: "cols", style: "margin-top:20px" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    /* ---------------- motor view ---------------- */
    var viewPanel = el("div", { class: "panel" });
    left.appendChild(viewPanel);
    viewPanel.appendChild(el("span", { class: "eyebrow", text: "Commutation view · one electrical cycle" }));
    var motor = svg("svg", { viewBox: "0 0 420 420", role: "img",
      "aria-label": "Motor cross-section showing which coils are energised and where the rotor sits" });
    var shaft = svg("svg", { viewBox: "0 0 120 120", role: "img", "aria-label": "Shaft rotation indicator" });
    var shaftNote = el("p", { class: "shaft-note" });
    viewPanel.appendChild(el("div", { class: "motorwrap" }, [
      motor, el("div", { class: "shaftbox" }, [shaft, shaftNote])
    ]));
    viewPanel.appendChild(el("div", { class: "legend" }, [
      sw("var(--s1)", "Phase A"), sw("var(--s2)", "Phase B"), sw("var(--s3)", "Phase C"),
      sw("var(--north)", "Rotor N"), sw("var(--south)", "Rotor S"),
      el("span", { text: "⊗ current in · ⊙ current out" })
    ]));
    var viewHint = el("p", { class: "hint" });
    viewPanel.appendChild(viewHint);
    function sw(c, t) { return el("span", {}, [el("i", { class: "swatch", style: "background:" + c }), t]); }

    /* ---------------- sequence + waveform ---------------- */
    var seqPanel = el("div", { class: "panel" });
    left.appendChild(seqPanel);
    seqPanel.appendChild(el("span", { class: "eyebrow", text: "Switch sequence · Hall code" }));
    var stepsHost = el("div", { class: "steps" });
    seqPanel.appendChild(stepsHost);
    var wave = svg("svg", { viewBox: "0 0 660 190", role: "img",
      "aria-label": "Trapezoidal phase voltage waveform with a playhead" });
    seqPanel.appendChild(el("div", { class: "scroller" }, [wave]));
    seqPanel.appendChild(el("p", { class: "hint",
      text: "Each phase is driven high for 120°, low for 120°, and left floating for the 60° "
          + "either side — that floating window is where a sensorless controller reads back-EMF "
          + "instead of a Hall sensor." }));

    /* ---------------- charts ---------------- */
    var bottom = el("div", { class: "cols", style: "margin-top:18px" });
    root.appendChild(bottom);
    var tsPanel = el("div", { class: "panel" });
    tsPanel.appendChild(el("span", { class: "eyebrow", text: "Torque vs speed · at this voltage and limit" }));
    var tsSvg = svg("svg", { viewBox: "0 0 660 300", role: "img",
      "aria-label": "Torque against speed with the current-limit ceiling, the load line and the operating point" });
    tsPanel.appendChild(el("div", { class: "scroller" }, [tsSvg]));
    var tsHint = el("p", { class: "hint" });
    tsPanel.appendChild(tsHint);
    var splitPanel = el("div", { class: "panel" });
    splitPanel.appendChild(el("span", { class: "eyebrow", text: "Where the watts go" }));
    var spMech = el("div", { style: "background:var(--s3)" }),
        spCopper = el("div", { style: "background:var(--s2)" }),
        spFric = el("div", { style: "background:var(--ink-3)" });
    splitPanel.appendChild(el("div", { class: "split" }, [spMech, spCopper, spFric]));
    var kMech = el("b", { text: "0 W" }), kCopper = el("b", { text: "0 W" }), kFric = el("b", { text: "0 W" });
    splitPanel.appendChild(el("div", { class: "splitkey" }, [
      el("span", {}, [el("i", { class: "swatch", style: "background:var(--s3)" }), "Shaft work ", kMech]),
      el("span", {}, [el("i", { class: "swatch", style: "background:var(--s2)" }), "Coil heat ", kCopper]),
      el("span", {}, [el("i", { class: "swatch", style: "background:var(--ink-3)" }), "Friction & iron ", kFric])
    ]));
    var splitHint = el("p", { class: "hint" });
    splitPanel.appendChild(splitHint);
    bottom.appendChild(tsPanel); bottom.appendChild(splitPanel);

    /* ---------------- controls ---------------- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Bench controls" }));
    var fV = IB.field(rail, { id: "m-v", label: "Supply voltage", unit: "V", value: P.V,
      min: 0, max: 48, step: 0.1, onInput: function (v) { P.V = v; params(); } });
    var fI = IB.field(rail, { id: "m-i", label: "Controller current limit", unit: "A", value: P.Ilim,
      min: 1, max: 60, step: 0.5, onInput: function (v) { P.Ilim = v; params(); } });
    var fL = IB.field(rail, { id: "m-l", label: "Load torque", unit: "mN·m", value: P.load * 1000,
      min: 0, max: 400, step: 1, onInput: function (v) { P.load = v / 1000; params(); },
      hint: "What the shaft is pushing against. The motor draws exactly the current this demands." });
    var fKv = IB.field(rail, { id: "m-kv", label: "Motor Kv", unit: "rpm/V", value: P.Kv,
      min: 50, max: 3000, step: 10, onInput: function (v) { P.Kv = v; params(); } });
    var fR = IB.field(rail, { id: "m-r", label: "Winding resistance", unit: "mΩ", value: P.R * 1000,
      min: 10, max: 800, log: true, onInput: function (v) { P.R = v / 1000; params(); },
      hint: "Phase to phase. Every amp through it becomes heat at I²R." });
    var fP = IB.field(rail, { id: "m-p", label: "Pole pairs", unit: "", value: P.p,
      min: 1, max: 12, step: 1, onInput: function (v) { P.p = Math.round(v); params(); },
      hint: "Poles divide shaft speed, not torque: the field still steps six times per electrical cycle." });
    IB.segmented(rail, { label: "Slow-motion view", value: "auto",
      options: [{ label: "Auto", value: "auto" }, { label: "1/500", value: "0.002" },
                { label: "1/5000", value: "0.0002" }, { label: "1×", value: "1" }],
      onInput: function (v) { slowMode = v === "auto" ? "auto" : parseFloat(v); params(); },
      hint: "Camera speed only — the physics and the gauges are unchanged. Auto holds the picture at "
          + "about two commutation steps a second." });
    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Presets" })]),
      el("div", { class: "btnrow" }, [
        preset("3S racing drone", 11.1, 30, 25, 2300, 60, 7),
        preset("6S cinelifter", 22.2, 45, 120, 1200, 45, 7),
        preset("Gimbal motor", 12, 1.5, 6, 100, 600, 11),
        preset("24 V gear drive", 24, 15, 300, 150, 250, 8),
        preset("Stall it", 16, 12, 400, 1400, 120, 7)
      ])
    ]));
    function preset(label, V, I, L, Kv, Rm, p) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.V = V; P.Ilim = I; P.load = L / 1000; P.Kv = Kv; P.R = Rm / 1000; P.p = p;
        fV.set(V, true); fI.set(I, true); fL.set(L, true); fKv.set(Kv, true); fR.set(Rm, true); fP.set(p, true);
        params();
      });
      return b;
    }

    /* ---------------- six-step tables ---------------- */
    var SECTORS = [
      { hi: "A", lo: "C", off: "B", hall: "101" }, { hi: "B", lo: "C", off: "A", hall: "001" },
      { hi: "B", lo: "A", off: "C", hall: "011" }, { hi: "C", lo: "A", off: "B", hall: "010" },
      { hi: "C", lo: "B", off: "A", hall: "110" }, { hi: "A", lo: "B", off: "C", hall: "100" }
    ];
    var PH = { A: "var(--s1)", B: "var(--s2)", C: "var(--s3)" };

    function Kt() { return 9.5493 / P.Kv; }
    function KvRad() { return P.Kv * TAU / 60; }

    function solve(wNow) {
      var e = wNow / KvRad(), D = 1, I = 0;
      if (P.V > 1e-6) {
        I = (P.V - e) / P.R;
        if (I > P.Ilim) { D = IB.clamp((P.Ilim * P.R + e) / P.V, 0, 1); I = P.Ilim; }
        else if (I < 0) { I = 0; D = 1; }
      }
      return { I: I, D: D, e: e, limited: D < 0.999 };
    }
    function torqueAngle(thE) {
      var target = thE + Math.PI / 2;
      var k = Math.round((target - Math.PI / 6) / (Math.PI / 3));
      return (k * Math.PI / 3 + Math.PI / 6) - thE;
    }
    function fieldAngle(thE) { return thE + torqueAngle(thE); }
    function sectorOf(thE) {
      var k = Math.round((fieldAngle(thE) - Math.PI / 6) / (Math.PI / 3));
      return ((k % 6) + 6) % 6;
    }
    function step(dt) {
      var s = solve(w);
      var tqEm = Kt() * s.I * Math.sin(torqueAngle(thDisp));
      var fr = Bvisc * w + (w > 0.5 ? Tcoul : 0);
      var net = tqEm - P.load - fr;
      if (w <= 0 && net <= 0) { w = 0; net = 0; }
      w = Math.max(0, w + net / J * dt);
      out.I = s.I; out.D = s.D; out.tq = tqEm;
      out.mech = P.load * w; out.fric = fr * w; out.cu = s.I * s.I * P.R; out.pin = s.D * P.V * s.I;
      out.eff = out.pin > 0.01 ? Math.max(0, out.mech / out.pin) : 0;
      out.limited = s.limited && s.I > 0.01;
      out.stalled = w < 1 && s.I > 0.05;
    }

    /* ---------------- drawing ---------------- */
    var CX = 210, CY = 210;
    var SLOTS = [
      { ph: "A", sign: 1, a: 0 }, { ph: "C", sign: -1, a: 60 }, { ph: "B", sign: 1, a: 120 },
      { ph: "A", sign: -1, a: 180 }, { ph: "C", sign: 1, a: 240 }, { ph: "B", sign: -1, a: 300 }
    ];
    var teeth = [], glows = [], marks = [], rotorG, fieldArrow, fieldHead, shaftMark, playhead, stepEls = [];
    var waveX0 = 42, waveX1 = 640;

    function toothPath(r0, r1, w0, w1) {
      return "M" + (CX + r0) + "," + (CY - w0 / 2) + " L" + (CX + r1) + "," + (CY - w1 / 2) +
             " L" + (CX + r1) + "," + (CY + w1 / 2) + " L" + (CX + r0) + "," + (CY + w0 / 2) + " Z";
    }
    function halfDisc(r, a0, a1) {
      var x0 = CX + r * Math.cos(a0 * D2R), y0 = CY + r * Math.sin(a0 * D2R);
      var x1 = CX + r * Math.cos(a1 * D2R), y1 = CY + r * Math.sin(a1 * D2R);
      return "M" + CX + "," + CY + " L" + x0 + "," + y0 + " A" + r + "," + r + " 0 0 1 " + x1 + "," + y1 + " Z";
    }
    function buildMotor() {
      var g = svg("g", {});
      motor.appendChild(g);
      g.appendChild(svg("circle", { cx: CX, cy: CY, r: 161, fill: "none", stroke: "var(--rule)", "stroke-width": 1 }));
      SLOTS.forEach(function (s) {
        var gg = svg("g", { transform: "rotate(" + (-s.a) + " " + CX + " " + CY + ")" });
        var glow = svg("path", { d: toothPath(100, 158, 26, 34), fill: PH[s.ph], opacity: 0 });
        var body = svg("path", { d: toothPath(100, 158, 26, 34), fill: "none", stroke: "var(--rule)", "stroke-width": 1.4 });
        gg.appendChild(glow); gg.appendChild(body);
        for (var t = 0; t < 3; t++) {
          var rr = 116 + t * 14, hw = 15 + (rr - 100) / 58 * 2.6;
          gg.appendChild(svg("line", { x1: CX + rr, y1: CY - hw, x2: CX + rr, y2: CY + hw,
            stroke: "var(--rule)", "stroke-width": 1.1, "stroke-linecap": "round", opacity: .85 }));
        }
        gg.appendChild(svg("text", { x: CX + 178, y: CY + 5, "text-anchor": "middle", "font-size": 15,
          "font-family": "IBM Plex Mono, monospace", "font-weight": 600, fill: PH[s.ph],
          transform: "rotate(" + s.a + " " + (CX + 178) + " " + CY + ")" }, s.ph + (s.sign < 0 ? "'" : "")));
        var mark = svg("text", { x: CX + 128, y: CY + 6, "text-anchor": "middle", "font-size": 17,
          fill: "var(--panel)", opacity: 0 }, "⊗");
        gg.appendChild(mark);
        g.appendChild(gg);
        teeth.push(body); glows.push(glow); marks.push(mark);
      });
      fieldArrow = svg("line", { x1: CX, y1: CY, x2: CX + 86, y2: CY, stroke: "var(--field)",
        "stroke-width": 2.4, "stroke-linecap": "round", opacity: .9 });
      fieldHead = svg("path", { d: "M0,0 L-13,6 L-13,-6 Z", fill: "var(--field)", opacity: .9 });
      rotorG = svg("g", {});
      rotorG.appendChild(svg("circle", { cx: CX, cy: CY, r: 86, fill: "var(--panel-2)", stroke: "var(--rule)", "stroke-width": 1.2 }));
      rotorG.appendChild(svg("path", { d: halfDisc(84, -90, 90), fill: "var(--north)", opacity: .88 }));
      rotorG.appendChild(svg("path", { d: halfDisc(84, 90, 270), fill: "var(--south)", opacity: .88 }));
      rotorG.appendChild(svg("text", { x: CX + 50, y: CY + 6, "text-anchor": "middle", "font-size": 19,
        "font-weight": 700, fill: "var(--panel)", "font-family": "Barlow Condensed, sans-serif" }, "N"));
      rotorG.appendChild(svg("text", { x: CX - 50, y: CY + 6, "text-anchor": "middle", "font-size": 19,
        "font-weight": 700, fill: "var(--panel)", "font-family": "Barlow Condensed, sans-serif" }, "S"));
      rotorG.appendChild(svg("circle", { cx: CX, cy: CY, r: 13, fill: "var(--panel)", stroke: "var(--rule)", "stroke-width": 1.2 }));
      g.appendChild(rotorG); g.appendChild(fieldArrow); g.appendChild(fieldHead);
      g.appendChild(svg("text", { x: CX, y: 404, "text-anchor": "middle", "font-size": 12,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, "stator field leads the rotor"));

      var sg = svg("g", {});
      shaft.appendChild(sg);
      sg.appendChild(svg("circle", { cx: 60, cy: 60, r: 44, fill: "var(--panel-2)", stroke: "var(--rule)", "stroke-width": 1.2 }));
      sg.appendChild(svg("circle", { cx: 60, cy: 60, r: 7, fill: "var(--panel)", stroke: "var(--rule)", "stroke-width": 1.2 }));
      shaftMark = svg("g", {});
      shaftMark.appendChild(svg("rect", { x: 56.5, y: 16, width: 7, height: 22, rx: 1.5, fill: "var(--copper)" }));
      sg.appendChild(shaftMark);
      sg.appendChild(svg("text", { x: 60, y: 114, "text-anchor": "middle", "font-size": 11,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, "SHAFT"));
    }

    function buildSteps() {
      SECTORS.forEach(function (s, i) {
        var phs = ["A", "B", "C"].map(function (ph) {
          var sym = ph === s.hi ? "+" : (ph === s.lo ? "−" : "·");
          return '<span style="color:' + (ph === s.off ? "var(--ink-3)" : PH[ph]) +
            (ph === s.off ? ';opacity:.5' : '') + '">' + ph + sym + "</span>";
        }).join(" ");
        var d = el("div", { class: "step", html: '<div class="n">STEP ' + (i + 1) +
          '</div><div class="ph">' + phs + '</div><div class="hall">hall ' + s.hall + "</div>" });
        stepsHost.appendChild(d);
        stepEls.push(d);
      });
    }

    function buildWave() {
      var rows = [{ ph: "A", y: 44 }, { ph: "B", y: 100 }, { ph: "C", y: 156 }], amp = 19;
      var g = svg("g", {});
      wave.appendChild(g);
      for (var k = 0; k <= 6; k++) {
        var x = waveX0 + (waveX1 - waveX0) * k / 6;
        g.appendChild(svg("line", { x1: x, y1: 22, x2: x, y2: 176, stroke: "var(--rule-soft)", "stroke-width": 1 }));
        if (k < 6) g.appendChild(svg("text", { x: waveX0 + (waveX1 - waveX0) * (k + 0.5) / 6, y: 16,
          "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)",
          "font-family": "IBM Plex Mono, monospace" }, (k * 60) + "°"));
      }
      rows.forEach(function (r) {
        g.appendChild(svg("line", { x1: waveX0, y1: r.y, x2: waveX1, y2: r.y, stroke: "var(--rule)",
          "stroke-width": 1, "stroke-dasharray": "2 3" }));
        g.appendChild(svg("text", { x: waveX0 - 10, y: r.y + 4, "text-anchor": "end", "font-size": 12,
          fill: PH[r.ph], "font-family": "IBM Plex Mono, monospace", "font-weight": 600 }, r.ph));
        var parts = [], cur = null, k2;
        for (k2 = 0; k2 < 6; k2++) {
          var s = SECTORS[k2], lv = (r.ph === s.hi) ? -amp : (r.ph === s.lo ? amp : null);
          var xa = waveX0 + (waveX1 - waveX0) * k2 / 6, xb = waveX0 + (waveX1 - waveX0) * (k2 + 1) / 6;
          if (lv === null) { cur = null; continue; }
          if (cur === lv && parts.length) parts[parts.length - 1] += " L" + xb + "," + (r.y + lv);
          else parts.push("M" + xa + "," + (r.y + lv) + " L" + xb + "," + (r.y + lv));
          cur = lv;
        }
        g.appendChild(svg("path", { d: parts.join(" "), fill: "none", stroke: PH[r.ph], "stroke-width": 2.4,
          "stroke-linecap": "round", "stroke-linejoin": "round" }));
        for (var k3 = 1; k3 < 6; k3++) {
          var s0 = SECTORS[k3 - 1], s1 = SECTORS[k3];
          var v0 = (r.ph === s0.hi) ? -amp : (r.ph === s0.lo ? amp : null);
          var v1 = (r.ph === s1.hi) ? -amp : (r.ph === s1.lo ? amp : null);
          if (v0 !== null && v1 !== null && v0 !== v1) {
            var xx = waveX0 + (waveX1 - waveX0) * k3 / 6;
            g.appendChild(svg("line", { x1: xx, y1: r.y + v0, x2: xx, y2: r.y + v1, stroke: PH[r.ph],
              "stroke-width": 2.4, "stroke-linecap": "round" }));
          }
        }
      });
      g.appendChild(svg("text", { x: waveX1 + 4, y: 48, "font-size": 10, fill: "var(--ink-3)",
        "font-family": "IBM Plex Mono, monospace" }, "+V"));
      g.appendChild(svg("text", { x: waveX1 + 4, y: 162, "font-size": 10, fill: "var(--ink-3)",
        "font-family": "IBM Plex Mono, monospace" }, "−V"));
      playhead = svg("line", { x1: waveX0, y1: 20, x2: waveX0, y2: 178, stroke: "var(--ink)",
        "stroke-width": 1.6, opacity: .75 });
      g.appendChild(playhead);
    }

    var lastSector = -1;
    function draw() {
      var thE = thDisp % TAU, degE = thE / D2R;
      var f = fieldAngle(thE), fDeg = f / D2R, k = sectorOf(thE), S = SECTORS[k];
      rotorG.setAttribute("transform", "rotate(" + (-degE) + " " + CX + " " + CY + ")");
      var fr = 150, fx = CX + fr * Math.cos(-f), fy = CY + fr * Math.sin(-f);
      fieldArrow.setAttribute("x2", fx); fieldArrow.setAttribute("y2", fy);
      fieldHead.setAttribute("transform", "translate(" + fx + "," + fy + ") rotate(" + (-fDeg) + ")");
      var live = out.I > 0.02;
      fieldArrow.setAttribute("opacity", live ? 0.9 : 0.12);
      fieldHead.setAttribute("opacity", live ? 0.9 : 0.12);
      var drive = Math.min(1, out.I / Math.max(P.Ilim, 1e-6));
      SLOTS.forEach(function (s, i) {
        var on = (s.ph === S.hi || s.ph === S.lo);
        var into = (s.ph === S.hi) ? (s.sign > 0) : (s.sign < 0);
        glows[i].setAttribute("opacity", on && live ? (0.20 + 0.55 * drive) : 0);
        teeth[i].setAttribute("stroke", on && live ? PH[s.ph] : "var(--rule)");
        teeth[i].setAttribute("stroke-width", on && live ? 2 : 1.4);
        marks[i].setAttribute("opacity", on && live ? 1 : 0);
        marks[i].textContent = into ? "⊗" : "⊙";
      });
      if (k !== lastSector) {
        for (var j = 0; j < 6; j++) stepEls[j].classList.toggle("active", j === k);
        lastSector = k;
      }
      var px = waveX0 + (waveX1 - waveX0) * (degE / 360);
      playhead.setAttribute("x1", px); playhead.setAttribute("x2", px);
      playhead.setAttribute("opacity", live ? 0.75 : 0.25);
      shaftMark.setAttribute("transform", "rotate(" + (-degE / P.p) + " 60 60)");
    }

    function readouts() {
      var rpm = w * 60 / TAU;
      T.rpm.set(IB.fx(rpm));
      T.amp.set(IB.fx(out.I, 1));
      T.trq.set(IB.fx(out.tq * 1000, Math.abs(out.tq * 1000) < 100 ? 1 : 0));
      T.pin.set(IB.fx(out.pin, out.pin < 10 ? 1 : 0));
      T.eff.set(IB.fx(out.eff * 100));
      T.heat.set(IB.fx(out.cu, out.cu < 10 ? 1 : 0), (out.cu > 0.35 * Math.max(out.pin, 0.01) && out.cu > 1) ? "hot" : "");
      var fe = rpm / 60 * P.p;
      chipRate.textContent = IB.fx(fe, 1) + " Hz elec · " + IB.fx(fe * 6) + " steps/s";
      chipState.className = "chip on " + (out.stalled ? "crit" : out.limited ? "warn" : (w > 1 ? "good" : "idle"));
      chipState.textContent = out.stalled ? "stalled" : out.limited ? "current limited" : (w > 1 ? "running" : "idle");
      var tot = Math.max(out.pin, 1e-6);
      spMech.style.width = IB.clamp(out.mech / tot * 100, 0, 100) + "%";
      spCopper.style.width = IB.clamp(out.cu / tot * 100, 0, 100) + "%";
      spFric.style.width = IB.clamp(out.fric / tot * 100, 0, 100) + "%";
      kMech.textContent = IB.fx(out.mech, out.mech < 10 ? 2 : 1) + " W";
      kCopper.textContent = IB.fx(out.cu, out.cu < 10 ? 2 : 1) + " W";
      kFric.textContent = IB.fx(out.fric, out.fric < 10 ? 2 : 1) + " W";
      splitHint.textContent = out.stalled
        ? "Stalled: the shaft is not moving, so every watt drawn is heat in the windings."
        : out.pin < 0.01 ? "No supply — nothing is being drawn."
        : "Coil heat is I²R, so it grows with the square of current: double the torque, quadruple the heat.";
      IB.store.set("motorCurrent", Math.round(out.I * 100) / 100);
    }

    function params() {
      viewHint.textContent = slowMode === "auto"
        ? "Auto slow-motion — the picture is held at a readable pace (currently ×1/"
          + IB.fx(1 / Math.max(slow, 1e-9)) + "); the gauges above run in real time."
        : (slow === 1 ? "Real time — at any real speed the rotor is a blur; slow it down to see the steps."
          : "Slow-motion view ×1/" + IB.fx(1 / slow) + " — the gauges run in real time.");
      shaftNote.innerHTML = P.p === 1 ? "shaft turns 1× per<br>electrical cycle"
        : "shaft turns 1/" + P.p + " turn per<br>electrical cycle";
      fKv.hint("Kt = 9.55 / Kv = " + IB.fx(9.5493 / P.Kv * 1000, 1) + " mN·m per amp. "
        + "No-load is Kv × V = " + IB.fx(P.Kv * P.V) + " rpm.");
      fI.hint("The ESC chops duty to hold current here — a torque ceiling of "
        + IB.fx(9.5493 / P.Kv * P.Ilim * 1000) + " mN·m.");
      redrawTS();
    }

    function redrawTS() {
      var kt = Kt(), noLoad = P.Kv * P.V, tqStall = kt * (P.V / P.R) * 1000, tqLim = kt * P.Ilim * 1000;
      var xMax = Math.max(noLoad, 1);
      var yMax = Math.max(Math.min(tqStall, tqLim * 1.9), tqLim * 1.25, P.load * 1000 * 1.25, 1);
      var rpmTop = tqStall > yMax ? noLoad * (1 - yMax / tqStall) : 0;
      IB.chart(tsSvg, {
        w: 660, h: 300, pad: [26, 22, 48, 56],
        x: { min: 0, max: xMax, label: "shaft speed  (rpm)", fmt: function (v) { return IB.fx(v); } },
        y: { min: 0, max: yMax, label: "torque  (mN·m)", fmt: function (v) { return IB.fx(v, yMax < 20 ? 1 : 0); } },
        series: [{ pts: [[rpmTop, Math.min(tqStall, yMax)], [noLoad, 0]], color: "var(--s1)", width: 2.2 }],
        hlines: [
          { y: tqLim, color: "var(--warn)", dash: "5 4", label: "current limit" },
          { y: P.load * 1000, color: "var(--ink-3)", dash: "2 4", label: "load" }
        ],
        dots: [{ x: w * 60 / TAU, y: Math.max(0, out.tq * 1000), color: "var(--ink)" }],
        legend: [{ color: "var(--s1)", label: "motor torque at full duty" }]
      });
      tsHint.textContent = tqLim < tqStall
        ? "Below " + IB.fx(noLoad * (1 - tqLim / tqStall)) + " rpm the motor wants more current than the "
          + "limit allows, so the controller cuts duty and torque flattens off."
        : "The limit sits above stall torque, so it never engages — this motor is winding-limited, "
          + "not controller-limited.";
    }

    function frame(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      for (var i = 0; i < 4; i++) step(dt / 4);
      var feReal = w * P.p / TAU;
      slow = (slowMode === "auto") ? (feReal > 1e-6 ? Math.min(1, AUTO_HZ / feReal) : 1) : slowMode;
      if (IB.reduce) slow = Math.min(slow, 0.002);
      thDisp = (thDisp + w * P.p * dt * slow) % TAU;
      draw(); readouts();
      if (Math.abs(ts % 500) < 20) redrawTS();
      if (slowMode === "auto" && Math.abs(slow - lastSlow) > lastSlow * 0.25) { lastSlow = slow; params(); }
      raf = requestAnimationFrame(frame);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "Back-EMF <code>e = ω/Kv</code>, phase current <code>I = (D·V − e)/R</code>, torque "
        + "<code>τ = Kt·I·sin(θfield − θrotor)</code> with <code>Kt = 9.55/Kv</code>, "
        + "and the shaft integrated as <code>J·dω/dt = τ − τload − friction</code> with "
        + "J = 30 g·cm². The controller solves for the duty <code>D</code> that holds current at the "
        + "limit. Six-step commutation quantises the field to 60° jumps, so the torque angle swings "
        + "between 60° and 120° — that is the ±13.4 % ripple in the torque gauge, and the "
        + "reason field-oriented control exists. Ideal switches, no inductance lag, no iron saturation." })
    ]));

    buildMotor(); buildSteps(); buildWave();
    params(); step(0.001); draw(); readouts();
    raf = requestAnimationFrame(frame);
    this.unmount = function () { if (raf) cancelAnimationFrame(raf); raf = null; last = 0; };
  }
});
