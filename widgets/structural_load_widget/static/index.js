const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayNumber(value, decimals) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "—";
}

function displayThickness(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

function calculateRow(row, material) {
  if (!row.material_id) return { load: null, error: false };
  if (!material) return { load: null, error: true };
  if (material.calculation_type === "fixed") {
    const load = Number(material.fixed_load_kn_m2);
    return { load, error: !Number.isFinite(load) || load < 0 };
  }
  const thickness = Number(row.thickness_mm);
  const density = Number(material.density_kn_m3);
  const error =
    row.thickness_mm === null ||
    row.thickness_mm === "" ||
    !Number.isFinite(thickness) ||
    thickness < 0 ||
    !Number.isFinite(density) ||
    density < 0;
  return { load: error ? null : (thickness / 1000) * density, error };
}

function acceptedLoad(total, increment) {
  if (!Number.isFinite(total) || !Number.isFinite(increment) || increment <= 0) {
    return null;
  }
  const epsilon = Math.min(increment * 1e-9, 1e-12);
  return Math.ceil((total - epsilon) / increment) * increment;
}

function nextTypeName(tables) {
  const used = new Set();
  for (const table of tables) {
    const match = /^Type J-(\d+)$/i.exec(String(table.type_name || "").trim());
    if (match) used.add(Number(match[1]));
  }
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return `Type J-${candidate}`;
}

function render({ model, el, signal }) {
  el.classList.add("structural-load-widget");
  const pendingEdits = new Map();
  let pendingDeleteTableId = null;
  let requestedFocus = null;
  let applyingLocalState = false;
  let projectRenderPending = false;
  const editableShadowHosts = new Map();

  function composedAncestor(element) {
    if (element.parentElement) return element.parentElement;
    const root = element.getRootNode();
    return root instanceof element.ownerDocument.defaultView.ShadowRoot
      ? root.host
      : null;
  }

  function closestComposed(element, selector) {
    for (let current = element; current; current = composedAncestor(current)) {
      if (current.matches?.(selector)) return current;
    }
    return null;
  }

  function exposeClosedShadowHosts() {
    for (let current = el; current; ) {
      const root = current.getRootNode();
      if (!(root instanceof current.ownerDocument.defaultView.ShadowRoot)) break;
      const host = root.host;
      if (root.mode === "closed" && !editableShadowHosts.has(host)) {
        editableShadowHosts.set(host, host.getAttribute("contenteditable"));
        host.setAttribute("contenteditable", "true");
      }
      current = host;
    }
  }

  function restoreClosedShadowHosts() {
    for (const [host, previous] of editableShadowHosts) {
      if (previous === null) host.removeAttribute("contenteditable");
      else host.setAttribute("contenteditable", previous);
    }
    editableShadowHosts.clear();
  }

  function activeElementInWidget() {
    const active = el.getRootNode().activeElement;
    return active && el.contains(active) ? active : null;
  }

  function focusedField() {
    const active = activeElementInWidget();
    return active?.dataset.field ? active : null;
  }

  const catalogMap = () =>
    new Map((model.get("material_catalog") || []).map((item) => [item.material_id, item]));

  function commit(next) {
    applyingLocalState = true;
    model.set("project_state", next);
    model.save_changes();
    queueMicrotask(() => {
      applyingLocalState = false;
    });
  }

  function update(mutator) {
    const next = clone(model.get("project_state"));
    mutator(next);
    commit(next);
  }

  function editKey(target) {
    return [
      target.dataset.field,
      target.dataset.tableId || "",
      target.dataset.rowId || "",
    ].join(":");
  }

  function applyFieldEdit(target) {
    const tableId = target.dataset.tableId;
    const rowId = target.dataset.rowId;
    const field = target.dataset.field;
    const value = target.value;
    update((next) => {
      const table = next.tables.find((item) => item.table_id === tableId);
      if (!table) return;
      if (field === "title" || field === "type_name") {
        table[field] = value;
      } else if (field === "thickness_mm") {
        const row = table.rows.find((item) => item.row_id === rowId);
        if (row) row.thickness_mm = value === "" ? null : Number(value);
      }
    });
  }

  function scheduleFieldEdit(target) {
    const key = editKey(target);
    const old = pendingEdits.get(key);
    if (old) clearTimeout(old.timer);
    const timer = setTimeout(() => {
      pendingEdits.delete(key);
      applyFieldEdit(target);
    }, 400);
    pendingEdits.set(key, { timer, target });
  }

  function flushField(target) {
    const pending = pendingEdits.get(editKey(target));
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingEdits.delete(editKey(target));
    applyFieldEdit(target);
  }

  function flushAll() {
    const edits = [...pendingEdits.values()];
    pendingEdits.clear();
    for (const pending of edits) {
      clearTimeout(pending.timer);
      applyFieldEdit(pending.target);
    }
  }

  function cancelPending() {
    for (const pending of pendingEdits.values()) clearTimeout(pending.timer);
    pendingEdits.clear();
  }

  function focusDescriptor() {
    const active = el.ownerDocument.activeElement;
    if (!active || !el.contains(active) || !active.dataset.field) return null;
    return {
      selector: `[data-field="${active.dataset.field}"][data-table-id="${active.dataset.tableId || ""}"][data-row-id="${active.dataset.rowId || ""}"]`,
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }

  function restoreFocus(descriptor) {
    const selector = requestedFocus || descriptor?.selector;
    requestedFocus = null;
    if (!selector) return;
    const target = el.querySelector(selector);
    if (!target) return;
    target.focus();
    if (descriptor && typeof target.setSelectionRange === "function") {
      try {
        target.setSelectionRange(descriptor.start, descriptor.end);
      } catch (_) {
        // Numeric inputs do not support text selection in every browser.
      }
    }
  }

  function messagesFor(messages, tableId = null, rowId = null) {
    return messages.filter((message) => {
      if (rowId) return message.row_id === rowId;
      if (tableId) return message.table_id === tableId && !message.row_id;
      return !message.table_id && !message.row_id;
    });
  }

  function messageMarkup(messages) {
    if (!messages.length) return "";
    return `<div class="slw-messages" role="status">${messages
      .map(
        (message) =>
          `<div class="slw-message slw-message--${escapeHtml(message.level)}">${escapeHtml(message.message)}</div>`,
      )
      .join("")}</div>`;
  }

  function materialOptions(catalog, selectedId) {
    const options = ['<option value="">Select a material…</option>'];
    for (const material of catalog) {
      if (!material.active && material.material_id !== selectedId) continue;
      const inactive = material.active ? "" : " (inactive)";
      options.push(
        `<option value="${escapeHtml(material.material_id)}" ${
          material.material_id === selectedId ? "selected" : ""
        }>${escapeHtml(material.display_name + inactive)}</option>`,
      );
    }
    if (selectedId && !catalog.some((item) => item.material_id === selectedId)) {
      options.push(
        `<option value="${escapeHtml(selectedId)}" selected>Missing material: ${escapeHtml(selectedId)}</option>`,
      );
    }
    return options.join("");
  }

  function rowMarkup(row, index, tableId, catalog, materials, decimals, messages) {
    const material = materials.get(row.material_id);
    const result = calculateRow(row, material);
    const calculated = material?.calculation_type === "calculated";
    const rowMessages = messagesFor(messages, tableId, row.row_id);
    const invalid = result.error || rowMessages.some((item) => item.level === "error");
    return `
      <div class="slw-row ${invalid ? "slw-row--invalid" : ""}" role="row" data-row-id="${escapeHtml(row.row_id)}">
        <div class="slw-cell slw-number" role="cell" data-label="No.">${index + 1}</div>
        <div class="slw-cell slw-material" role="cell" data-label="Material">
          <select aria-label="Material for row ${index + 1}" data-action="select-material" data-table-id="${escapeHtml(tableId)}" data-row-id="${escapeHtml(row.row_id)}">
            ${materialOptions(catalog, row.material_id)}
          </select>
        </div>
        <div class="slw-cell slw-thickness" role="cell" data-label="Thickness">
          ${
            calculated
              ? `<div class="slw-unit-field"><input type="number" min="0" step="any" inputmode="decimal" aria-label="Thickness for row ${index + 1} in millimetres" value="${escapeHtml(displayThickness(row.thickness_mm))}" data-field="thickness_mm" data-table-id="${escapeHtml(tableId)}" data-row-id="${escapeHtml(row.row_id)}"><span>mm</span></div>`
              : '<span class="slw-na" aria-label="Not applicable">—</span>'
          }
        </div>
        <div class="slw-cell slw-density" role="cell" data-label="Density γ">
          ${calculated ? `${displayNumber(material.density_kn_m3, decimals)} <span class="slw-unit">kN/m³</span>` : '<span class="slw-na">—</span>'}
        </div>
        <div class="slw-cell slw-load" role="cell" data-label="Load gₖ">
          ${displayNumber(result.load, decimals)} <span class="slw-unit">kN/m²</span>
        </div>
        <div class="slw-cell slw-action" role="cell" data-label="Action">
          <button type="button" class="slw-icon-button slw-delete-row" data-action="delete-row" data-table-id="${escapeHtml(tableId)}" data-row-id="${escapeHtml(row.row_id)}" aria-label="Delete row ${index + 1}" title="Delete row">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>
          </button>
        </div>
        ${rowMessages.length ? `<div class="slw-row-message">${messageMarkup(rowMessages)}</div>` : ""}
      </div>`;
  }

  function tableMarkup(table, catalog, materials, settings, messages) {
    let total = 0;
    let invalid = false;
    for (const row of table.rows) {
      const result = calculateRow(row, materials.get(row.material_id));
      if (result.error) invalid = true;
      if (result.load !== null) total += result.load;
    }
    const tableMessages = messagesFor(messages, table.table_id);
    if (
      messages.some(
        (message) => message.table_id === table.table_id && message.level === "error",
      )
    ) {
      invalid = true;
    }
    const accepted = invalid
      ? null
      : acceptedLoad(total, Number(settings.accepted_load_increment_kn_m2));
    const confirmation = pendingDeleteTableId === table.table_id;
    return `
      <section class="slw-table" data-table-id="${escapeHtml(table.table_id)}" aria-label="${escapeHtml(table.title || "Untitled structure")}">
        <div class="slw-title-row">
          <label><span>Table title</span><input type="text" value="${escapeHtml(table.title)}" data-field="title" data-table-id="${escapeHtml(table.table_id)}"></label>
          <label><span>Type</span><input type="text" value="${escapeHtml(table.type_name)}" data-field="type_name" data-table-id="${escapeHtml(table.table_id)}"></label>
        </div>
        ${messageMarkup(tableMessages)}
        <div class="slw-grid" role="table" aria-label="Material loads">
          <div class="slw-header" role="row">
            <div role="columnheader">No.</div><div role="columnheader">Material</div><div role="columnheader">Thickness</div><div role="columnheader">Density γ</div><div role="columnheader">Load gₖ</div><div role="columnheader">Action</div>
          </div>
          <div class="slw-body" role="rowgroup">
            ${table.rows.map((row, index) => rowMarkup(row, index, table.table_id, catalog, materials, settings.display_decimals, messages)).join("")}
          </div>
          <button type="button" class="slw-add-row" data-action="add-row" data-table-id="${escapeHtml(table.table_id)}">+ Add row</button>
        </div>
        <div class="slw-summary ${invalid ? "slw-summary--invalid" : ""}">
          <div><span>Total characteristic load</span><strong>${invalid ? "—" : displayNumber(total, settings.display_decimals)} <small>kN/m²</small></strong></div>
          <div class="slw-accepted"><span>Accepted design load</span><strong>${displayNumber(accepted, settings.display_decimals)} <small>kN/m²</small></strong></div>
        </div>
        ${
          invalid
            ? '<p class="slw-stale-note">Correct the highlighted errors to calculate totals.</p>'
            : ""
        }
        ${
          confirmation
            ? `<div class="slw-confirm" role="alertdialog" aria-label="Confirm table removal"><span>Remove this table and all its rows?</span><div><button type="button" class="slw-danger" data-action="confirm-remove-table" data-table-id="${escapeHtml(table.table_id)}">Remove</button><button type="button" data-action="cancel-remove-table">Cancel</button></div></div>`
            : `<button type="button" class="slw-remove-table" data-action="remove-table" data-table-id="${escapeHtml(table.table_id)}">Remove table</button>`
        }
      </section>`;
  }

  function statusMarkup() {
    const status = model.get("save_status") || "saved";
    const lastSaved = model.get("last_saved_at");
    const statusLabels = {
      saved: "Saved",
      saving: "Saving…",
      dirty: "Unsaved changes",
      error: "Save failed",
    };
    return `<div class="slw-status slw-status--${escapeHtml(status)}" role="status">
      <span class="slw-status-dot" aria-hidden="true"></span>
      <span>${escapeHtml(statusLabels[status] || status)}</span>
      ${lastSaved ? `<small>Last saved ${escapeHtml(lastSaved)}</small>` : ""}
    </div>`;
  }

  function renderStatus() {
    const status = el.querySelector(".slw-status");
    if (status) status.outerHTML = statusMarkup();
  }

  function requestProjectRender() {
    if (focusedField()) {
      projectRenderPending = true;
      return;
    }
    projectRenderPending = false;
    renderProject();
  }

  function renderProject() {
    projectRenderPending = false;
    const focus = focusDescriptor();
    const state = model.get("project_state") || { tables: [], settings: {} };
    const catalog = model.get("material_catalog") || [];
    const materials = catalogMap();
    const messages = model.get("validation_messages") || [];
    const settings = {
      accepted_load_increment_kn_m2:
        Number(state.settings?.accepted_load_increment_kn_m2) || 0.05,
      display_decimals: Number.isInteger(state.settings?.display_decimals)
        ? state.settings.display_decimals
        : 2,
    };
    const globalMessages = messagesFor(messages);
    el.innerHTML = `
      <div class="slw-root">
        <div class="slw-status-bar">
          ${statusMarkup()}
          <div class="slw-project-actions">
            <button type="button" data-action="reload-materials">Reload materials</button>
            <button type="button" class="slw-primary" data-action="save-now">Save now</button>
          </div>
        </div>
        ${messageMarkup(globalMessages)}
        <div class="slw-tables">
          ${(state.tables || []).map((table) => tableMarkup(table, catalog, materials, settings, messages)).join("")}
          ${state.tables?.length ? "" : '<div class="slw-empty">No structure tables yet.</div>'}
        </div>
        <button type="button" class="slw-add-table" data-action="add-table">+ Add table</button>
      </div>`;
    restoreFocus(focus);
  }

  function tableNeedsConfirmation(table) {
    return (
      table.title !== "Load zone – New structure" ||
      table.rows.some((row) => Boolean(row.material_id))
    );
  }

  function handleClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || !el.contains(button)) return;
    const action = button.dataset.action;
    const tableId = button.dataset.tableId;
    const rowId = button.dataset.rowId;
    if (action === "save-now") {
      flushAll();
      model.set("save_request_id", (model.get("save_request_id") || 0) + 1);
      model.save_changes();
      return;
    }
    if (action === "reload-materials") {
      flushAll();
      model.set(
        "reload_materials_request_id",
        (model.get("reload_materials_request_id") || 0) + 1,
      );
      model.save_changes();
      return;
    }
    if (action === "add-row") {
      const rowIdToFocus = uuid();
      requestedFocus = `[data-action="select-material"][data-row-id="${rowIdToFocus}"]`;
      update((next) => {
        const table = next.tables.find((item) => item.table_id === tableId);
        if (!table) return;
        table.rows.push({
          row_id: rowIdToFocus,
          order: table.rows.length,
          material_id: null,
          thickness_mm: null,
          material_snapshot: null,
        });
      });
      return;
    }
    if (action === "delete-row") {
      update((next) => {
        const table = next.tables.find((item) => item.table_id === tableId);
        if (!table) return;
        const index = table.rows.findIndex((item) => item.row_id === rowId);
        table.rows = table.rows.filter((item) => item.row_id !== rowId);
        table.rows.forEach((row, order) => (row.order = order));
        const nextRow = table.rows[Math.min(index, table.rows.length - 1)];
        requestedFocus = nextRow
          ? `[data-action="select-material"][data-row-id="${nextRow.row_id}"]`
          : `[data-action="add-row"][data-table-id="${tableId}"]`;
      });
      return;
    }
    if (action === "add-table") {
      const tableIdToFocus = uuid();
      requestedFocus = `[data-field="title"][data-table-id="${tableIdToFocus}"]`;
      update((next) => {
        next.tables.push({
          table_id: tableIdToFocus,
          order: next.tables.length,
          title: "Load zone – New structure",
          type_name: nextTypeName(next.tables),
          rows: [
            {
              row_id: uuid(),
              order: 0,
              material_id: null,
              thickness_mm: null,
              material_snapshot: null,
            },
          ],
        });
      });
      return;
    }
    if (action === "remove-table") {
      const table = (model.get("project_state").tables || []).find(
        (item) => item.table_id === tableId,
      );
      if (table && tableNeedsConfirmation(table)) {
        pendingDeleteTableId = tableId;
        renderProject();
        el.querySelector('[data-action="confirm-remove-table"]')?.focus();
      } else {
        update((next) => {
          next.tables = next.tables.filter((item) => item.table_id !== tableId);
          next.tables.forEach((item, order) => (item.order = order));
        });
      }
      return;
    }
    if (action === "confirm-remove-table") {
      pendingDeleteTableId = null;
      update((next) => {
        next.tables = next.tables.filter((item) => item.table_id !== tableId);
        next.tables.forEach((item, order) => (item.order = order));
      });
      return;
    }
    if (action === "cancel-remove-table") {
      pendingDeleteTableId = null;
      renderProject();
      el.querySelector(`[data-action="remove-table"][data-table-id="${tableId}"]`)?.focus();
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches('[data-action="select-material"]')) {
      const material = catalogMap().get(target.value);
      update((next) => {
        const table = next.tables.find((item) => item.table_id === target.dataset.tableId);
        const row = table?.rows.find((item) => item.row_id === target.dataset.rowId);
        if (!row) return;
        row.material_id = target.value || null;
        row.thickness_mm =
          material?.calculation_type === "calculated"
            ? material.default_thickness_mm
            : null;
        row.material_snapshot = material
          ? {
              display_name: material.display_name,
              calculation_type: material.calculation_type,
              density_kn_m3: material.density_kn_m3,
              fixed_load_kn_m2: material.fixed_load_kn_m2,
            }
          : null;
      });
    } else if (target.dataset.field) {
      flushField(target);
    }
  }

  function handleInput(event) {
    if (event.target.dataset.field) scheduleFieldEdit(event.target);
  }

  function handleFocusin(event) {
    const target = event.target;
    if (!target.matches("input, textarea, select, [contenteditable]")) return;

    // VS Code can recurse through open shadow roots when deciding whether an
    // output input is focused, but a closed root hides its active control.
    // Temporarily make such a host match `:read-write` while this widget owns
    // focus so the notebook host recognizes it as an input boundary.
    exposeClosedShadowHosts();

    // VS Code decides whether notebook keybindings are active in the host
    // process. Its notebook webview sets `notebookOutputInputFocused` from a
    // focusin event observed at the `.output` element. Some widget-manager
    // event boundaries prevent the control's original focusin event from
    // reaching that observer, so repeat it from the output boundary after the
    // browser has made the control active. Other notebook frontends generally
    // do not have this wrapper, making this a no-op there.
    queueMicrotask(() => {
      if (!target.matches(":focus")) return;
      const output = closestComposed(el, ".output");
      if (!output) return;
      output.dispatchEvent(
        new FocusEvent("focusin", { bubbles: true, composed: true }),
      );
    });
  }

  function handleFocusout() {
    queueMicrotask(() => {
      if (activeElementInWidget()) return;
      restoreClosedShadowHosts();
      if (projectRenderPending) requestProjectRender();
    });
  }

  function handleKeydown(event) {
    // Notebook frontends also listen for keydown events (for example, VS Code
    // uses "A" to insert a cell above). Keep events from focused controls
    // inside the widget so those shortcuts do not steal focus. This does not
    // prevent the control's native behavior, such as typing or tabbing.
    event.stopPropagation();

    if (event.key === "Enter" && event.target.dataset.field) {
      event.preventDefault();
      flushField(event.target);
      event.target.blur();
    }
  }

  const modelChanged = () => {
    if (!applyingLocalState && !focusedField()) cancelPending();
    requestProjectRender();
  };
  const validationChanged = () => requestProjectRender();
  const statusChanged = () => renderStatus();

  el.addEventListener("click", handleClick, { signal });
  el.addEventListener("change", handleChange, { signal });
  el.addEventListener("input", handleInput, { signal });
  el.addEventListener("focusin", handleFocusin, { signal });
  el.addEventListener("focusout", handleFocusout, { signal });
  el.addEventListener("keydown", handleKeydown, { signal });
  model.on("change:project_state", modelChanged);
  model.on("change:material_catalog", modelChanged);
  model.on("change:validation_messages", validationChanged);
  model.on("change:save_status", statusChanged);
  model.on("change:last_saved_at", statusChanged);
  renderProject();

  return () => {
    cancelPending();
    restoreClosedShadowHosts();
    model.off("change:project_state", modelChanged);
    model.off("change:material_catalog", modelChanged);
    model.off("change:validation_messages", validationChanged);
    model.off("change:save_status", statusChanged);
    model.off("change:last_saved_at", statusChanged);
  };
}

export default { render };
