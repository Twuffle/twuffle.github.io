/* ============================================================
   The Wenching Hour — Dialogue Editor
   ============================================================ */

// ─── Data Model ───
let gameData = {
  config: { days: 3, npcs_per_day: 5 },
  npcs: {},
  schedule: []
};

let activePanel = "welcome";
let activeNpc = null;
let activeVariantIndex = 0;

// ─── DOM refs ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const sidebar = $("#sidebar");
const mainPanel = $("#mainPanel");
const npcSidebarList = $("#npcSidebarList");
const fileInput = $("#fileInput");
const toastEl = $("#toast");

// ─── Bootstrap ───
document.addEventListener("DOMContentLoaded", () => {
  bindHeaderButtons();
  bindSidebarNav();
});

// ─── Toast ───
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2000);
}

// ─── Header Buttons ───
function bindHeaderButtons() {
  $("#btnImport").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileImport);
  $("#btnLoadDefault").addEventListener("click", loadDefaultFile);
  $("#btnExport").addEventListener("click", exportJson);
}

async function loadDefaultFile() {
  try {
    const resp = await fetch("../dialogue.json");
    if (!resp.ok) throw new Error("Not found");
    gameData = await resp.json();
    onDataLoaded();
    toast("Loaded dialogue.json");
  } catch (e) {
    toast("Could not load ../dialogue.json — " + e.message);
  }
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      gameData = JSON.parse(ev.target.result);
      onDataLoaded();
      toast("Imported " + file.name);
    } catch (err) {
      toast("Invalid JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  fileInput.value = "";
}

function exportJson() {
  const blob = new Blob([JSON.stringify(gameData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dialogue.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported dialogue.json");
}

function onDataLoaded() {
  if (!gameData.config) gameData.config = { days: 3, npcs_per_day: 5 };
  if (!gameData.npcs) gameData.npcs = {};
  if (!gameData.schedule) gameData.schedule = [];
  refreshSidebar();
  showPanel("config");
}

// ─── Sidebar ───
function bindSidebarNav() {
  sidebar.addEventListener("click", (e) => {
    const item = e.target.closest(".sidebar-item");
    if (item && item.dataset.panel) {
      showPanel(item.dataset.panel, item.dataset.npc || null);
    }
  });
  $("#addNpcBtn").addEventListener("click", addNpc);
}

function refreshSidebar() {
  npcSidebarList.innerHTML = "";
  for (const name of Object.keys(gameData.npcs)) {
    const div = document.createElement("div");
    div.className = "sidebar-item";
    div.dataset.panel = "npc";
    div.dataset.npc = name;
    div.innerHTML = `<span class="icon">👤</span> ${name}`;
    npcSidebarList.appendChild(div);
  }
  highlightSidebar();
}

function highlightSidebar() {
  $$(".sidebar-item").forEach((el) => {
    el.classList.toggle("active",
      el.dataset.panel === activePanel &&
      (el.dataset.npc || null) === activeNpc
    );
  });
}

function addNpc() {
  let name = prompt("NPC name (Title Case):");
  if (!name || !name.trim()) return;
  name = name.trim();
  if (gameData.npcs[name]) { toast("NPC already exists"); return; }
  gameData.npcs[name] = {
    desc: "",
    visual: { portrait: "images/default.png", color: "#6b8e23" },
    choices: {
      A: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
      B: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
      C: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
      D: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } }
    }
  };
  refreshSidebar();
  showPanel("npc", name);
  toast("Added " + name);
}

// ─── Panel Router ───
function showPanel(panel, npcName) {
  activePanel = panel;
  activeNpc = npcName || null;
  activeVariantIndex = 0;
  highlightSidebar();

  switch (panel) {
    case "config": renderConfigPanel(); break;
    case "schedule": renderSchedulePanel(); break;
    case "npc": renderNpcPanel(npcName); break;
    default: mainPanel.innerHTML = `<div class="empty-state">Select something from the sidebar.</div>`;
  }
}

// ─── Config Panel ───
function renderConfigPanel() {
  const c = gameData.config;
  mainPanel.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Game Config</h2></div>
      <div class="form-row">
        <div class="form-group small">
          <label>Days</label>
          <input type="number" id="cfgDays" value="${c.days}" min="1">
        </div>
        <div class="form-group small">
          <label>NPCs/Day</label>
          <input type="number" id="cfgNpd" value="${c.npcs_per_day}" min="1">
        </div>
      </div>
    </div>`;
  $("#cfgDays").addEventListener("change", (e) => { gameData.config.days = parseInt(e.target.value) || 1; });
  $("#cfgNpd").addEventListener("change", (e) => { gameData.config.npcs_per_day = parseInt(e.target.value) || 1; });
}

// ─── Schedule Panel ───
function renderSchedulePanel() {
  const days = gameData.config.days;
  const npd = gameData.config.npcs_per_day;
  const npcNames = Object.keys(gameData.npcs);

  // Ensure schedule array length matches days
  while (gameData.schedule.length < days) gameData.schedule.push([]);
  if (gameData.schedule.length > days) gameData.schedule.length = days;

  let html = `<div class="card"><div class="card-header"><h2>Schedule</h2></div>`;

  for (let d = 0; d < days; d++) {
    while (gameData.schedule[d].length < npd) gameData.schedule[d].push(npcNames[0] || "");
    if (gameData.schedule[d].length > npd) gameData.schedule[d].length = npd;

    html += `<div class="schedule-day"><h3>Day ${d + 1}</h3><div class="schedule-slots">`;
    for (let s = 0; s < npd; s++) {
      const val = gameData.schedule[d][s] || "";
      html += `<div class="schedule-slot">
        <span style="color:#888;font-size:0.75rem;">${s + 1}.</span>
        <select data-day="${d}" data-slot="${s}">
          <option value="">-- none --</option>
          ${npcNames.map(n => `<option value="${n}" ${n === val ? "selected" : ""}>${n}</option>`).join("")}
        </select>
      </div>`;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  mainPanel.innerHTML = html;

  mainPanel.querySelectorAll(".schedule-slot select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const d = parseInt(e.target.dataset.day);
      const s = parseInt(e.target.dataset.slot);
      gameData.schedule[d][s] = e.target.value;
    });
  });
}

// ─── NPC Panel ───
function renderNpcPanel(name) {
  const scrollTop = mainPanel.scrollTop;

  if (!name || !gameData.npcs[name]) {
    mainPanel.innerHTML = `<div class="empty-state">NPC not found.</div>`;
    return;
  }

  const npc = gameData.npcs[name];
  const hasVariants = Array.isArray(npc.variants);

  let html = `<div class="card"><div class="card-header">
    <h2>${name}</h2>
    <div class="btn-group">
      <button class="btn btn-small" id="renameNpcBtn">✏️ Rename</button>
      <button class="btn btn-small btn-danger" id="deleteNpcBtn">🗑️ Delete</button>
    </div>
  </div>`;

  if (hasVariants) {
    html += renderVariantTabs(npc);
    html += renderVariantBody(npc, npc.variants[activeVariantIndex], activeVariantIndex, name);
    html += `<div class="mt-12"><button class="btn btn-small btn-success" id="addVariantBtn">+ Add Variant</button>
      <button class="btn btn-small" id="removeVariantsBtn">Convert to Simple NPC</button></div>`;
  } else {
    html += `<div class="mb-8"><button class="btn btn-small" id="convertToVariantsBtn">Convert to Variants</button></div>`;
    html += renderSimpleNpcBody(npc, name);
  }

  html += `</div>`;
  mainPanel.innerHTML = html;

  // Bind NPC-level buttons
  $("#renameNpcBtn").addEventListener("click", () => renameNpc(name));
  $("#deleteNpcBtn").addEventListener("click", () => deleteNpc(name));

  if (hasVariants) {
    $$(".variant-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeVariantIndex = parseInt(tab.dataset.index);
        renderNpcPanel(name);
      });
    });
    const addVBtn = $("#addVariantBtn");
    if (addVBtn) addVBtn.addEventListener("click", () => {
      npc.variants.push({
        desc: "",
        visual: { portrait: "images/default.png", color: "#6b8e23" },
        choices: {
          A: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
          B: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
          C: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
          D: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } }
        }
      });
      activeVariantIndex = npc.variants.length - 1;
      renderNpcPanel(name);
    });
    const rmVBtn = $("#removeVariantsBtn");
    if (rmVBtn) rmVBtn.addEventListener("click", () => {
      const first = npc.variants[0] || {};
      delete npc.variants;
      Object.assign(npc, { desc: first.desc || "", visual: first.visual || {}, choices: first.choices || {} });
      activeVariantIndex = 0;
      renderNpcPanel(name);
    });
  } else {
    const cvBtn = $("#convertToVariantsBtn");
    if (cvBtn) cvBtn.addEventListener("click", () => {
      const variant = { desc: npc.desc, visual: npc.visual, choices: npc.choices };
      delete npc.desc; delete npc.visual; delete npc.choices;
      npc.variants = [variant];
      activeVariantIndex = 0;
      renderNpcPanel(name);
    });
  }

  bindAllEditorInputs(name);
  requestAnimationFrame(() => { mainPanel.scrollTop = scrollTop; });
}

function renameNpc(oldName) {
  let newName = prompt("New name:", oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  newName = newName.trim();
  if (/["'<>]/.test(newName)) { toast("Name contains invalid characters"); return; }
  if (gameData.npcs[newName]) { toast("Name already taken"); return; }

  // Rebuild npcs preserving order
  const newNpcs = {};
  for (const key of Object.keys(gameData.npcs)) {
    if (key === oldName) newNpcs[newName] = gameData.npcs[key];
    else newNpcs[key] = gameData.npcs[key];
  }
  gameData.npcs = newNpcs;

  // Update schedule references
  for (const day of gameData.schedule) {
    for (let i = 0; i < day.length; i++) {
      if (day[i] === oldName) day[i] = newName;
    }
  }

  refreshSidebar();
  showPanel("npc", newName);
  toast("Renamed to " + newName);
}

function deleteNpc(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  delete gameData.npcs[name];
  // Remove from schedule
  for (const day of gameData.schedule) {
    for (let i = day.length - 1; i >= 0; i--) {
      if (day[i] === name) day[i] = "";
    }
  }
  refreshSidebar();
  mainPanel.innerHTML = `<div class="empty-state">NPC deleted.</div>`;
  activePanel = "welcome";
  activeNpc = null;
}

// ─── Variant Tabs ───
function renderVariantTabs(npc) {
  let html = `<div class="variant-tabs">`;
  npc.variants.forEach((v, i) => {
    const label = v.if ? `Variant ${i + 1} (conditional)` : `Variant ${i + 1} (default)`;
    html += `<div class="variant-tab ${i === activeVariantIndex ? "active" : ""}" data-index="${i}">${label}</div>`;
  });
  html += `</div>`;
  return html;
}

// ─── Simple NPC Body (no variants) ───
function renderSimpleNpcBody(npc, npcName) {
  let html = "";
  html += renderVisualFields(npc.visual || {}, "npc");
  html += renderDescField(npc.desc, "npc");
  html += `<h3 class="mt-12 mb-8" style="color:#e94560;">Choices</h3>`;
  html += renderChoices(npc.choices || {}, "npc", npcName);
  return html;
}

// ─── Variant Body ───
function renderVariantBody(npc, variant, vIdx, npcName) {
  if (!variant) return `<div class="empty-state">No variant selected.</div>`;
  const prefix = `var_${vIdx}`;
  let html = "";

  // Condition
  html += `<div class="mb-8"><label>Variant Condition (if)</label>`;
  html += renderConditionBuilder(variant.if || null, prefix + "_if");
  html += `</div>`;

  // Delete variant button
  html += `<button class="btn btn-small btn-danger mb-8" id="deleteVariantBtn">🗑️ Delete This Variant</button>`;

  html += renderVisualFields(variant.visual || {}, prefix);
  html += renderDescField(variant.desc, prefix);
  html += `<h3 class="mt-12 mb-8" style="color:#e94560;">Choices</h3>`;
  html += renderChoices(variant.choices || {}, prefix, npcName);
  return html;
}

// ─── Visual Fields ───
function renderVisualFields(visual, prefix) {
  return `<div class="form-row">
    <div class="form-group">
      <label>Portrait Path</label>
      <input type="text" data-bind="${prefix}.visual.portrait" value="${escAttr(visual.portrait || "")}">
    </div>
    <div class="form-group small">
      <label>Colour</label>
      <input type="color" data-bind="${prefix}.visual.color" value="${visual.color || "#6b8e23"}">
    </div>
  </div>`;
}

// ─── Desc Field (supports variant text arrays) ───
function renderDescField(desc, prefix) {
  const isArray = Array.isArray(desc);
  let html = `<div class="mb-8">
    <div class="toggle-row">
      <label>Description</label>
      <button class="btn btn-small" data-toggle-desc="${prefix}">${isArray ? "Convert to Simple" : "Convert to Conditional"}</button>
    </div>`;

  if (isArray) {
    desc.forEach((entry, i) => {
      html += `<div class="variant-text-entry">`;
      if (entry.if) {
        html += `<div class="mb-8"><label>Condition</label>`;
        html += renderConditionBuilder(entry.if, `${prefix}_desc_${i}_if`);
        html += `</div>`;
      } else {
        html += `<div class="tag mb-8">Default (no condition)</div>`;
      }
      html += `<textarea data-bind="${prefix}.desc[${i}].text">${escHtml(entry.text || "")}</textarea>`;
      html += `<div class="mt-8 btn-group">`;
      if (entry.if || i < desc.length - 1) {
        html += `<button class="btn btn-small" data-add-desc-condition="${prefix}" data-index="${i}">Edit Condition</button>`;
      }
      html += `<button class="btn btn-small btn-danger" data-remove-desc-entry="${prefix}" data-index="${i}">Remove</button>`;
      html += `</div></div>`;
    });
    html += `<button class="btn btn-small btn-success mt-8" data-add-desc-entry="${prefix}">+ Add Desc Entry</button>`;
  } else {
    html += `<textarea data-bind="${prefix}.desc">${escHtml(desc || "")}</textarea>`;
  }

  html += `</div>`;
  return html;
}

// ─── Choices ───
function renderChoices(choices, prefix, npcName) {
  let html = "";
  const keys = Object.keys(choices);

  keys.forEach((key) => {
    const c = choices[key];
    const cPrefix = `${prefix}.choice_${key}`;
    html += `<div class="choice-block">`;
    html += `<div class="choice-header">
      <div class="inline-flex">
        <span class="choice-key-label">${key}</span>
        <input type="text" data-bind="${cPrefix}.key" value="${escAttr(key)}" style="width:50px;" title="Choice key">
      </div>
      <div class="btn-group">
        <button class="btn btn-small btn-danger" data-remove-choice="${prefix}" data-key="${key}">Remove</button>
      </div>
    </div>`;

    // Text (supports variant text)
    const textIsArray = Array.isArray(c.text);
    html += `<div class="form-group mb-8">
      <div class="toggle-row">
        <label>Button Text</label>
        <button class="btn btn-small" data-toggle-choice-text="${cPrefix}">${textIsArray ? "Simple" : "Conditional"}</button>
      </div>`;
    if (textIsArray) {
      c.text.forEach((entry, ti) => {
        html += `<div class="variant-text-entry">`;
        if (entry.if) {
          html += `<label>Condition</label>`;
          html += renderConditionBuilder(entry.if, `${cPrefix}_text_${ti}_if`);
        } else {
          html += `<div class="tag">Default</div>`;
        }
        html += `<input type="text" data-bind="${cPrefix}.text[${ti}].text" value="${escAttr(entry.text || "")}">`;
        html += `<button class="btn btn-small btn-danger mt-8" data-remove-choice-text-entry="${cPrefix}" data-index="${ti}">Remove</button>`;
        html += `</div>`;
      });
      html += `<button class="btn btn-small btn-success mt-8" data-add-choice-text-entry="${cPrefix}">+ Add Text Entry</button>`;
    } else {
      html += `<input type="text" data-bind="${cPrefix}.text" value="${escAttr(c.text || "")}">`;
    }
    html += `</div>`;

    // Choice condition (if)
    html += `<div class="mb-8"><div class="toggle-row"><label>Choice Condition (if)</label>
      <button class="btn btn-small" data-toggle-choice-if="${cPrefix}">${c.if ? "Remove Condition" : "Add Condition"}</button>
    </div>`;
    if (c.if) {
      html += renderConditionBuilder(c.if, `${cPrefix}_if`);
      html += `<div class="toggle-row mt-8"><label>Show Locked</label>
        <input type="checkbox" data-bind="${cPrefix}.showLocked" ${c.showLocked ? "checked" : ""}></div>`;
    }
    html += `</div>`;

    // Effects (supports variant effects)
    const effectsIsArray = Array.isArray(c.effects);
    html += `<div class="mb-8"><div class="toggle-row"><label>Effects</label>
      <button class="btn btn-small" data-toggle-choice-effects="${cPrefix}">${effectsIsArray ? "Simple" : "Conditional"}</button>
    </div>`;
    if (effectsIsArray) {
      c.effects.forEach((eff, ei) => {
        html += `<div class="variant-text-entry">`;
        if (eff.if) {
          html += `<label>Condition</label>`;
          html += renderConditionBuilder(eff.if, `${cPrefix}_eff_${ei}_if`);
        } else {
          html += `<div class="tag">Default</div>`;
        }
        html += renderEffectsGrid(eff, `${cPrefix}.effects[${ei}]`);
        html += `<button class="btn btn-small btn-danger mt-8" data-remove-choice-eff-entry="${cPrefix}" data-index="${ei}">Remove</button>`;
        html += `</div>`;
      });
      html += `<button class="btn btn-small btn-success mt-8" data-add-choice-eff-entry="${cPrefix}">+ Add Effects Entry</button>`;
    } else if (c.effects) {
      html += renderEffectsGrid(c.effects, `${cPrefix}.effects`);
    } else {
      html += `<div class="tag">No effects (branch only)</div>`;
    }
    html += `</div>`;

    // Branch (next)
    html += `<div class="mt-8"><div class="toggle-row"><label>Branch (next)</label>
      <button class="btn btn-small" data-toggle-branch="${cPrefix}">${c.next ? "Remove Branch" : "Add Branch"}</button>
    </div>`;
    if (c.next) {
      html += renderBranch(c.next, `${cPrefix}.next`, 0);
    }
    html += `</div>`;

    html += `</div>`; // close choice-block
  });

  html += `<button class="btn btn-small btn-success mt-8" data-add-choice="${prefix}">+ Add Choice</button>`;
  return html;
}

// ─── Effects Grid ───
function renderEffectsGrid(effects, prefix) {
  const stats = ["royalty", "populace", "kingdom", "power", "suspicion"];
  let html = `<div class="effects-grid">`;
  stats.forEach((s) => { html += `<label>${s.charAt(0).toUpperCase() + s.slice(1, 3)}</label>`; });
  stats.forEach((s) => {
    html += `<input type="number" data-bind="${prefix}.${s}" value="${effects[s] || 0}">`;
  });
  html += `</div>`;
  return html;
}

// ─── Branch Rendering (recursive) ───
function renderBranch(node, prefix, depth) {
  let html = `<div class="branch-block">`;

  // Branch desc
  const descIsArray = Array.isArray(node.desc);
  html += `<div class="mb-8"><div class="toggle-row"><label>NPC Response</label>
    <button class="btn btn-small" data-toggle-branch-desc="${prefix}">${descIsArray ? "Simple" : "Conditional"}</button>
  </div>`;
  if (descIsArray) {
    node.desc.forEach((entry, i) => {
      html += `<div class="variant-text-entry">`;
      if (entry.if) {
        html += `<label>Condition</label>`;
        html += renderConditionBuilder(entry.if, `${prefix}_desc_${i}_if`);
      } else {
        html += `<div class="tag">Default</div>`;
      }
      html += `<textarea data-bind="${prefix}.desc[${i}].text">${escHtml(entry.text || "")}</textarea>`;
      html += `<button class="btn btn-small btn-danger mt-8" data-remove-branch-desc-entry="${prefix}" data-index="${i}">Remove</button>`;
      html += `</div>`;
    });
    html += `<button class="btn btn-small btn-success mt-8" data-add-branch-desc-entry="${prefix}">+ Add Desc Entry</button>`;
  } else {
    html += `<textarea data-bind="${prefix}.desc">${escHtml(node.desc || "")}</textarea>`;
  }
  html += `</div>`;

  // Branch choices
  if (node.choices) {
    const bKeys = Object.keys(node.choices);
    bKeys.forEach((key) => {
      const bc = node.choices[key];
      const bcPrefix = `${prefix}.choice_${key}`;
      html += `<div class="choice-block">`;
      html += `<div class="choice-header">
        <div class="inline-flex">
          <span class="choice-key-label">${key}</span>
          <input type="text" data-bind="${bcPrefix}.key" value="${escAttr(key)}" style="width:50px;">
        </div>
        <button class="btn btn-small btn-danger" data-remove-choice="${prefix}" data-key="${key}">Remove</button>
      </div>`;

      // Text (supports variant text arrays)
      const textIsArray = Array.isArray(bc.text);
      html += `<div class="form-group mb-8">
        <div class="toggle-row">
          <label>Button Text</label>
          <button class="btn btn-small" data-toggle-choice-text="${bcPrefix}">${textIsArray ? "Simple" : "Conditional"}</button>
        </div>`;
      if (textIsArray) {
        bc.text.forEach((entry, ti) => {
          html += `<div class="variant-text-entry">`;
          if (entry.if) {
            html += `<label>Condition</label>`;
            html += renderConditionBuilder(entry.if, `${bcPrefix}_text_${ti}_if`);
          } else {
            html += `<div class="tag">Default</div>`;
          }
          html += `<input type="text" data-bind="${bcPrefix}.text[${ti}].text" value="${escAttr(entry.text || "")}">`;
          html += `<button class="btn btn-small btn-danger mt-8" data-remove-choice-text-entry="${bcPrefix}" data-index="${ti}">Remove</button>`;
          html += `</div>`;
        });
        html += `<button class="btn btn-small btn-success mt-8" data-add-choice-text-entry="${bcPrefix}">+ Add Text Entry</button>`;
      } else {
        html += `<input type="text" data-bind="${bcPrefix}.text" value="${escAttr(typeof bc.text === 'string' ? bc.text : '')}">`;
      }
      html += `</div>`;

      // Choice condition (if)
      html += `<div class="mb-8"><div class="toggle-row"><label>Choice Condition (if)</label>
        <button class="btn btn-small" data-toggle-choice-if="${bcPrefix}">${bc.if ? "Remove Condition" : "Add Condition"}</button>
      </div>`;
      if (bc.if) {
        html += renderConditionBuilder(bc.if, `${bcPrefix}_if`);
        html += `<div class="toggle-row mt-8"><label>Show Locked</label>
          <input type="checkbox" data-bind="${bcPrefix}.showLocked" ${bc.showLocked ? "checked" : ""}></div>`;
      }
      html += `</div>`;

      // Effects (supports variant effects arrays)
      const effectsIsArray = Array.isArray(bc.effects);
      html += `<div class="mb-8"><div class="toggle-row"><label>Effects</label>`;
      if (bc.effects) {
        html += `<button class="btn btn-small" data-toggle-choice-effects="${bcPrefix}">${effectsIsArray ? "Simple" : "Conditional"}</button>`;
      }
      html += `</div>`;
      if (effectsIsArray) {
        bc.effects.forEach((eff, ei) => {
          html += `<div class="variant-text-entry">`;
          if (eff.if) {
            html += `<label>Condition</label>`;
            html += renderConditionBuilder(eff.if, `${bcPrefix}_eff_${ei}_if`);
          } else {
            html += `<div class="tag">Default</div>`;
          }
          html += renderEffectsGrid(eff, `${bcPrefix}.effects[${ei}]`);
          html += `<button class="btn btn-small btn-danger mt-8" data-remove-choice-eff-entry="${bcPrefix}" data-index="${ei}">Remove</button>`;
          html += `</div>`;
        });
        html += `<button class="btn btn-small btn-success mt-8" data-add-choice-eff-entry="${bcPrefix}">+ Add Effects Entry</button>`;
      } else if (bc.effects) {
        html += renderEffectsGrid(bc.effects, `${bcPrefix}.effects`);
      } else {
        html += `<button class="btn btn-small mt-8" data-add-branch-effects="${bcPrefix}">+ Add Effects</button>`;
      }
      html += `</div>`;

      // Nested branch
      html += `<div class="mt-8"><div class="toggle-row"><label>Nested Branch</label>
        <button class="btn btn-small" data-toggle-branch="${bcPrefix}">${bc.next ? "Remove" : "Add"}</button>
      </div>`;
      if (bc.next) {
        html += renderBranch(bc.next, `${bcPrefix}.next`, depth + 1);
      }
      html += `</div>`;

      html += `</div>`; // close choice-block
    });
  }

  html += `<button class="btn btn-small btn-success mt-8" data-add-choice="${prefix}">+ Add Choice</button>`;
  html += `</div>`;
  return html;
}

// ─── Condition Builder ───
function renderConditionBuilder(cond, prefix) {
  if (!cond) {
    return `<div class="condition-builder" data-cond-prefix="${prefix}">
      <div class="condition-row"><span style="color:#888;">No condition</span>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="stat">+ Stat</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="chose">+ Chose</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="visits">+ Visits</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="day">+ Day</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="and">+ And</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="or">+ Or</button>
        <button class="btn btn-small" data-set-condition="${prefix}" data-type="not">+ Not</button>
      </div>
    </div>`;
  }

  let html = `<div class="condition-builder" data-cond-prefix="${prefix}">`;

  if (cond.and) {
    html += `<div class="condition-row"><strong>AND</strong>
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button></div>`;
    html += `<div class="condition-group">`;
    cond.and.forEach((sub, i) => {
      html += renderConditionBuilder(sub, `${prefix}_and_${i}`);
    });
    html += `<div class="condition-row">
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="and" data-subtype="stat">+ Stat</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="and" data-subtype="chose">+ Chose</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="and" data-subtype="visits">+ Visits</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="and" data-subtype="day">+ Day</button>
    </div>`;
    html += `</div>`;
  } else if (cond.or) {
    html += `<div class="condition-row"><strong>OR</strong>
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button></div>`;
    html += `<div class="condition-group">`;
    cond.or.forEach((sub, i) => {
      html += renderConditionBuilder(sub, `${prefix}_or_${i}`);
    });
    html += `<div class="condition-row">
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="or" data-subtype="stat">+ Stat</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="or" data-subtype="chose">+ Chose</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="or" data-subtype="visits">+ Visits</button>
      <button class="btn btn-small btn-success" data-add-sub-condition="${prefix}" data-combinator="or" data-subtype="day">+ Day</button>
    </div>`;
    html += `</div>`;
  } else if (cond.not) {
    html += `<div class="condition-row"><strong>NOT</strong>
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button></div>`;
    html += `<div class="condition-group">`;
    html += renderConditionBuilder(cond.not, `${prefix}_not`);
    html += `</div>`;
  } else if (cond.stat !== undefined) {
    html += `<div class="condition-row">
      <select data-bind="${prefix}.stat">
        ${["royalty","populace","kingdom","power","suspicion"].map(s => `<option value="${s}" ${cond.stat===s?"selected":""}>${s}</option>`).join("")}
      </select>
      <select data-bind="${prefix}.op">
        ${[">","<",">=","<=","==","!="].map(o => `<option value="${o}" ${cond.op===o?"selected":""}>${o}</option>`).join("")}
      </select>
      <input type="number" data-bind="${prefix}.value" value="${cond.value || 0}" style="width:60px;">
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button>
    </div>`;
  } else if (cond.chose) {
    html += `<div class="condition-row">
      <label>NPC</label><input type="text" data-bind="${prefix}.chose.npc" value="${escAttr(cond.chose.npc || "")}" style="width:100px;">
      <label>Choice</label><input type="text" data-bind="${prefix}.chose.choice" value="${escAttr(cond.chose.choice || "")}" style="width:50px;">
      <label>Last only</label><input type="checkbox" data-bind="${prefix}.chose.last" ${cond.chose.last ? "checked" : ""}>
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button>
    </div>`;
  } else if (cond.visits !== undefined) {
    const isObj = typeof cond.visits === "object";
    html += `<div class="condition-row">
      <label>Visits</label>
      <select data-bind="${prefix}.visits.op">
        ${[">","<",">=","<=","==","!="].map(o => `<option value="${o}" ${isObj && cond.visits.op===o?"selected":""}>${o}</option>`).join("")}
      </select>
      <input type="number" data-bind="${prefix}.visits.value" value="${isObj ? cond.visits.value : cond.visits}" style="width:60px;">
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button>
    </div>`;
  } else if (cond.day !== undefined) {
    const isObj = typeof cond.day === "object";
    html += `<div class="condition-row">
      <label>Day</label>
      <select data-bind="${prefix}.day.op">
        ${[">","<",">=","<=","==","!="].map(o => `<option value="${o}" ${isObj && cond.day.op===o?"selected":""}>${o}</option>`).join("")}
      </select>
      <input type="number" data-bind="${prefix}.day.value" value="${isObj ? cond.day.value : cond.day}" style="width:60px;">
      <button class="btn btn-small btn-danger" data-clear-condition="${prefix}">✕</button>
    </div>`;
  }

  html += `</div>`;
  return html;
}

// ─── Helpers ───
function escAttr(s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ─── Data Path Resolution ───
// Resolves a data-bind prefix path to { parent, key } in gameData
function resolveDataPath(bindPath) {
  // Translate our prefix notation to actual gameData paths
  // Prefixes: "npc" = current simple NPC, "var_N" = variant N
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  let parts = bindPath.split(".");
  let root;
  let startIdx;

  if (parts[0].startsWith("var_")) {
    const vIdx = parseInt(parts[0].split("_")[1]);
    root = npc.variants[vIdx];
    startIdx = 1;
  } else if (parts[0] === "npc") {
    root = npc;
    startIdx = 1;
  } else {
    return null;
  }

  let current = root;
  for (let i = startIdx; i < parts.length - 1; i++) {
    current = resolvePathSegment(current, parts[i]);
    if (current == null) return null;
  }

  const lastPart = parts[parts.length - 1];
  const arrMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
  if (arrMatch) {
    const arr = current[arrMatch[1]];
    return { parent: arr, key: parseInt(arrMatch[2]) };
  }

  return { parent: current, key: lastPart };
}

function resolvePathSegment(obj, segment) {
  // Handle choice_X notation
  const choiceMatch = segment.match(/^choice_(.+)$/);
  if (choiceMatch) {
    return obj.choices ? obj.choices[choiceMatch[1]] : null;
  }
  // Handle array index notation
  const arrMatch = segment.match(/^(.+)\[(\d+)\]$/);
  if (arrMatch) {
    const arr = obj[arrMatch[1]];
    return arr ? arr[parseInt(arrMatch[2])] : null;
  }
  return obj[segment];
}

// ─── Get choices object from a prefix path ───
function getChoicesFromPrefix(prefix) {
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  const parts = prefix.split(".");
  let root;
  let startIdx;

  if (parts[0].startsWith("var_")) {
    const vIdx = parseInt(parts[0].split("_")[1]);
    root = npc.variants[vIdx];
    startIdx = 1;
  } else if (parts[0] === "npc") {
    root = npc;
    startIdx = 1;
  } else {
    return null;
  }

  let current = root;
  for (let i = startIdx; i < parts.length; i++) {
    current = resolvePathSegment(current, parts[i]);
    if (current == null) return null;
  }

  return current;
}

// ─── Get the object that owns a condition from its prefix ───
function resolveConditionTarget(prefix) {
  // prefix like "var_0_if", "npc.choice_A_if", "var_0.choice_A.next_desc_0_if"
  // We need to find the parent object and the condition key path
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  const parts = prefix.split("_");

  // For variant-level conditions: "var_0_if"
  if (parts[0] === "var" && parts[parts.length - 1] === "if") {
    const vIdx = parseInt(parts[1]);
    return { parent: npc.variants[vIdx], key: "if" };
  }

  // For more complex paths, we need to parse the dot-separated prefix
  // The condition prefix is built from the rendering prefix + "_if" or similar
  // Let's use a different approach - parse from the data-bind style prefix
  return null;
}

// ─── Bind All Inputs ───
function bindAllEditorInputs(npcName) {
  // Simple data-bind inputs
  mainPanel.querySelectorAll("[data-bind]").forEach((el) => {
    const handler = () => {
      const path = resolveDataPath(el.dataset.bind);
      if (!path) return;
      let val;
      if (el.type === "checkbox") val = el.checked;
      else if (el.type === "number") val = parseInt(el.value) || 0;
      else val = el.value;

      // Handle choice key renames
      if (el.dataset.bind.endsWith(".key")) {
        handleChoiceKeyRename(el.dataset.bind, val);
        return;
      }

      // Handle condition binds
      if (isConditionBind(el.dataset.bind)) {
        setConditionValue(el.dataset.bind, val);
        return;
      }

      path.parent[path.key] = val;
    };
    el.addEventListener("change", handler);
    if (el.tagName === "TEXTAREA" || el.type === "text") {
      // Don't fire on input for key renames — only on change (blur/enter)
      if (!el.dataset.bind.endsWith(".key")) {
        el.addEventListener("input", handler);
      }
    }
  });

  // Delete variant button
  const delVarBtn = $("#deleteVariantBtn");
  if (delVarBtn) {
    delVarBtn.addEventListener("click", () => {
      const npc = gameData.npcs[npcName];
      if (!npc.variants || npc.variants.length <= 1) {
        toast("Cannot delete the only variant");
        return;
      }
      npc.variants.splice(activeVariantIndex, 1);
      activeVariantIndex = Math.min(activeVariantIndex, npc.variants.length - 1);
      renderNpcPanel(npcName);
    });
  }

  // Toggle desc simple/conditional
  mainPanel.querySelectorAll("[data-toggle-desc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.dataset.toggleDesc;
      const target = getTargetFromPrefix(prefix);
      if (!target) return;
      if (Array.isArray(target.desc)) {
        target.desc = target.desc[0]?.text || "";
      } else {
        target.desc = [{ text: target.desc || "" }];
      }
      renderNpcPanel(npcName);
    });
  });

  // Add/remove desc entries
  mainPanel.querySelectorAll("[data-add-desc-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = getTargetFromPrefix(btn.dataset.addDescEntry);
      if (target && Array.isArray(target.desc)) {
        target.desc.push({ text: "" });
        renderNpcPanel(npcName);
      }
    });
  });

  mainPanel.querySelectorAll("[data-remove-desc-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = getTargetFromPrefix(btn.dataset.removeDescEntry);
      const idx = parseInt(btn.dataset.index);
      if (target && Array.isArray(target.desc)) {
        target.desc.splice(idx, 1);
        if (target.desc.length === 0) target.desc = "";
        renderNpcPanel(npcName);
      }
    });
  });

  // Toggle choice text
  mainPanel.querySelectorAll("[data-toggle-choice-text]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.toggleChoiceText);
      if (!choice) return;
      if (Array.isArray(choice.text)) {
        choice.text = choice.text[0]?.text || "";
      } else {
        choice.text = [{ text: choice.text || "" }];
      }
      renderNpcPanel(npcName);
    });
  });

  // Add/remove choice text entries
  mainPanel.querySelectorAll("[data-add-choice-text-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.addChoiceTextEntry);
      if (choice && Array.isArray(choice.text)) {
        choice.text.push({ text: "" });
        renderNpcPanel(npcName);
      }
    });
  });

  mainPanel.querySelectorAll("[data-remove-choice-text-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.removeChoiceTextEntry);
      const idx = parseInt(btn.dataset.index);
      if (choice && Array.isArray(choice.text)) {
        choice.text.splice(idx, 1);
        if (choice.text.length === 0) choice.text = "";
        renderNpcPanel(npcName);
      }
    });
  });

  // Toggle choice condition
  mainPanel.querySelectorAll("[data-toggle-choice-if]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.toggleChoiceIf);
      if (!choice) return;
      if (choice.if) {
        delete choice.if;
        delete choice.showLocked;
      } else {
        choice.if = { stat: "power", op: ">=", value: 30 };
      }
      renderNpcPanel(npcName);
    });
  });

  // Toggle choice effects simple/conditional
  mainPanel.querySelectorAll("[data-toggle-choice-effects]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.toggleChoiceEffects);
      if (!choice) return;
      if (Array.isArray(choice.effects)) {
        choice.effects = choice.effects[0] || { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 };
        delete choice.effects.if;
      } else {
        choice.effects = [choice.effects || { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 }];
      }
      renderNpcPanel(npcName);
    });
  });

  // Add/remove choice effect entries
  mainPanel.querySelectorAll("[data-add-choice-eff-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.addChoiceEffEntry);
      if (choice && Array.isArray(choice.effects)) {
        choice.effects.push({ royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 });
        renderNpcPanel(npcName);
      }
    });
  });

  mainPanel.querySelectorAll("[data-remove-choice-eff-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.removeChoiceEffEntry);
      const idx = parseInt(btn.dataset.index);
      if (choice && Array.isArray(choice.effects)) {
        choice.effects.splice(idx, 1);
        if (choice.effects.length === 0) choice.effects = { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 };
        renderNpcPanel(npcName);
      }
    });
  });

  // Toggle branch
  mainPanel.querySelectorAll("[data-toggle-branch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.toggleBranch);
      if (!choice) return;
      if (choice.next) {
        delete choice.next;
      } else {
        choice.next = {
          desc: "",
          choices: {
            A: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } },
            B: { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } }
          }
        };
      }
      renderNpcPanel(npcName);
    });
  });

  // Toggle branch desc
  mainPanel.querySelectorAll("[data-toggle-branch-desc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const node = getNodeFromPrefix(btn.dataset.toggleBranchDesc);
      if (!node) return;
      if (Array.isArray(node.desc)) {
        node.desc = node.desc[0]?.text || "";
      } else {
        node.desc = [{ text: node.desc || "" }];
      }
      renderNpcPanel(npcName);
    });
  });

  // Add/remove branch desc entries
  mainPanel.querySelectorAll("[data-add-branch-desc-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const node = getNodeFromPrefix(btn.dataset.addBranchDescEntry);
      if (node && Array.isArray(node.desc)) {
        node.desc.push({ text: "" });
        renderNpcPanel(npcName);
      }
    });
  });

  mainPanel.querySelectorAll("[data-remove-branch-desc-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const node = getNodeFromPrefix(btn.dataset.removeBranchDescEntry);
      const idx = parseInt(btn.dataset.index);
      if (node && Array.isArray(node.desc)) {
        node.desc.splice(idx, 1);
        if (node.desc.length === 0) node.desc = "";
        renderNpcPanel(npcName);
      }
    });
  });

  // Add branch effects
  mainPanel.querySelectorAll("[data-add-branch-effects]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = getChoiceFromCPrefix(btn.dataset.addBranchEffects);
      if (choice) {
        choice.effects = { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 };
        renderNpcPanel(npcName);
      }
    });
  });

  // Add choice
  mainPanel.querySelectorAll("[data-add-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = getNodeFromPrefix(btn.dataset.addChoice);
      if (!container || !container.choices) {
        // Might be a branch node accessed via prefix ending in .next
        const node = getNodeFromPrefix(btn.dataset.addChoice);
        if (node) {
          if (!node.choices) node.choices = {};
          const existing = Object.keys(node.choices);
          const nextKey = getNextChoiceKey(existing);
          node.choices[nextKey] = { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } };
          renderNpcPanel(npcName);
        }
        return;
      }
      const existing = Object.keys(container.choices);
      const nextKey = getNextChoiceKey(existing);
      container.choices[nextKey] = { text: "", effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 } };
      renderNpcPanel(npcName);
    });
  });

  // Remove choice
  mainPanel.querySelectorAll("[data-remove-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = getNodeFromPrefix(btn.dataset.removeChoice);
      const key = btn.dataset.key;
      if (container && container.choices && container.choices[key]) {
        delete container.choices[key];
        renderNpcPanel(npcName);
      }
    });
  });

  // Condition: set type
  mainPanel.querySelectorAll("[data-set-condition]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.dataset.setCondition;
      const type = btn.dataset.type;
      setConditionType(prefix, type);
      renderNpcPanel(npcName);
    });
  });

  // Condition: clear
  mainPanel.querySelectorAll("[data-clear-condition]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearCondition(btn.dataset.clearCondition);
      renderNpcPanel(npcName);
    });
  });

  // Condition: add sub-condition to and/or
  mainPanel.querySelectorAll("[data-add-sub-condition]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.dataset.addSubCondition;
      const combinator = btn.dataset.combinator;
      const subtype = btn.dataset.subtype || "stat";
      addSubCondition(prefix, combinator, subtype);
      renderNpcPanel(npcName);
    });
  });

  // Add desc condition
  mainPanel.querySelectorAll("[data-add-desc-condition]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = getTargetFromPrefix(btn.dataset.addDescCondition);
      const idx = parseInt(btn.dataset.index);
      if (target && Array.isArray(target.desc) && target.desc[idx]) {
        if (!target.desc[idx].if) {
          target.desc[idx].if = { stat: "suspicion", op: ">", value: 50 };
        }
        renderNpcPanel(npcName);
      }
    });
  });
}

// ─── Prefix → Object Resolution Helpers ───
function getTargetFromPrefix(prefix) {
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  if (prefix === "npc") return npc;
  if (prefix.startsWith("var_")) {
    const vIdx = parseInt(prefix.split("_")[1]);
    return npc.variants ? npc.variants[vIdx] : null;
  }
  return null;
}

function getChoiceFromCPrefix(cPrefix) {
  // cPrefix like "npc.choice_A" or "var_0.choice_A" or "var_0.choice_A.next.choice_B"
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  const parts = cPrefix.split(".");
  let current;
  let startIdx;

  if (parts[0] === "npc") {
    current = npc;
    startIdx = 1;
  } else if (parts[0].startsWith("var_")) {
    const vIdx = parseInt(parts[0].split("_")[1]);
    current = npc.variants ? npc.variants[vIdx] : null;
    startIdx = 1;
  } else {
    return null;
  }

  for (let i = startIdx; i < parts.length; i++) {
    if (!current) return null;
    current = resolvePathSegment(current, parts[i]);
  }

  return current;
}

function getNodeFromPrefix(prefix) {
  // Similar to getChoiceFromCPrefix but returns the node (which has .choices, .desc)
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  const parts = prefix.split(".");
  let current;
  let startIdx;

  if (parts[0] === "npc") {
    current = npc;
    startIdx = 1;
  } else if (parts[0].startsWith("var_")) {
    const vIdx = parseInt(parts[0].split("_")[1]);
    current = npc.variants ? npc.variants[vIdx] : null;
    startIdx = 1;
  } else {
    return null;
  }

  for (let i = startIdx; i < parts.length; i++) {
    if (!current) return null;
    current = resolvePathSegment(current, parts[i]);
  }

  return current;
}

function getNextChoiceKey(existingKeys) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const l of letters) {
    if (!existingKeys.includes(l)) return l;
  }
  return "X" + existingKeys.length;
}

// ─── Choice Key Rename ───
function handleChoiceKeyRename(bindPath, newKey) {
  // Sanitize: only allow alphanumeric and underscores
  newKey = newKey.replace(/[^a-zA-Z0-9_]/g, "");
  if (!newKey) return;

  // bindPath like "npc.choice_A.key" or "var_0.choice_B.key"
  const parts = bindPath.split(".");
  const choicePart = parts[parts.length - 2]; // "choice_A"
  const oldKey = choicePart.replace("choice_", "");

  // Get the parent that has .choices
  const parentPrefix = parts.slice(0, -2).join(".");
  const parent = getNodeFromPrefix(parentPrefix);
  if (!parent || !parent.choices || !parent.choices[oldKey]) return;
  if (newKey === oldKey) return;
  if (parent.choices[newKey]) { toast("Key already exists"); return; }

  // Rebuild choices preserving order
  const newChoices = {};
  for (const k of Object.keys(parent.choices)) {
    if (k === oldKey) newChoices[newKey] = parent.choices[k];
    else newChoices[k] = parent.choices[k];
  }
  parent.choices = newChoices;
  renderNpcPanel(activeNpc);
}

// ─── Condition Data Manipulation ───
function isConditionBind(bindPath) {
  // Check if this bind path targets a condition field
  return bindPath.includes("_if.") || bindPath.includes(".chose.") ||
         bindPath.includes(".visits.") || bindPath.includes(".day.");
}

function setConditionValue(bindPath, val) {
  // Parse the condition bind path and set the value
  // This is complex because conditions are nested
  const condInfo = parseConditionBindPath(bindPath);
  if (!condInfo) return;
  condInfo.parent[condInfo.key] = val;
}

function parseConditionBindPath(bindPath) {
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  // Split on the first "_if." boundary
  const ifIdx = bindPath.indexOf("_if.");
  if (ifIdx === -1) return null;

  const ownerPrefix = bindPath.substring(0, ifIdx);
  const condPath = bindPath.substring(ifIdx + 4); // after "_if."

  let owner = getConditionOwner(ownerPrefix);
  if (!owner || !owner.if) return null;

  let cond = owner.if;

  // Walk into nested combinator segments like "and_0.", "or_1.", "not."
  let remaining = condPath;

  while (true) {
    let andMatch = remaining.match(/^and_(\d+)\.(.+)$/);
    if (andMatch) {
      if (!cond.and) return null;
      cond = cond.and[parseInt(andMatch[1])];
      if (!cond) return null;
      remaining = andMatch[2];
      continue;
    }

    let orMatch = remaining.match(/^or_(\d+)\.(.+)$/);
    if (orMatch) {
      if (!cond.or) return null;
      cond = cond.or[parseInt(orMatch[1])];
      if (!cond) return null;
      remaining = orMatch[2];
      continue;
    }

    let notMatch = remaining.match(/^not\.(.+)$/);
    if (notMatch) {
      if (!cond.not) return null;
      cond = cond.not;
      remaining = notMatch[2];
      continue;
    }

    break;
  }

  // Now `remaining` is a simple dot-path like "stat", "op", "value", "chose.npc", "visits.op", etc.
  const parts = remaining.split(".");
  let current = cond;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      // Auto-upgrade visits/day shorthand integer to object form
      if ((parts[i] === "visits" || parts[i] === "day") && typeof current[parts[i]] !== "object") {
        current[parts[i]] = { op: "==", value: current[parts[i]] || 0 };
      } else {
        return null;
      }
    }
    current = current[parts[i]];
  }

  return { parent: current, key: parts[parts.length - 1] };
}

function getConditionOwner(ownerPrefix) {
  const npc = gameData.npcs[activeNpc];
  if (!npc) return null;

  // Handle variant-level conditions: "var_0"
  if (/^var_\d+$/.test(ownerPrefix)) {
    const vIdx = parseInt(ownerPrefix.split("_")[1]);
    return npc.variants ? npc.variants[vIdx] : null;
  }

  // Handle choice-level conditions: "npc.choice_A" or "var_0.choice_A"
  // Handle desc-level conditions: "var_0_desc_0" or "npc_desc_0"
  // Handle nested: "var_0.choice_A.next.choice_B"

  // Check for desc conditions
  const descMatch = ownerPrefix.match(/^(.+)_desc_(\d+)$/);
  if (descMatch) {
    const target = getTargetFromPrefix(descMatch[1]) || getNodeFromPrefix(descMatch[1]);
    if (target && Array.isArray(target.desc)) {
      return target.desc[parseInt(descMatch[2])];
    }
    return null;
  }

  // Check for effect conditions
  const effMatch = ownerPrefix.match(/^(.+)_eff_(\d+)$/);
  if (effMatch) {
    const choice = getChoiceFromCPrefix(effMatch[1]);
    if (choice && Array.isArray(choice.effects)) {
      return choice.effects[parseInt(effMatch[2])];
    }
    return null;
  }

  // Check for choice text conditions
  const textMatch = ownerPrefix.match(/^(.+)_text_(\d+)$/);
  if (textMatch) {
    const choice = getChoiceFromCPrefix(textMatch[1]);
    if (choice && Array.isArray(choice.text)) {
      return choice.text[parseInt(textMatch[2])];
    }
    return null;
  }

  // Otherwise it's a choice or node
  return getChoiceFromCPrefix(ownerPrefix);
}

function setConditionType(prefix, type) {
  const owner = getConditionOwner(prefix.replace(/_if$/, ""));
  if (!owner) return;

  switch (type) {
    case "stat":
      owner.if = { stat: "power", op: ">=", value: 30 };
      break;
    case "chose":
      owner.if = { chose: { npc: "", choice: "A" } };
      break;
    case "visits":
      owner.if = { visits: { op: "==", value: 0 } };
      break;
    case "day":
      owner.if = { day: { op: "==", value: 1 } };
      break;
    case "and":
      owner.if = { and: [{ stat: "power", op: ">=", value: 30 }] };
      break;
    case "or":
      owner.if = { or: [{ stat: "power", op: ">=", value: 30 }] };
      break;
    case "not":
      owner.if = { not: { stat: "suspicion", op: ">", value: 70 } };
      break;
  }
}

function clearCondition(prefix) {
  // Find the condition and its parent, then remove it
  // prefix like "var_0_if", "var_0_if_and_0", "npc.choice_A_if"

  // Check if this is a sub-condition (inside and/or/not)
  const andMatch = prefix.match(/^(.+)_and_(\d+)$/);
  if (andMatch) {
    const parentOwner = getConditionOwner(andMatch[1].replace(/_if$/, ""));
    if (parentOwner && parentOwner.if && parentOwner.if.and) {
      parentOwner.if.and.splice(parseInt(andMatch[2]), 1);
      if (parentOwner.if.and.length === 0) delete parentOwner.if;
    }
    return;
  }

  const orMatch = prefix.match(/^(.+)_or_(\d+)$/);
  if (orMatch) {
    const parentOwner = getConditionOwner(orMatch[1].replace(/_if$/, ""));
    if (parentOwner && parentOwner.if && parentOwner.if.or) {
      parentOwner.if.or.splice(parseInt(orMatch[2]), 1);
      if (parentOwner.if.or.length === 0) delete parentOwner.if;
    }
    return;
  }

  const notMatch = prefix.match(/^(.+)_not$/);
  if (notMatch) {
    const parentOwner = getConditionOwner(notMatch[1].replace(/_if$/, ""));
    if (parentOwner && parentOwner.if) delete parentOwner.if.not;
    return;
  }

  // Top-level condition
  const owner = getConditionOwner(prefix.replace(/_if$/, ""));
  if (owner) delete owner.if;
}

function addSubCondition(prefix, combinator, subtype) {
  const owner = getConditionOwner(prefix.replace(/_if$/, ""));
  if (!owner || !owner.if) return;

  let newCond;
  switch (subtype) {
    case "chose":
      newCond = { chose: { npc: "", choice: "A" } };
      break;
    case "visits":
      newCond = { visits: { op: "==", value: 0 } };
      break;
    case "day":
      newCond = { day: { op: "==", value: 1 } };
      break;
    case "stat":
    default:
      newCond = { stat: "power", op: ">=", value: 30 };
      break;
  }

  if (combinator === "and" && owner.if.and) {
    owner.if.and.push(newCond);
  } else if (combinator === "or" && owner.if.or) {
    owner.if.or.push(newCond);
  }
}
