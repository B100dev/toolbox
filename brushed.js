/* Brushed DC motor — commutator animation and the classic four performance curves. */
IB.register({
  id: "brushed",
  name: "Brushed Motor Bench",
  nav: "Brushed bench",
  live: true,
  tag: "Permanent magnet · mechanical commutation",
  blurb: "The same machine with the switching done by carbon on copper. Watch the commutator reverse the "
       + "armature twice a turn, and read the four curves that fall straight out of a straight line.",
  eq: "I = (V − Vbrush − ω/Kv)/R   ·   τ = Kt(I − I₀)",

  mount: function (root, head) {
    var el = IB.el, svg = IB.svg, TAU = Math.PI * 2, D2R = Math.PI / 180;
    var P = { V: 12, R: 1.2, Kv: 800, I0: 0.25, load: 0.020, vb: 1.4, seg: 8 };
    var J = 1.2e-5, Bvisc = 1.2e-6;
    var slowMode = "auto", slow = 0.002, AUTO_HZ = 0.45, lastSlow = 0.002;
    var w = 300, thDisp = 0, raf = null, last = 0, sparkT = 0, lastSeg = -1;
    var out = { I: 0, tq: 0, pin: 0, cu: 0, mech: 0, fric: 0, brush: 0, eff: 0, stalled: false };

    var chipState = el("span", { class: "chip idle on", text: "idle" });
    var chipArc = el("span", { class: "chip mono", text: "—" });
    head.appendChild(el("div", { class: "headside" }, [chipState, chipArc]));

    var tilesHost = el("div", {});
    root.appendChild(tilesHost);
    var T = IB.tiles(tilesHost, [
      { id: "rpm", k: "Shaft speed", u: "rpm" },
      { id: "amp", k: "Armature current", u: "A" },
      { id: "trq", k: "Shaft torque", u: "mN·m" },
      { id: "pin", k: "Electrical in", u: "W" },
      { id: "eff", k: "Efficiency", u: "%" },
      { id: "heat", k: "Copper + brush heat", u: "W" }
    ], 6);

    var cols = el("div", { class: "cols", style: "margin-top:20px" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    /* ---------------- motor view ---------------- */
    var viewPanel = el("div", { class: "panel" });
    left.appendChild(viewPanel);
    viewPanel.appendChild(el("span", { class: "eyebrow", text: "Cross-section · two-pole, one armature loop shown" }));
    var motor = svg("svg", { viewBox: "0 0 420 420", role: "img",
      "aria-label": "Brushed motor cross-section: field magnets, rotating armature loop and the torque direction" });
    var comm = svg("svg", { viewBox: "0 0 140 140", role: "img",
      "aria-label": "Commutator segments passing under the two brushes" });
    var commNote = el("p", { class: "shaft-note" });
    viewPanel.appendChild(el("div", { class: "motorwrap" }, [
      motor, el("div", { class: "shaftbox" }, [comm, commNote])
    ]));
    viewPanel.appendChild(el("div", { class: "legend" }, [
      sw("var(--north)", "Field N"), sw("var(--south)", "Field S"),
      sw("var(--s1)", "Armature current"), sw("var(--copper)", "Commutator / brushes"),
      el("span", { text: "⊗ into the page · ⊙ out of it" })
    ]));
    var viewHint = el("p", { class: "hint" });
    viewPanel.appendChild(viewHint);
    function sw(c, t) { return el("span", {}, [el("i", { class: "swatch", style: "background:" + c }), t]); }

    /* ---------------- four curves ---------------- */
    var curvePanel = el("div", { class: "panel" });
    left.appendChild(curvePanel);
    curvePanel.appendChild(el("span", { class: "eyebrow", text: "Performance against load torque · at this voltage" }));
    var quad = el("div", { class: "quad" });
    var cSpeed = svg("svg", { viewBox: "0 0 330 190", role: "img", "aria-label": "Speed against torque" });
    var cCur = svg("svg", { viewBox: "0 0 330 190", role: "img", "aria-label": "Current against torque" });
    var cPow = svg("svg", { viewBox: "0 0 330 190", role: "img", "aria-label": "Output power against torque" });
    var cEff = svg("svg", { viewBox: "0 0 330 190", role: "img", "aria-label": "Efficiency against torque" });
    [["Speed", cSpeed], ["Current", cCur], ["Output power", cPow], ["Efficiency", cEff]].forEach(function (p) {
      quad.appendChild(el("div", {}, [el("span", { class: "eyebrow", text: p[0] }), p[1]]));
    });
    curvePanel.appendChild(quad);
    var curveHint = el("p", { class: "hint" });
    curvePanel.appendChild(curveHint);

    /* ---------------- operating points ---------------- */
    var opPanel = el("div", { class: "panel" });
    left.appendChild(opPanel);
    opPanel.appendChild(el("span", { class: "eyebrow", text: "The four points that define the motor" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); opPanel.appendChild(tw);

    /* ---------------- controls ---------------- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Bench controls" }));
    var fV = IB.field(rail, { id: "b-v", label: "Supply voltage", unit: "V", value: P.V,
      min: 0, max: 48, step: 0.1, onInput: function (v) { P.V = v; params(); } });
    var fL = IB.field(rail, { id: "b-l", label: "Load torque", unit: "mN·m", value: P.load * 1000,
      min: 0, max: 400, step: 1, onInput: function (v) { P.load = v / 1000; params(); } });
    var fKv = IB.field(rail, { id: "b-kv", label: "Motor Kv", unit: "rpm/V", value: P.Kv,
      min: 20, max: 3000, step: 10, onInput: function (v) { P.Kv = v; params(); } });
    var fR = IB.field(rail, { id: "b-r", label: "Armature resistance", unit: "Ω", value: P.R,
      min: 0.02, max: 40, log: true, onInput: function (v) { P.R = v; params(); },
      hint: "Terminal to terminal, brushes included. Small motors are ohms; a starter motor is milliohms." });
    var fI0 = IB.field(rail, { id: "b-i0", label: "No-load current", unit: "A", value: P.I0,
      min: 0, max: 5, step: 0.01, onInput: function (v) { P.I0 = v; params(); },
      hint: "Friction, brush drag and iron loss, rolled into one current the motor draws spinning free." });
    var fVb = IB.field(rail, { id: "b-vb", label: "Brush drop", unit: "V", value: P.vb,
      min: 0, max: 3, step: 0.1, onInput: function (v) { P.vb = v; params(); },
      hint: "Carbon brushes cost roughly 1–2 V whatever the current — brutal on a 6 V motor, "
          + "irrelevant on a 200 V one. Set 0 for an idealised machine." });
    var fSeg = IB.field(rail, { id: "b-seg", label: "Commutator segments", unit: "", value: P.seg,
      min: 2, max: 16, step: 2, onInput: function (v) { P.seg = Math.round(v / 2) * 2; params(); },
      hint: "More segments, smaller torque ripple and gentler arcing — and more to wear out." });
    IB.segmented(rail, { label: "Slow-motion view", value: "auto",
      options: [{ label: "Auto", value: "auto" }, { label: "1/200", value: "0.005" },
                { label: "1/2000", value: "0.0005" }, { label: "1×", value: "1" }],
      onInput: function (v) { slowMode = v === "auto" ? "auto" : parseFloat(v); params(); } });
    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Presets" })]),
      el("div", { class: "btnrow" }, [
        preset("Toy 3 V motor", 3, 4.5, 3000, 0.08, 1.0, 0.9, 3),
        preset("12 V gearmotor", 12, 1.2, 800, 0.25, 20, 1.4, 8),
        preset("Drill motor", 18, 0.25, 500, 0.9, 200, 1.6, 12),
        preset("Starter motor", 12, 0.02, 90, 6, 400, 1.8, 16)
      ])
    ]));
    function preset(label, V, R, Kv, I0, L, vb, seg) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.V = V; P.R = R; P.Kv = Kv; P.I0 = I0; P.load = L / 1000; P.vb = vb; P.seg = seg;
        fV.set(V, true); fR.set(R, true); fKv.set(Kv, true); fI0.set(I0, true);
        fL.set(L, true); fVb.set(vb, true); fSeg.set(seg, true);
        params();
      });
      return b;
    }

    /* ---------------- physics ---------------- */
    function Kt() { return 9.5493 / P.Kv; }
    function KvRad() { return P.Kv * TAU / 60; }
    function current(wNow) {
      var drive = P.V - (P.V > 0.05 ? P.vb : 0) - wNow / KvRad();
      return Math.max(0, drive / P.R);
    }
    // commutation quantises the torque angle the same way six-step does, but with `seg` steps per turn
    function ripple(th) {
      var half = Math.PI / P.seg;
      var target = th + Math.PI / 2;
      var k = Math.round((target - half) / (2 * half));
      return Math.sin(IB.clamp((k * 2 * half + half) - th, Math.PI / 2 - half, Math.PI / 2 + half));
    }
    function step(dt) {
      var I = current(w);
      var tqEm = Kt() * I * ripple(thDisp);
      var fr = Kt() * P.I0 + Bvisc * w;
      var net = tqEm - P.load - fr;
      if (w <= 0 && net <= 0) { w = 0; net = 0; }
      w = Math.max(0, w + net / J * dt);
      out.I = I; out.tq = tqEm;
      out.mech = P.load * w; out.fric = fr * w;
      out.cu = I * I * P.R; out.brush = I * (P.V > 0.05 ? P.vb : 0);
      out.pin = P.V * I;
      out.eff = out.pin > 0.01 ? Math.max(0, out.mech / out.pin) : 0;
      out.stalled = w < 1 && I > 0.02;
    }

    /* ---------------- drawing ---------------- */
    var CX = 210, CY = 210, armG, arrowG, sparkA, sparkB, segG = [], brushGlow = [];
    function buildMotor() {
      var g = svg("g", {});
      motor.appendChild(g);
      // field magnets: N left, S right (field points left to right through the middle)
      g.appendChild(svg("path", { d: arcBand(135, 175, 100, 260), fill: "var(--north)", opacity: .82 }));
      g.appendChild(svg("path", { d: arcBand(135, 175, -80, 80), fill: "var(--south)", opacity: .82 }));
      g.appendChild(svg("text", { x: 56, y: 216, "font-size": 19, "font-weight": 700, fill: "var(--panel)",
        "font-family": "Barlow Condensed, sans-serif", "text-anchor": "middle" }, "N"));
      g.appendChild(svg("text", { x: 364, y: 216, "font-size": 19, "font-weight": 700, fill: "var(--panel)",
        "font-family": "Barlow Condensed, sans-serif", "text-anchor": "middle" }, "S"));
      // field lines across the gap
      [-60, -20, 20, 60].forEach(function (dy) {
        g.appendChild(svg("line", { x1: CX - 128, y1: CY + dy, x2: CX + 128, y2: CY + dy,
          stroke: "var(--ink-3)", "stroke-width": 1, "stroke-dasharray": "3 6", opacity: .5 }));
      });
      g.appendChild(svg("circle", { cx: CX, cy: CY, r: 96, fill: "var(--panel-2)",
        stroke: "var(--rule)", "stroke-width": 1.2 }));
      // rotating armature loop
      armG = svg("g", {});
      armG.appendChild(svg("rect", { x: CX - 62, y: CY - 30, width: 124, height: 60, rx: 4,
        fill: "none", stroke: "var(--s1)", "stroke-width": 2.6 }));
      armG.appendChild(svg("circle", { cx: CX - 62, cy: CY, r: 13, fill: "var(--panel)",
        stroke: "var(--s1)", "stroke-width": 2 }));
      armG.appendChild(svg("circle", { cx: CX + 62, cy: CY, r: 13, fill: "var(--panel)",
        stroke: "var(--s1)", "stroke-width": 2 }));
      sparkA = svg("text", { x: CX - 62, y: CY + 6, "text-anchor": "middle", "font-size": 17,
        fill: "var(--s1)" }, "⊗");
      sparkB = svg("text", { x: CX + 62, y: CY + 6, "text-anchor": "middle", "font-size": 17,
        fill: "var(--s1)" }, "⊙");
      armG.appendChild(sparkA); armG.appendChild(sparkB);
      g.appendChild(armG);
      g.appendChild(svg("circle", { cx: CX, cy: CY, r: 12, fill: "var(--panel)", stroke: "var(--rule)", "stroke-width": 1.2 }));
      // torque direction
      arrowG = svg("g", {});
      arrowG.appendChild(svg("path", { d: "M" + (CX - 34) + "," + (CY - 74) + " A44,44 0 0 1 " + (CX + 34) + "," + (CY - 74),
        fill: "none", stroke: "var(--ink)", "stroke-width": 2.2 }));
      arrowG.appendChild(svg("path", { d: "M0,0 L-11,5 L-11,-5 Z", fill: "var(--ink)",
        transform: "translate(" + (CX + 34) + "," + (CY - 74) + ") rotate(48)" }));
      g.appendChild(arrowG);
      g.appendChild(svg("text", { x: CX, y: 404, "text-anchor": "middle", "font-size": 12,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" },
        "force on each conductor: F = B·I·L"));

      buildComm();
    }
    function arcBand(r0, r1, a0, a1) {
      function pt(r, a) { return [CX + r * Math.cos(a * D2R), CY + r * Math.sin(a * D2R)]; }
      var p1 = pt(r0, a0), p2 = pt(r1, a0), p3 = pt(r1, a1), p4 = pt(r0, a1);
      var large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      return "M" + p1 + " L" + p2 + " A" + r1 + "," + r1 + " 0 " + large + " 1 " + p3 +
             " L" + p4 + " A" + r0 + "," + r0 + " 0 " + large + " 0 " + p1 + " Z";
    }
    function buildComm() {
      var g = svg("g", {});
      comm.appendChild(g);
      var cx = 70, cy = 66, r = 38;
      var rot = svg("g", { id: "commrot" });
      var n = 8;                       // drawn segments (visual); count follows the control below
      segG = [];
      for (var i = 0; i < n; i++) {
        var a0 = i * 360 / n + 1.5, a1 = (i + 1) * 360 / n - 1.5;
        var p = svg("path", { d: seg(cx, cy, r * 0.55, r, a0, a1), fill: "var(--copper)", opacity: .55 });
        rot.appendChild(p); segG.push(p);
      }
      g.appendChild(rot);
      comm._rot = rot;
      g.appendChild(svg("circle", { cx: cx, cy: cy, r: r * 0.52, fill: "var(--panel)",
        stroke: "var(--rule)", "stroke-width": 1 }));
      // brushes, fixed, top and bottom
      [[cy - r - 13, 0], [cy + r + 1, 1]].forEach(function (b, i) {
        var rect = svg("rect", { x: cx - 9, y: b[0], width: 18, height: 12, rx: 1.5,
          fill: "var(--ink-3)" });
        g.appendChild(rect);
        var glow = svg("circle", { cx: cx, cy: i === 0 ? cy - r + 2 : cy + r - 2, r: 7,
          fill: "var(--warn)", opacity: 0 });
        g.appendChild(glow); brushGlow.push(glow);
      });
      g.appendChild(svg("text", { x: cx, y: 132, "text-anchor": "middle", "font-size": 11,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, "COMMUTATOR"));
      function seg(cx, cy, r0, r1, a0, a1) {
        function pt(r, a) { return [cx + r * Math.cos(a * D2R), cy + r * Math.sin(a * D2R)]; }
        return "M" + pt(r0, a0) + " L" + pt(r1, a0) + " A" + r1 + "," + r1 + " 0 0 1 " + pt(r1, a1) +
               " L" + pt(r0, a1) + " A" + r0 + "," + r0 + " 0 0 0 " + pt(r0, a0) + " Z";
      }
    }

    function draw() {
      var th = thDisp % TAU, deg = th / D2R;
      armG.setAttribute("transform", "rotate(" + (-deg) + " " + CX + " " + CY + ")");
      comm._rot.setAttribute("transform", "rotate(" + (-deg * P.seg / 8) + " 70 66)");
      var live = out.I > 0.02;
      // current direction flips once per segment pair: conductors swap every half revolution
      var flipped = (Math.floor(th / Math.PI) % 2) === 1;
      sparkA.textContent = flipped ? "⊙" : "⊗";
      sparkB.textContent = flipped ? "⊗" : "⊙";
      sparkA.setAttribute("opacity", live ? 1 : .25);
      sparkB.setAttribute("opacity", live ? 1 : .25);
      arrowG.setAttribute("opacity", live ? IB.clamp(out.tq / Math.max(Kt() * current(0), 1e-9) * 3, .15, 1) : .1);
      // arcing flash at each segment crossing
      var segIdx = Math.floor(th / (TAU / P.seg));
      if (segIdx !== lastSeg) { lastSeg = segIdx; sparkT = 1; }
      sparkT = Math.max(0, sparkT - 0.08);
      var arcAmt = live ? sparkT * IB.clamp(out.I / Math.max(current(0), 1e-6), 0, 1) : 0;
      brushGlow.forEach(function (gl) { gl.setAttribute("opacity", arcAmt * 0.9); });
      segG.forEach(function (s, i) {
        s.setAttribute("opacity", live ? (i % 2 ? .38 : .62) : .3);
      });
    }

    function readouts() {
      var rpm = w * 60 / TAU;
      T.rpm.set(IB.fx(rpm));
      T.amp.set(IB.fx(out.I, out.I < 10 ? 2 : 1));
      T.trq.set(IB.fx(out.tq * 1000, Math.abs(out.tq * 1000) < 100 ? 1 : 0));
      T.pin.set(IB.fx(out.pin, out.pin < 10 ? 1 : 0));
      T.eff.set(IB.fx(out.eff * 100));
      T.heat.set(IB.fx(out.cu + out.brush, (out.cu + out.brush) < 10 ? 1 : 0),
        (out.cu + out.brush) > 0.4 * Math.max(out.pin, 0.01) ? "hot" : "");
      chipState.className = "chip on " + (out.stalled ? "crit" : (w > 1 ? "good" : "idle"));
      chipState.textContent = out.stalled ? "stalled" : (w > 1 ? "running" : "idle");
      var comms = rpm / 60 * P.seg;
      var arc = out.I / Math.max(current(0), 1e-6);
      chipArc.textContent = IB.fx(comms) + " commutations/s · "
        + (arc > 0.6 ? "heavy arcing" : arc > 0.25 ? "moderate arcing" : "light arcing");
      chipArc.className = "chip mono on " + (arc > 0.6 ? "crit" : arc > 0.25 ? "warn" : "good");
    }

    function params() {
      viewHint.textContent = slowMode === "auto"
        ? "Auto slow-motion — the armature is held at a readable pace (currently ×1/"
          + IB.fx(1 / Math.max(slow, 1e-9)) + "); the gauges run in real time."
        : (slow === 1 ? "Real time — a running motor is a blur; slow it down to see the reversal."
          : "Slow-motion view ×1/" + IB.fx(1 / slow) + ".");
      commNote.innerHTML = P.seg + " segments · current<br>reverses " + P.seg + "× per turn";
      fKv.hint("Kt = 9.55 / Kv = " + IB.fx(9.5493 / P.Kv * 1000, 1) + " mN·m per amp. "
        + "Ripple from " + P.seg + " segments is about " + IB.fx((1 - Math.cos(Math.PI / P.seg)) * 100, 1) + " %.");
      redrawCurves();
    }

    /* ---------------- the four curves ---------------- */
    function redrawCurves() {
      var kt = Kt(), vEff = Math.max(0, P.V - (P.V > 0.05 ? P.vb : 0));
      var iStall = vEff / P.R, tqStall = kt * Math.max(0, iStall - P.I0);
      var wNoLoad = Math.max(0, (vEff - P.I0 * P.R) * KvRad());
      var N = 80, i, sp = [], cu = [], po = [], ef = [], bestP = 0, bestPt = 0, bestE = 0, bestEt = 0;
      for (i = 0; i <= N; i++) {
        var tq = tqStall * i / N;                       // shaft torque
        var I = tq / kt + P.I0;
        var ww = Math.max(0, (vEff - I * P.R) * KvRad());
        var pout = tq * ww, pin = P.V * I;
        var eff = pin > 0 ? pout / pin : 0;
        sp.push([tq * 1000, ww * 60 / TAU]);
        cu.push([tq * 1000, I]);
        po.push([tq * 1000, pout]);
        ef.push([tq * 1000, eff * 100]);
        if (pout > bestP) { bestP = pout; bestPt = tq; }
        if (eff > bestE) { bestE = eff; bestEt = tq; }
      }
      var xMax = Math.max(tqStall * 1000, 1);
      var xs = { min: 0, max: xMax, label: "torque (mN·m)", fmt: function (v) { return IB.fx(v, xMax < 20 ? 1 : 0); } };
      var pad = [22, 14, 40, 46], W = 330, H = 190;
      var here = Math.min(P.load * 1000, xMax);
      function dot(y) { return [{ x: here, y: y, color: "var(--ink)" }]; }
      var wNow = w * 60 / TAU;
      IB.chart(cSpeed, { w: W, h: H, pad: pad, x: xs,
        y: { min: 0, max: Math.max(wNoLoad * 60 / TAU * 1.06, 1), label: "rpm", fmt: function (v) { return IB.eng(v, 2); } },
        series: [{ pts: sp, color: "var(--s1)", width: 2 }], dots: dot(wNow) });
      IB.chart(cCur, { w: W, h: H, pad: pad, x: xs,
        y: { min: 0, max: Math.max(iStall * 1.06, 0.1), label: "A", fmt: function (v) { return IB.sigfig(v, 2); } },
        series: [{ pts: cu, color: "var(--s2)", width: 2 }], dots: dot(out.I) });
      IB.chart(cPow, { w: W, h: H, pad: pad, x: xs,
        y: { min: 0, max: Math.max(bestP * 1.12, 0.01), label: "W", fmt: function (v) { return IB.sigfig(v, 2); } },
        series: [{ pts: po, color: "var(--s3)", width: 2 }],
        vlines: [{ x: bestPt * 1000, color: "var(--ink-3)", dash: "4 3", label: "max P" }],
        dots: dot(out.mech) });
      IB.chart(cEff, { w: W, h: H, pad: pad, x: xs,
        y: { min: 0, max: Math.max(bestE * 100 * 1.15, 5), label: "%", fmt: function (v) { return IB.fx(v); } },
        series: [{ pts: ef, color: "var(--copper)", width: 2 }],
        vlines: [{ x: bestEt * 1000, color: "var(--ink-3)", dash: "4 3", label: "peak η" }],
        dots: dot(out.eff * 100) });

      curveHint.textContent = "Every curve here follows from one straight line: speed falls linearly with "
        + "torque, so current rises linearly, power is their product — a parabola peaking at half the "
        + "stall torque (" + IB.fx(bestPt * 1000) + " mN·m, " + IB.sigfig(bestP, 3) + " W) — and "
        + "efficiency peaks much earlier, at " + IB.fx(bestEt * 1000) + " mN·m and "
        + IB.fx(bestE * 100, 1) + " %. Run a brushed motor at max power and you are throwing away half "
        + "your watts as heat.";

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Operating point" }), el("th", { text: "Torque" }), el("th", { text: "Speed" }),
        el("th", { text: "Current" }), el("th", { text: "Shaft power" }), el("th", { text: "Efficiency" })
      ])]));
      var tb = el("tbody", {});
      function row(name, tq) {
        var I = tq / kt + P.I0, ww = Math.max(0, (vEff - I * P.R) * KvRad());
        var pin = P.V * I, pout = tq * ww;
        tb.appendChild(el("tr", { class: Math.abs(tq - P.load) < 1e-9 ? "on" : "" }, [
          el("td", { text: name }),
          el("td", { text: IB.fx(tq * 1000, 1) + " mN·m" }),
          el("td", { text: IB.fx(ww * 60 / TAU) + " rpm" }),
          el("td", { text: IB.sigfig(I, 3) + " A" }),
          el("td", { text: IB.sigfig(pout, 3) + " W" }),
          el("td", { text: pin > 0 ? IB.fx(pout / pin * 100, 1) + " %" : "—" })
        ]));
      }
      row("No load", 0);
      row("Peak efficiency", bestEt);
      row("Your load", Math.min(P.load, tqStall));
      row("Max power", bestPt);
      row("Stall", tqStall);
      tab.appendChild(tb);
    }

    function frame(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      for (var i = 0; i < 4; i++) step(dt / 4);
      var rev = w / TAU;
      slow = (slowMode === "auto") ? (rev > 1e-6 ? Math.min(1, AUTO_HZ / (rev * P.seg / 4)) : 1) : slowMode;
      if (IB.reduce) slow = Math.min(slow, 0.002);
      thDisp = (thDisp + w * dt * slow) % TAU;
      draw(); readouts();
      if (Math.abs(ts % 500) < 20) redrawCurves();
      if (slowMode === "auto" && Math.abs(slow - lastSlow) > lastSlow * 0.3) { lastSlow = slow; params(); }
      raf = requestAnimationFrame(frame);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method, and how this differs from the brushless bench" }),
      el("p", { class: "note", html:
        "A permanent-magnet brushed motor is the same electromechanical machine as the BLDC — same "
        + "<code>e = ω/Kv</code>, same <code>τ = Kt·I</code>, same <code>Kt = 9.55/Kv</code> — "
        + "with the commutation done mechanically instead of by transistors. Current is "
        + "<code>(V − Vbrush − e)/R</code>, and the shaft integrates "
        + "<code>J·dω/dt = τ − τload − Kt·I₀ − Bω</code>. "
        + "Three differences matter in practice. The brush drop is a fixed voltage tax, so a 3 V motor "
        + "loses a third of its supply to carbon before it turns. The commutator quantises the torque "
        + "angle just as six-step does, but with S segments instead of 6 — ripple falls as "
        + "<code>1 − cos(π/S)</code>. And every segment crossing interrupts an inductive current, "
        + "which is the arc that erodes the brushes and throws the EMI a brushless drive does not. "
        + "Not modelled: armature inductance, field weakening at high current, brush bounce, or the way "
        + "resistance and magnet strength both drift with temperature." })
    ]));

    buildMotor();
    params(); step(0.001); draw(); readouts();
    raf = requestAnimationFrame(frame);
    this.unmount = function () { if (raf) cancelAnimationFrame(raf); raf = null; last = 0; };
  }
});
