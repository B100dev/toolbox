/* Wire gauge, resistance, voltage drop and copper heating. */
IB.register({
  id: "wire",
  name: "Wire Gauge & Drop",
  nav: "Wire",
  tag: "Conductors · losses",
  blurb: "Pick a gauge and a run length and see what the copper actually costs you: resistance, volts "
       + "lost, watts turned into heat, and whether the conductor is anywhere near its sensible limit.",
  eq: "d = 0.127 · 92^((36−n)/39) mm   ·   R = ρL/A   ·   Vdrop = I·R",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { g: 12, len: 3, I: 20, V: 12, mat: "cu", temp: 25, both: true, dens: 6 };

    var MAT = {
      cu: { name: "Copper", rho: 1.724e-8, alpha: 0.00393 },
      al: { name: "Aluminium", rho: 2.826e-8, alpha: 0.00403 }
    };
    function dia(g) { return 0.127 * Math.pow(92, (36 - g) / 39); }        // mm
    function area(g) { var d = dia(g); return Math.PI * d * d / 4; }        // mm^2
    function gname(g) { return g < 0 ? (1 - g) + "/0" : String(g); }
    function ohmPerM(g) {
      var m = MAT[P.mat];
      return (m.rho / (area(g) * 1e-6)) * (1 + m.alpha * (P.temp - 20));
    }

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "This run" }));
    var T = IB.tiles(top, [
      { id: "dia", k: "Conductor ø", u: "mm" },
      { id: "area", k: "Area", u: "mm²" },
      { id: "res", k: "Loop R", u: "" },
      { id: "drop", k: "Drop", u: "V" },
      { id: "pct", k: "Of supply", u: "%" },
      { id: "heat", k: "Heat", u: "W" }
    ], 6);
    top.appendChild(el("div", { class: "legend", id: "wireChips" }));
    top.appendChild(el("p", { class: "hint", id: "wireHint" }));

    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", text: "Drop against run length" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 300", role: "img",
      "aria-label": "Percentage voltage drop against run length for three neighbouring gauges" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint",
      text: "Three gauges either side of your choice. Drop is linear in length, so doubling the run "
          + "doubles the loss — and every three gauges thicker roughly halves it." }));

    var tabPanel = el("div", { class: "panel" });
    left.appendChild(tabPanel);
    tabPanel.appendChild(el("span", { class: "eyebrow", text: "Gauge table · at this length, current and temperature" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); tabPanel.appendChild(tw);
    tabPanel.appendChild(el("p", { class: "hint",
      text: "Ampacity here is a current-density rule of thumb, not a code table. For anything in a wall, "
          + "a loom, or a vehicle harness, size to NEC 310.16 or the relevant IEC/ISO table — they "
          + "account for insulation rating, bundling and ambient temperature." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Run" }));

    // gauge picker: slider with a named readout
    var gWrap = el("div", { class: "field" });
    var gVal = el("span", { class: "val mono", style: "font-size:15px" });
    gWrap.appendChild(el("div", { class: "frow" }, [
      el("label", { for: "w-g", text: "Wire gauge" }), gVal]));
    var gIn = el("input", { type: "range", id: "w-g", min: -4, max: 30, step: 1, value: P.g,
      "aria-label": "AWG gauge" });
    gWrap.appendChild(gIn);
    gWrap.appendChild(el("p", { class: "sub", id: "gSub" }));
    rail.appendChild(gWrap);
    gIn.addEventListener("input", function () { P.g = +gIn.value; draw(); });

    var fLen = IB.field(rail, { id: "w-len", label: "One-way length", unit: "m", value: P.len,
      min: 0.05, max: 300, log: true, onInput: function (v) { P.len = v; draw(); } });
    var fI = IB.field(rail, { id: "w-i", label: "Current", unit: "A", value: P.I,
      min: 0.05, max: 400, log: true, onInput: function (v) { P.I = v; draw(); } });
    var fV = IB.field(rail, { id: "w-v", label: "System voltage", unit: "V", value: P.V,
      min: 1, max: 800, log: true, onInput: function (v) { P.V = v; draw(); },
      hint: "Only used to turn the drop into a percentage." });
    IB.segmented(rail, { label: "Path counted", value: "both",
      options: [{ label: "Out and back", value: "both" }, { label: "One conductor", value: "one" }],
      onInput: function (v) { P.both = v === "both"; draw(); },
      hint: "Current has to return. Unless the chassis is the return path, count both legs." });
    IB.select(rail, { id: "w-mat", label: "Conductor", value: P.mat,
      options: [{ value: "cu", label: "Copper" }, { value: "al", label: "Aluminium" }],
      onInput: function (v) { P.mat = v; draw(); } });
    var fTemp = IB.field(rail, { id: "w-t", label: "Conductor temperature", unit: "°C", value: P.temp,
      min: -40, max: 150, step: 1, onInput: function (v) { P.temp = v; draw(); },
      hint: "Copper gains about 0.39 % resistance per °C, so a hot loom is a worse loom." });
    IB.select(rail, { id: "w-d", label: "Ampacity rule", value: String(P.dens),
      options: [
        { value: "3", label: "Bundled / in conduit — 3 A/mm²" },
        { value: "6", label: "Chassis wiring, free air — 6 A/mm²" },
        { value: "12", label: "Short burst, free air — 12 A/mm²" }
      ],
      onInput: function (v) { P.dens = +v; draw(); } });

    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Typical jobs" })]),
      el("div", { class: "btnrow" }, [
        preset("Drone ESC lead", { g: 14, len: 0.15, I: 30, V: 22.2, dens: 12 }),
        preset("12 V accessory", { g: 14, len: 4, I: 10, V: 12, dens: 6 }),
        preset("Battery to inverter", { g: 2, len: 1.5, I: 150, V: 12, dens: 6 }),
        preset("Bench supply lead", { g: 18, len: 1, I: 3, V: 5, dens: 6 })
      ])
    ]));
    function preset(label, v) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.g = v.g; P.len = v.len; P.I = v.I; P.V = v.V; P.dens = v.dens;
        gIn.value = v.g; fLen.set(v.len, true); fI.set(v.I, true); fV.set(v.V, true);
        document.getElementById("w-d").value = String(v.dens);
        draw();
      });
      return b;
    }

    function draw() {
      var legs = P.both ? 2 : 1;
      var R = ohmPerM(P.g) * P.len * legs;
      var drop = P.I * R, pct = drop / P.V * 100, heat = P.I * P.I * R;
      var amp = area(P.g) * P.dens;

      gVal.textContent = "AWG " + gname(P.g);
      document.getElementById("gSub").textContent =
        IB.sigfig(dia(P.g), 3) + " mm conductor · " + IB.sigfig(area(P.g), 3) + " mm² · "
        + IB.eng(ohmPerM(P.g) * 1000, 3) + "mΩ per metre at " + IB.fx(P.temp) + " °C";

      T.dia.set(IB.sigfig(dia(P.g), 3));
      T.area.set(IB.sigfig(area(P.g), 3));
      T.res.set(IB.eng(R, 3) + "Ω");
      T.drop.set(IB.sigfig(drop, 3), pct > 3 ? "warnv" : "");
      T.pct.set(IB.fx(pct, 2), pct > 10 ? "hot" : (pct > 3 ? "warnv" : "goodv"));
      T.heat.set(IB.sigfig(heat, 3), heat > amp * 0.5 ? "warnv" : "");

      var chips = document.getElementById("wireChips");
      IB.clear(chips);
      var over = P.I / amp;
      chips.appendChild(el("span", { class: "chip on " + (over > 1 ? "crit" : over > 0.8 ? "warn" : "good"),
        text: over > 1 ? "over the " + P.dens + " A/mm² rule by " + IB.fx((over - 1) * 100) + " %"
          : "within the " + P.dens + " A/mm² rule (" + IB.fx(amp, amp < 10 ? 1 : 0) + " A)" }));
      chips.appendChild(el("span", { class: "chip on " + (pct > 10 ? "crit" : pct > 3 ? "warn" : "good"),
        text: pct > 3 ? IB.fx(pct, 1) + " % drop — above the 3 % guideline" : IB.fx(pct, 1) + " % drop" }));

      document.getElementById("wireHint").textContent =
        "Each " + (P.both ? "leg" : "conductor") + " is " + IB.sigfig(P.len, 3) + " m, so the current sees "
        + IB.sigfig(P.len * legs, 3) + " m of " + MAT[P.mat].name.toLowerCase() + ". Going three gauges "
        + "thicker (AWG " + gname(P.g - 3) + ") would cut the drop to " + IB.sigfig(P.I * ohmPerM(P.g - 3)
        * P.len * legs / P.V * 100, 2) + " % and the heat to " + IB.sigfig(P.I * P.I * ohmPerM(P.g - 3)
        * P.len * legs, 2) + " W.";

      // drop vs length, three gauges
      var maxLen = Math.max(P.len * 3, 1), gs = [P.g - 3, P.g, P.g + 3], series = [], legend = [];
      var colors = ["var(--s3)", "var(--s1)", "var(--s2)"];
      gs.forEach(function (g, i) {
        if (g < -4 || g > 30) return;
        var pts = [], k;
        for (k = 0; k <= 60; k++) {
          var L = maxLen * k / 60;
          pts.push([L, P.I * ohmPerM(g) * L * legs / P.V * 100]);
        }
        series.push({ pts: pts, color: colors[i], width: g === P.g ? 2.4 : 1.7,
          dash: g === P.g ? null : "5 4" });
        legend.push({ color: colors[i], label: "AWG " + gname(g), dash: g === P.g ? null : "5 4" });
      });
      var yMax = Math.max(6, pct * 2.2);
      IB.chart(cv, {
        w: 660, h: 300, pad: [24, 22, 46, 54],
        x: { min: 0, max: maxLen, label: "one-way run  (m)", fmt: function (v) { return IB.sigfig(v, 3); } },
        y: { min: 0, max: yMax, label: "drop  (% of supply)", fmt: function (v) { return IB.fx(v, v < 10 ? 1 : 0); } },
        series: series,
        hlines: [{ y: 3, color: "var(--warn)", dash: "5 4", label: "3 % guideline" }],
        dots: [{ x: P.len, y: Math.min(pct, yMax), color: "var(--ink)" }],
        legend: legend
      });

      // table
      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "AWG" }), el("th", { text: "ø mm" }), el("th", { text: "mm²" }),
        el("th", { text: "mΩ/m" }), el("th", { text: "Loop R" }), el("th", { text: "Drop" }),
        el("th", { text: "Heat" }), el("th", { text: "Rule limit" })
      ])]));
      var tb = el("tbody", {}), i2;
      for (i2 = P.g - 4; i2 <= P.g + 4; i2++) {
        if (i2 < -4 || i2 > 30) continue;
        var rr = ohmPerM(i2) * P.len * legs;
        tb.appendChild(el("tr", { class: i2 === P.g ? "on" : "" }, [
          el("td", { text: gname(i2) }),
          el("td", { text: IB.sigfig(dia(i2), 3) }),
          el("td", { text: IB.sigfig(area(i2), 3) }),
          el("td", { text: IB.sigfig(ohmPerM(i2) * 1000, 3) }),
          el("td", { text: IB.eng(rr, 3) + "Ω" }),
          el("td", { text: IB.sigfig(P.I * rr, 3) + " V" }),
          el("td", { text: IB.sigfig(P.I * P.I * rr, 3) + " W" }),
          el("td", { text: IB.fx(area(i2) * P.dens, area(i2) * P.dens < 10 ? 1 : 0) + " A" })
        ]));
      }
      tab.appendChild(tb);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "AWG is a geometric series: <code>d = 0.127 · 92^((36−n)/39)</code> mm, with 0000 through 0 "
        + "treated as n = −3 … 0. Resistance is <code>ρL/A</code> with ρ = 1.724×10⁻⁸ "
        + "Ω·m for copper and 2.826×10⁻⁸ for aluminium at 20 °C, scaled by "
        + "<code>1 + α(T−20)</code>. Voltage drop is <code>I·R</code> over the whole loop and the "
        + "heat is <code>I²R</code>, all of it dumped into the insulation. "
        + "<strong>What this does not cover:</strong> stranding (a stranded conductor of the same AWG has "
        + "slightly more resistance than solid), skin effect above a few kHz, insulation temperature "
        + "rating, bundling derates, connector and crimp resistance — often the real culprit — and "
        + "fusing. The ampacity figure is a density rule of thumb for orientation only; code tables exist "
        + "because the real answer depends on the install." })
    ]));

    draw();
  }
});
