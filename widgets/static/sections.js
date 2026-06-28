function icon(name, size = 24) {
  const icons = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    folder:
      '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h1"/>',
    settings:
      '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1h.1a2 2 0 1 1 0 4H20a1.7 1.7 0 0 0-.6 1z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1.1-1.6 1.6-2.3 2.4-.4.4-.6.9-.6 1.6"/><path d="M12 17h.01"/>',
    cube: '<path d="m21 16-9 5-9-5V8l9-5 9 5z"/><path d="M3.3 7.7 12 12l8.7-4.3M12 22V12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    shield:
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5M8 11h6"/>',
    zoomIn:
      '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5M8 11h6M11 8v6"/>',
    expand:
      '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5M3 3l6 6M21 3l-6 6M21 21l-6-6M3 21l6-6"/>',
    rotate:
      '<path d="M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.7-2.7"/><path d="M3 12a9 9 0 0 1 15.7-6"/><path d="M18 2v4h-4M6 22v-4h4"/>',
    ruler:
      '<path d="M3 17 17 3l4 4L7 21z"/><path d="m14 6 2 2M11 9l2 2M8 12l2 2M5 15l2 2"/>',
    panel:
      '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 3v18M4 8h5M4 13h5M4 18h5"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

function titleCase(value) {
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
    : "";
}

function tableRows(profile) {
  const isHollow = profile.shape === "SHS" || profile.shape === "RHS";
  const isAngle = profile.shape === "L";
  const dimRows = [
    ["Overall depth", "h", profile.h],
    [isAngle ? "Leg width" : "Flange width", "b", profile.b],
    [
      isHollow || isAngle ? "Wall thickness" : "Web thickness",
      isHollow || isAngle ? "t" : "tw",
      isHollow || isAngle ? profile.t : profile.tw,
    ],
    ["Flange thickness", "tf", profile.tf],
    [isHollow ? "Outer radius" : "Fillet radius", isHollow ? "ro" : "r", profile.r || profile.ro],
    ["Mass per metre", "m", profile.weight, "kg/m"],
  ];

  return dimRows
    .filter((row) => row[2] !== null && row[2] !== undefined)
    .map(
      (row) =>
        `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${fmt(row[2])}</td><td>${row[3] || "mm"}</td></tr>`,
    )
    .join("");
}

function createDrawing(profile) {
  if (profile.shape === "SHS" || profile.shape === "RHS") {
    return createShsDrawing(profile);
  }
  if (profile.shape === "L") {
    return createLDrawing(profile);
  }
  return createIDrawing(profile);
}

function createIDrawing(profile) {
  const h = profile.h || 220;
  const b = profile.b || 220;
  const tw = profile.tw || 6;
  const tf = profile.tf || 10;
  const r = profile.r || 12;
  const scale = Math.min(430 / b, 390 / h);
  const W = b * scale;
  const H = h * scale;
  const web = Math.max(tw * scale, 9);
  const flange = Math.max(tf * scale, 16);
  const halfClear = Math.max((W - web) / 2, 1);
  const webClear = Math.max((H - flange * 2) / 2, 1);
  const radiusLimit = Math.max(7, Math.min(halfClear * 0.75, webClear * 0.75));
  const radius = Math.min(Math.max(r * scale, 7), radiusLimit);
  const cx = 500;
  const x = cx - W / 2;
  const y = 132;
  const webX = cx - web / 2;
  const bottomY = y + H - flange;
  const webL = webX;
  const webR = webX + web;

  return `
    <svg class="spc-drawing" viewBox="0 0 1000 650" role="img" aria-label="${profile.profile} cross-section">
      <defs>
        <marker id="spc-arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#111"/>
        </marker>
        <marker id="spc-green" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#63bf27"/>
        </marker>
        <marker id="spc-red" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#f00"/>
        </marker>
      </defs>
      <text x="500" y="48" text-anchor="middle" font-size="24" font-weight="700" fill="#0f172a">${profile.profile} Cross-Section</text>
      <path d="
        M ${x} ${y}
        H ${x + W}
        V ${y + flange}
        H ${webR + radius}
        Q ${webR} ${y + flange} ${webR} ${y + flange + radius}
        V ${bottomY - radius}
        Q ${webR} ${bottomY} ${webR + radius} ${bottomY}
        H ${x + W}
        V ${bottomY + flange}
        H ${x}
        V ${bottomY}
        H ${webL - radius}
        Q ${webL} ${bottomY} ${webL} ${bottomY - radius}
        V ${y + flange + radius}
        Q ${webL} ${y + flange} ${webL - radius} ${y + flange}
        H ${x}
        Z" fill="#fff" stroke="#000" stroke-width="3"/>

      ${dimensionLine(x, y - 36, x + W, y - 36, `b = ${fmt(b)}`, "top")}
      ${dimensionLine(x, bottomY + flange + 36, x + W, bottomY + flange + 36, `b = ${fmt(b)}`, "bottom")}
      ${dimensionLine(x - 62, y, x - 62, bottomY + flange, `h = ${fmt(h)}`, "left")}
      ${webThicknessDimension(webL, webR, y + H / 2, `tw = ${fmt(tw)}`)}
      ${flangeThicknessDimension(x + W + 56, y, y + flange, `tf = ${fmt(tf)}`)}
      ${radiusDimension(webR, bottomY, radius, `r = ${fmt(r)}`)}
      <path d="M ${x} ${y - 50} V ${y + 10} M ${x + W} ${y - 50} V ${y + 10} M ${x} ${bottomY + flange - 8} V ${bottomY + flange + 50} M ${x + W} ${bottomY + flange - 8} V ${bottomY + flange + 50}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      <path d="M ${x - 84} ${y} H ${x - 18} M ${x - 84} ${bottomY + flange} H ${x - 18} M ${x + W + 18} ${y} H ${x + W + 76} M ${x + W + 18} ${y + flange} H ${x + W + 76}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      ${axisGizmo()}
    </svg>
  `;
}

function createShsDrawing(profile) {
  const h = profile.h || 80;
  const b = profile.b || h;
  const t = profile.t || 4;
  const ro = profile.ro || t * 1.5;
  const scale = Math.min(390 / b, 390 / h);
  const W = b * scale;
  const H = h * scale;
  const wall = Math.max(t * scale, 16);
  const x = 500 - W / 2;
  const y = 135;
  const radius = Math.max(ro * scale, 16);
  const innerRadius = radius * 0.5;

  return `
    <svg class="spc-drawing" viewBox="0 0 1000 650" role="img" aria-label="${profile.profile} cross-section">
      <defs>
        <marker id="spc-arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#111"/>
        </marker>
        <marker id="spc-green" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#63bf27"/>
        </marker>
        <marker id="spc-red" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#f00"/>
        </marker>
      </defs>
      <text x="500" y="36" text-anchor="middle" font-size="24" font-weight="700" fill="#0f172a">${profile.profile} Cross-Section</text>
      <path fill-rule="evenodd" fill="#fff" stroke="#000" stroke-width="3" d="
        M ${x + radius} ${y} H ${x + W - radius} Q ${x + W} ${y} ${x + W} ${y + radius}
        V ${y + H - radius} Q ${x + W} ${y + H} ${x + W - radius} ${y + H}
        H ${x + radius} Q ${x} ${y + H} ${x} ${y + H - radius}
        V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z
        M ${x + wall + innerRadius} ${y + wall} H ${x + W - wall - innerRadius} Q ${x + W - wall} ${y + wall} ${x + W - wall} ${y + wall + innerRadius}
        V ${y + H - wall - innerRadius} Q ${x + W - wall} ${y + H - wall} ${x + W - wall - innerRadius} ${y + H - wall}
        H ${x + wall + innerRadius} Q ${x + wall} ${y + H - wall} ${x + wall} ${y + H - wall - innerRadius}
        V ${y + wall + innerRadius} Q ${x + wall} ${y + wall} ${x + wall + innerRadius} ${y + wall} Z"/>
      ${dimensionLine(x, y - 52, x + W, y - 52, `b = ${fmt(b)}`, "top")}
      ${dimensionLine(x - 58, y, x - 58, y + H, `h = ${fmt(h)}`, "left")}
      ${shsThicknessDimension(x + W + 56, y + H - wall, y + H, `t = ${fmt(t)}`)}
      ${shsRadiusDimension(x + W, y, radius, `ro = ${fmt(ro)}`)}
      <path d="M ${x} ${y - 65} V ${y + 12} M ${x + W} ${y - 65} V ${y + 12}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      <path d="M ${x - 78} ${y} H ${x - 16} M ${x - 78} ${y + H} H ${x - 16}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      ${axisGizmo()}
    </svg>
  `;
}

function createLDrawing(profile) {
  const h = profile.h || 100;
  const b = profile.b || h;
  const t = profile.t || 10;
  const r = profile.r || t;
  const scale = Math.min(390 / b, 390 / h);
  const W = b * scale;
  const H = h * scale;
  const leg = Math.max(t * scale, 16);
  const radius = Math.min(Math.max(r * scale, 8), leg * 0.85);
  const x = 500 - W / 2;
  const y = 135;

  return `
    <svg class="spc-drawing" viewBox="0 0 1000 650" role="img" aria-label="${profile.profile} cross-section">
      <defs>
        <marker id="spc-arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#111"/>
        </marker>
        <marker id="spc-green" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#63bf27"/>
        </marker>
        <marker id="spc-red" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" fill="#f00"/>
        </marker>
      </defs>
      <text x="500" y="36" text-anchor="middle" font-size="24" font-weight="700" fill="#0f172a">${profile.profile} Cross-Section</text>
      <path d="
        M ${x} ${y}
        H ${x + leg}
        V ${y + H - leg - radius}
        Q ${x + leg} ${y + H - leg} ${x + leg + radius} ${y + H - leg}
        H ${x + W}
        V ${y + H}
        H ${x}
        Z" fill="#fff" stroke="#000" stroke-width="3"/>
      ${dimensionLine(x, y - 52, x + W, y - 52, `b = ${fmt(b)}`, "top")}
      ${dimensionLine(x - 58, y, x - 58, y + H, `h = ${fmt(h)}`, "left")}
      ${shsThicknessDimension(x + W + 56, y + H - leg, y + H, `t = ${fmt(t)}`)}
      ${radiusDimension(x + leg, y + H - leg, radius, `r = ${fmt(r)}`)}
      <path d="M ${x} ${y - 65} V ${y + 12} M ${x + W} ${y - 65} V ${y + 12}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      <path d="M ${x - 78} ${y} H ${x - 16} M ${x - 78} ${y + H} H ${x - 16}" stroke="#111" stroke-width="1.4" stroke-dasharray="9 7"/>
      ${axisGizmo()}
    </svg>
  `;
}

function dimensionLine(x1, y1, x2, y2, label, placement) {
  const isVertical = x1 === x2;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const textAttrs = isVertical
    ? `x="${x1 - 10}" y="${midY + 6}" text-anchor="end"`
    : `x="${midX}" y="${placement === "bottom" ? y1 + 24 : y1 - 8}" text-anchor="middle"`;
  const extraText =
    placement === "right"
      ? `x="${x1 + 16}" y="${midY + 6}" text-anchor="start"`
      : textAttrs;

  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1.7" marker-start="url(#spc-arrow)" marker-end="url(#spc-arrow)"/>
    <text ${placement === "right" || placement === "mid" ? `x="${x2 + 14}" y="${midY + 6}" text-anchor="start"` : extraText} font-size="18" font-style="italic">${label}</text>
  `;
}

function webThicknessDimension(webL, webR, y, label) {
  return `
    <line x1="${webL}" y1="${y - 34}" x2="${webL}" y2="${y + 34}" stroke="#111" stroke-width="1.3"/>
    <line x1="${webR}" y1="${y - 34}" x2="${webR}" y2="${y + 34}" stroke="#111" stroke-width="1.3"/>
    <line x1="${webL - 58}" y1="${y}" x2="${webL}" y2="${y}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <line x1="${webR + 58}" y1="${y}" x2="${webR}" y2="${y}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <text x="${webR + 70}" y="${y + 6}" text-anchor="start" font-size="18" font-style="italic">${label}</text>
  `;
}

function flangeThicknessDimension(x, yTop, yBottom, label) {
  return `
    <line x1="${x - 34}" y1="${yTop}" x2="${x + 34}" y2="${yTop}" stroke="#111" stroke-width="1.3" stroke-dasharray="9 7"/>
    <line x1="${x - 34}" y1="${yBottom}" x2="${x + 34}" y2="${yBottom}" stroke="#111" stroke-width="1.3" stroke-dasharray="9 7"/>
    <line x1="${x}" y1="${yTop - 34}" x2="${x}" y2="${yTop}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <line x1="${x}" y1="${yBottom + 34}" x2="${x}" y2="${yBottom}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <text x="${x + 48}" y="${(yTop + yBottom) / 2 + 6}" text-anchor="start" font-size="18" font-style="italic">${label}</text>
  `;
}

function radiusDimension(webR, bottomY, radius, label) {
  const tipX = webR + radius * 0.28;
  const tipY = bottomY - radius * 0.28;
  const tailX = tipX + 54;
  const tailY = tipY - 62;

  return `
    <path d="M ${tailX} ${tailY} L ${tipX} ${tipY}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <text x="${tailX + 8}" y="${tailY - 5}" font-size="18" font-style="italic">${label}</text>
  `;
}

function shsThicknessDimension(x, yInner, yOuter, label) {
  return `
    <line x1="${x - 34}" y1="${yInner}" x2="${x + 34}" y2="${yInner}" stroke="#111" stroke-width="1.3" stroke-dasharray="9 7"/>
    <line x1="${x - 34}" y1="${yOuter}" x2="${x + 34}" y2="${yOuter}" stroke="#111" stroke-width="1.3" stroke-dasharray="9 7"/>
    <line x1="${x}" y1="${yInner - 34}" x2="${x}" y2="${yInner}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <line x1="${x}" y1="${yOuter + 34}" x2="${x}" y2="${yOuter}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <text x="${x + 48}" y="${(yInner + yOuter) / 2 + 6}" text-anchor="start" font-size="18" font-style="italic">${label}</text>
  `;
}

function shsRadiusDimension(outerRight, outerTop, radius, label) {
  const arcOffset = radius * (1 - Math.SQRT1_2);
  const tipX = outerRight - arcOffset;
  const tipY = outerTop + arcOffset;
  const tailX = outerRight + 64;
  const tailY = outerTop - 28;

  return `
    <path d="M ${tailX} ${tailY} L ${tipX} ${tipY}" stroke="#111" stroke-width="1.7" marker-end="url(#spc-arrow)"/>
    <text x="${tailX + 10}" y="${tailY - 6}" font-size="18" font-style="italic">${label}</text>
  `;
}

function axisGizmo() {
  return `
    <g transform="translate(82 560)">
      <line x1="0" y1="0" x2="0" y2="-54" stroke="#63bf27" stroke-width="2.2" marker-end="url(#spc-green)"/>
      <line x1="0" y1="0" x2="58" y2="0" stroke="#f00" stroke-width="2.2" marker-end="url(#spc-red)"/>
      <circle cx="0" cy="0" r="9" fill="#fff" stroke="#0647ff" stroke-width="2.2"/>
      <circle cx="0" cy="0" r="4" fill="#0647ff"/>
      <text x="-6" y="-64" font-size="16">Y</text>
      <text x="68" y="6" font-size="16">X</text>
      <text x="-6" y="28" font-size="16">Z</text>
    </g>
  `;
}

function render({ model, el }) {
  const state = {
    selectedType: model.get("selected_type") || "HEA",
    selectedProfile: model.get("selected_profile") || "HEA220",
  };
  const profiles = model.get("profiles") || [];
  const types = [...new Set(profiles.map((profile) => profile.type))].filter(
    Boolean,
  );

  el.innerHTML = "";
  const root = document.createElement("div");
  root.className = "spc-widget";
  el.append(root);

  function byType() {
    return profiles.filter((profile) => profile.type === state.selectedType);
  }

  function selected() {
    return (
      profiles.find((profile) => profile.profile === state.selectedProfile) ||
      byType()[0] ||
      profiles[0]
    );
  }

  function syncSelection() {
    const options = byType();
    if (!options.some((profile) => profile.profile === state.selectedProfile)) {
      state.selectedProfile = options[0]?.profile || "";
    }
    model.set("selected_type", state.selectedType);
    model.set("selected_profile", state.selectedProfile);
    model.set("selected_profile_data", selected() || {});
    model.save_changes();
  }

  function paint() {
    const profile = selected();
    if (!profile) {
      root.innerHTML = "<div class='spc-card'>No profile data found.</div>";
      return;
    }
    const profileOptions = byType()
      .map(
        (item) =>
          `<option value="${item.profile}" ${item.profile === state.selectedProfile ? "selected" : ""}>${item.profile}</option>`,
      )
      .join("");

    root.innerHTML = `
      <div class="spc-stage">
        <aside class="spc-sidebar">
          <section class="spc-card">
            <h3>Profile Selection</h3>
            <div class="spc-field">
              <label for="spc-type">Profile Type</label>
              <select class="spc-select" id="spc-type">
                ${types.map((type) => `<option value="${type}" ${type === state.selectedType ? "selected" : ""}>${type}</option>`).join("")}
              </select>
            </div>
            <div class="spc-field">
              <label for="spc-profile">Profile</label>
              <select class="spc-select" id="spc-profile">${profileOptions}</select>
            </div>
          </section>
          <section class="spc-card">
            <h3>Default Dimensions</h3>
            <table class="spc-table">
              <thead><tr><th>Parameter</th><th>Symbol</th><th>Value</th><th>Unit</th></tr></thead>
              <tbody>${tableRows(profile)}</tbody>
            </table>
          </section>
        </aside>
        <main class="spc-workspace">
          <div class="spc-canvas-wrap">${createDrawing(profile)}</div>
        </main>
      </div>
    `;

    root.querySelector("#spc-type").addEventListener("change", (event) => {
      state.selectedType = event.target.value;
      syncSelection();
      paint();
    });
    root.querySelector("#spc-profile").addEventListener("change", (event) => {
      state.selectedProfile = event.target.value;
      syncSelection();
      paint();
    });
  }

  paint();

  model.on("change:selected_type", () => {
    state.selectedType = model.get("selected_type");
    paint();
  });
  model.on("change:selected_profile", () => {
    state.selectedProfile = model.get("selected_profile");
    paint();
  });
}

export default { render };
