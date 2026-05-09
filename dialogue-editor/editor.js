// ============================================================
//  Wenching Hour – Dialogue Editor
//  Single-file vanilla JS editor for dialogue.json
// ============================================================

// ---------- Default / empty data ----------
const EMPTY_DATA = () => ({
  config: { days: 3, npcs_per_day: 5 },
  npcs: {},
  schedule: [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""]
  ]
});

const STAT_KEYS = ["royalty", "populace", "kingdom", "power", "suspicion"];
const OP_OPTIONS = [">", "<", ">=", "<=", "==", "!="];
const COND_TYPES = ["stat", "chose", "visits", "day", "and", "or", "not"];

// ---------- State ----------
let DATA = EMPTY_DATA();
let currentView = null;   // "npc:<name>" | "schedule" | "config"
let activeVariantIndex = {};  // { npcName: variantTabIndex }

// ---------- Auto-save ----------
const DRAFT_KEY = "wenching_editor_draft";
let autoSaveTimer = null;

function scheduleSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(DATA));
    refreshJsonPreview();
  }, 500);
}

// ---------- DOM helpers ----------
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

function clearEl(e) { e.innerHTML = ""; return e; }

function makeCollapsible(headerEl, bodyEl, startCollapsed = false) {
  let collapsed = startCollapsed;
  const icon = el("span", { style: "margin-left:6px; color:#666;" }, collapsed ? "▶" : "▼");
  headerEl.appendChild(icon);
  if (collapsed) bodyEl.classList.add("collapsed");
  headerEl.addEventListener("click", (e) => {
    // Don't toggle if a button inside the header was clicked
    if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
    collapsed = !collapsed;
    icon.textContent = collapsed ? "▶" : "▼";
    bodyEl.classList.toggle("collapsed", collapsed);
  });
}

// ---------- Deep clone ----------
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ---------- NPC helpers ----------
function getNpcNames() { return Object.keys(DATA.npcs); }

function isVariantBased(npc) { return Array.isArray(npc.variants); }

// ---------- Condition description (mirrors game logic) ----------
function describeCondition(cond) {
  if (!cond) return "(none)";
  if (cond.and) return "(" + cond.and.map(describeCondition).join(" AND ") + ")";
  if (cond.or)  return "(" + cond.or.map(describeCondition).join(" OR ")  + ")";
  if (cond.not) return "NOT (" + describeCondition(cond.not) + ")";
  if (cond.stat !== undefined) {
    const opLabels = { ">": ">", "<": "<", ">=": "≥", "<=": "≤", "==": "=", "!=": "≠" };
    return `${cond.stat} ${opLabels[cond.op] || cond.op} ${cond.value}`;
  }
  if (cond.chose) {
    const { npc, choice, last } = cond.chose;
    return last ? `Last chose ${choice} for ${npc}` : `Chose ${choice} for ${npc}`;
  }
  if (cond.visits !== undefined) {
    if (typeof cond.visits === "object") {
      return `Visits ${cond.visits.op} ${cond.visits.value}`;
    }
    return `Visit #${cond.visits + 1}`;
  }
  if (cond.day !== undefined) {
    if (typeof cond.day === "object") {
      return `Day ${cond.day.op} ${cond.day.value}`;
    }
    return `Day ${cond.day}`;
  }
  return JSON.stringify(cond);
}

// ============================================================
//  CONDITION BUILDER
// ============================================================

function renderConditionBuilder(container, cond, onChange, depth = 0) {
  clearEl(container);

  if (!cond || typeof cond !== "object") cond = { stat: "royalty", op: ">", value: 0 };

  // Determine current type
  let type = "stat";
  if (cond.and)  type = "and";
  else if (cond.or)   type = "or";
  else if (cond.not)  type = "not";
  else if (cond.chose) type = "chose";
  else if (cond.visits !== undefined) type = "visits";
  else if (cond.day !== undefined) type = "day";
  else if (cond.stat !== undefined) type = "stat";

  const typeRow = el("div", { class: "form-row" });
  const typeGroup = el("div", { class: "form-group shrink" });
  typeGroup.appendChild(el("label", {}, "Condition type"));
  const typeSel = el("select");
  COND_TYPES.forEach(t => {
    const o = el("option", { value: t }, t.toUpperCase());
    if (t === type) o.selected = true;
    typeSel.appendChild(o);
  });
  typeGroup.appendChild(typeSel);
  typeRow.appendChild(typeGroup);

  const fieldsDiv = el("div");
  const previewDiv = el("div", { class: "condition-preview" });

  function rebuild(newCond) {
    cond = newCond;
    previewDiv.textContent = describeCondition(cond);
    onChange(cond);
  }

  function renderFields() {
    clearEl(fieldsDiv);
    switch (type) {
      case "stat":   renderStatFields();       break;
      case "chose":  renderChoseFields();      break;
      case "visits": renderVisitsFields();     break;
      case "day":    renderDayFields();        break;
      case "and":    renderGroupFields("and"); break;
      case "or":     renderGroupFields("or");  break;
      case "not":    renderNotField();         break;
    }
    previewDiv.textContent = describeCondition(cond);
  }

  function renderStatFields() {
    if (!cond.stat) cond = { stat: "royalty", op: ">", value: 0 };
    const statSel = makeSelect(STAT_KEYS, cond.stat || "royalty", v => {
      cond = { ...cond, stat: v };
      rebuild(cond);
    });
    const opSel = makeSelect(OP_OPTIONS, cond.op || ">", v => {
      cond = { ...cond, op: v };
      rebuild(cond);
    });
    const valIn = makeNumberInput(cond.value ?? 0, v => {
      cond = { ...cond, value: v };
      rebuild(cond);
    });
    const row = el("div", { class: "form-row" });
    appendFormGroup(row, "Stat", statSel);
    appendFormGroup(row, "Op", opSel);
    appendFormGroup(row, "Value", valIn);
    fieldsDiv.appendChild(row);
  }

  function renderChoseFields() {
    if (!cond.chose) cond = { chose: { npc: "", choice: "", last: false } };
    const npcIn = makeTextInput(cond.chose.npc || "", v => {
      cond.chose.npc = v; rebuild(cond);
    }, "NPC name");
    const choiceIn = makeTextInput(cond.chose.choice || "", v => {
      cond.chose.choice = v; rebuild(cond);
    }, "Choice key e.g. A");
    const lastChk = makeCheckbox("Last visit only", cond.chose.last || false, v => {
      cond.chose.last = v; rebuild(cond);
    });
    const row = el("div", { class: "form-row" });
    appendFormGroup(row, "NPC", npcIn);
    appendFormGroup(row, "Choice key", choiceIn);
    fieldsDiv.appendChild(row);
    fieldsDiv.appendChild(lastChk);
  }

  function renderVisitsFields() {
    const isObj = typeof cond.visits === "object" && cond.visits !== null;
    const currentOp  = isObj ? cond.visits.op    : "==";
    const currentVal = isObj ? cond.visits.value  : (typeof cond.visits === "number" ? cond.visits : 0);

    const useOpChk = makeCheckbox("Use operator (advanced)", isObj, v => {
      cond = v ? { visits: { op: currentOp, value: currentVal } } : { visits: currentVal };
      rebuild(cond);
      renderFields();
    });
    fieldsDiv.appendChild(useOpChk);

    if (isObj) {
      const opSel = makeSelect(OP_OPTIONS, currentOp, v => {
        cond.visits.op = v; rebuild(cond);
      });
      const valIn = makeNumberInput(currentVal, v => {
        cond.visits.value = v; rebuild(cond);
      });
      const row = el("div", { class: "form-row" });
      appendFormGroup(row, "Op", opSel);
      appendFormGroup(row, "Visit count (0 = first)", valIn);
      fieldsDiv.appendChild(row);
    } else {
      const valIn = makeNumberInput(currentVal, v => {
        cond = { visits: v }; rebuild(cond);
      });
      const row = el("div", { class: "form-row" });
      appendFormGroup(row, "Visit count (0 = first)", valIn);
      fieldsDiv.appendChild(row);
    }
  }

  function renderDayFields() {
    const isObj = typeof cond.day === "object" && cond.day !== null;
    const currentOp  = isObj ? cond.day.op    : "==";
    const currentVal = isObj ? cond.day.value  : (typeof cond.day === "number" ? cond.day : 1);

    const useOpChk = makeCheckbox("Use operator (advanced)", isObj, v => {
      cond = v ? { day: { op: currentOp, value: currentVal } } : { day: currentVal };
      rebuild(cond);
      renderFields();
    });
    fieldsDiv.appendChild(useOpChk);

    if (isObj) {
      const opSel = makeSelect(OP_OPTIONS, currentOp, v => {
        cond.day.op = v; rebuild(cond);
      });
      const valIn = makeNumberInput(currentVal, v => {
        cond.day.value = v; rebuild(cond);
      });
      const row = el("div", { class: "form-row" });
      appendFormGroup(row, "Op", opSel);
      appendFormGroup(row, "Day (1-indexed)", valIn);
      fieldsDiv.appendChild(row);
    } else {
      const valIn = makeNumberInput(currentVal, v => {
        cond = { day: v }; rebuild(cond);
      });
      const row = el("div", { class: "form-row" });
      appendFormGroup(row, "Day (1-indexed)", valIn);
      fieldsDiv.appendChild(row);
    }
  }

  function renderGroupFields(groupType) {
    if (!Array.isArray(cond[groupType])) cond = { [groupType]: [] };
    const list = cond[groupType];

    list.forEach((subCond, i) => {
      const subContainer = el("div", { class: "condition-group" });
      const removeBtn = el("button", { class: "small danger" }, "✕ Remove");
      removeBtn.addEventListener("click", () => {
        list.splice(i, 1);
        rebuild(cond);
        renderFields();
      });
      subContainer.appendChild(removeBtn);
      if (depth < 4) {
        renderConditionBuilder(subContainer, subCond, newSub => {
          list[i] = newSub;
          rebuild(cond);
        }, depth + 1);
      } else {
        subContainer.appendChild(el("div", {}, "(max nesting depth reached)"));
      }
      fieldsDiv.appendChild(subContainer);
    });

    const addBtn = el("button", { class: "small primary" }, `+ Add ${groupType.toUpperCase()} condition`);
    addBtn.addEventListener("click", () => {
      list.push({ stat: "royalty", op: ">", value: 0 });
      rebuild(cond);
      renderFields();
    });
    fieldsDiv.appendChild(addBtn);
  }

  function renderNotField() {
    if (!cond.not) cond = { not: { stat: "royalty", op: ">", value: 0 } };
    const subContainer = el("div", { class: "condition-group" });
    if (depth < 4) {
      renderConditionBuilder(subContainer, cond.not, newSub => {
        cond.not = newSub;
        rebuild(cond);
      }, depth + 1);
    } else {
      subContainer.appendChild(el("div", {}, "(max nesting depth reached)"));
    }
    fieldsDiv.appendChild(subContainer);
  }

  typeSel.addEventListener("change", () => {
    type = typeSel.value;
    switch (type) {
      case "stat":   cond = { stat: "royalty", op: ">", value: 0 };                    break;
      case "chose":  cond = { chose: { npc: "", choice: "", last: false } };            break;
      case "visits": cond = { visits: 0 };                                              break;
      case "day":    cond = { day: 1 };                                                 break;
      case "and":    cond = { and: [] };                                                break;
      case "or":     cond = { or: [] };                                                 break;
      case "not":    cond = { not: { stat: "royalty", op: ">", value: 0 } };           break;
    }
    rebuild(cond);
    renderFields();
  });

  container.appendChild(typeRow);
  container.appendChild(fieldsDiv);
  container.appendChild(previewDiv);

  renderFields();
}

// ============================================================
//  EFFECTS EDITOR
// ============================================================

function renderEffectsEditor(container, effects, onChange) {
  clearEl(container);

  // Work from a live reference flag — re-check each time
  let currentEffects = effects;

  const modeToggle = el("label", { class: "inline-label" });
  const modeChk = el("input", { type: "checkbox" });
  modeChk.checked = Array.isArray(currentEffects);
  modeToggle.appendChild(modeChk);
  modeToggle.appendChild(document.createTextNode(" Conditional effects (variant array)"));
  container.appendChild(modeToggle);

  const body = el("div");
  container.appendChild(body);

  function renderFlat(eff) {
    clearEl(body);
    const grid = el("div", { class: "effects-grid" });
    STAT_KEYS.forEach(key => {
      const item = el("div", { class: "effect-item" });
      item.appendChild(el("label", {}, key));
      const inp = el("input", { type: "number", value: eff[key] ?? 0 });
      inp.addEventListener("change", () => {
        eff[key] = parseInt(inp.value) || 0;
        onChange(eff);
        scheduleSave();
      });
      item.appendChild(inp);
      grid.appendChild(item);
    });
    body.appendChild(grid);
  }

  function renderVariantEffects(arr) {
    clearEl(body);
    arr.forEach((entry, i) => {
      const card = el("div", { class: "section", style: "margin-bottom:8px;" });
      const hdr = el("div", { class: "section-header" });
      hdr.appendChild(el("span", {}, i === arr.length - 1 ? "Default effects" : `Variant ${i + 1}`));
      const removeBtn = el("button", { class: "small danger" }, "✕");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        arr.splice(i, 1);
        onChange(arr);
        scheduleSave();
        renderVariantEffects(arr);
      });
      hdr.appendChild(removeBtn);
      const bdy = el("div", { class: "section-body" });
      makeCollapsible(hdr, bdy, i > 0);
      card.appendChild(hdr);
      card.appendChild(bdy);

      if (i < arr.length - 1) {
        bdy.appendChild(el("label", {}, "Condition (when this effect applies):"));
        const condContainer = el("div", { class: "condition-builder" });
        bdy.appendChild(condContainer);
        renderConditionBuilder(condContainer, entry.if || null, newCond => {
          entry.if = newCond;
          onChange(arr);
          scheduleSave();
        });
      }

      bdy.appendChild(el("label", {}, "Effects:"));
      const grid = el("div", { class: "effects-grid" });
      STAT_KEYS.forEach(key => {
        const item = el("div", { class: "effect-item" });
        item.appendChild(el("label", {}, key));
        const inp = el("input", { type: "number", value: entry[key] ?? 0 });
        inp.addEventListener("change", () => {
          entry[key] = parseInt(inp.value) || 0;
          onChange(arr);
          scheduleSave();
        });
        item.appendChild(inp);
        grid.appendChild(item);
      });
      bdy.appendChild(grid);
      body.appendChild(card);
    });

    const addBtn = el("button", { class: "small primary" }, "+ Add variant");
    addBtn.addEventListener("click", () => {
      const newEntry = { if: { stat: "royalty", op: ">", value: 0 } };
      STAT_KEYS.forEach(k => newEntry[k] = 0);
      arr.splice(arr.length - 1, 0, newEntry);
      onChange(arr);
      scheduleSave();
      renderVariantEffects(arr);
    });
    body.appendChild(addBtn);
  }

  modeChk.addEventListener("change", () => {
    if (modeChk.checked) {
      // Convert flat → variant array
      const flat = Array.isArray(currentEffects) ? {} : (currentEffects || {});
      const defaultEntry = {};
      STAT_KEYS.forEach(k => defaultEntry[k] = flat[k] ?? 0);
      currentEffects = [defaultEntry];
      onChange(currentEffects);
      scheduleSave();
      renderVariantEffects(currentEffects);
    } else {
      // Convert variant array → flat (use first entry's values)
      const flat = {};
      STAT_KEYS.forEach(k => flat[k] = (Array.isArray(currentEffects) && currentEffects[0]) ? (currentEffects[0][k] ?? 0) : 0);
      currentEffects = flat;
      onChange(currentEffects);
      scheduleSave();
      renderFlat(currentEffects);
    }
  });

  if (Array.isArray(currentEffects)) {
    renderVariantEffects(currentEffects);
  } else {
    renderFlat(currentEffects || {});
  }
}

// ============================================================
//  TEXT FIELD EDITOR  (simple string OR variant array)
// ============================================================

function renderTextField(container, value, onChange, placeholder = "") {
  clearEl(container);

  let currentValue = value;

  const modeToggle = el("label", { class: "inline-label" });
  const modeChk = el("input", { type: "checkbox" });
  modeChk.checked = Array.isArray(currentValue);
  modeToggle.appendChild(modeChk);
  modeToggle.appendChild(document.createTextNode(" Conditional text (variant array)"));
  container.appendChild(modeToggle);

  const body = el("div");
  container.appendChild(body);

  function renderSimple(str) {
    clearEl(body);
    const ta = el("textarea", { placeholder });
    ta.value = str || "";
    ta.addEventListener("input", () => {
      currentValue = ta.value;
      onChange(currentValue);
      scheduleSave();
    });
    body.appendChild(ta);
  }

  function renderVariantText(arr) {
    clearEl(body);
    arr.forEach((entry, i) => {
      const row = el("div", { class: "text-variant-row" });
      const tvBody = el("div", { class: "tv-body" });

      if (i < arr.length - 1) {
        tvBody.appendChild(el("label", {}, `Condition for variant ${i + 1}:`));
        const condContainer = el("div", { class: "condition-builder" });
        tvBody.appendChild(condContainer);
        renderConditionBuilder(condContainer, entry.if || null, newCond => {
          entry.if = newCond;
          onChange(arr);
          scheduleSave();
        });
      } else {
        tvBody.appendChild(el("label", {}, "Default text (no condition):"));
      }

      tvBody.appendChild(el("label", {}, "Text:"));
      const ta = el("textarea", { placeholder: "Enter text..." });
      ta.value = entry.text || "";
      ta.addEventListener("input", () => {
        entry.text = ta.value;
        onChange(arr);
        scheduleSave();
      });
      tvBody.appendChild(ta);

      const removeBtn = el("button", { class: "small danger" }, "✕");
      removeBtn.addEventListener("click", () => {
        arr.splice(i, 1);
        onChange(arr);
        scheduleSave();
        renderVariantText(arr);
      });

      row.appendChild(tvBody);
      row.appendChild(removeBtn);
      body.appendChild(row);
    });

    const addBtn = el("button", { class: "small primary" }, "+ Add variant");
    addBtn.addEventListener("click", () => {
      arr.splice(arr.length - 1, 0, { if: { stat: "royalty", op: ">", value: 0 }, text: "" });
      onChange(arr);
      scheduleSave();
      renderVariantText(arr);
    });
    body.appendChild(addBtn);
  }

  modeChk.addEventListener("change", () => {
    if (modeChk.checked) {
      const str = typeof currentValue === "string" ? currentValue : "";
      currentValue = [{ text: str }];
      onChange(currentValue);
      scheduleSave();
      renderVariantText(currentValue);
    } else {
      const str = Array.isArray(currentValue)
        ? (currentValue[currentValue.length - 1]?.text || "")
        : (currentValue || "");
      currentValue = str;
      onChange(currentValue);
      scheduleSave();
      renderSimple(currentValue);
    }
  });

  if (Array.isArray(currentValue)) {
    renderVariantText(currentValue);
  } else {
    renderSimple(currentValue);
  }
}

// ============================================================
//  BRANCH / CHOICES EDITOR
// ============================================================

function renderChoicesEditor(container, choicesObj, onChange, depth = 0) {
  clearEl(container);

  Object.keys(choicesObj).forEach(key => {
    renderChoiceCard(container, choicesObj, key, onChange, depth);
  });

  const addRow = el("div", { class: "row-actions" });
  const addBtn = el("button", { class: "small primary" }, "+ Add Choice");
  addBtn.addEventListener("click", () => {
    const usedKeys = Object.keys(choicesObj);
    let nextKey = "A";
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!usedKeys.includes(letter)) { nextKey = letter; break; }
    }
    choicesObj[nextKey] = {
      text: "",
      effects: { royalty: 0, populace: 0, kingdom: 0, power: 0, suspicion: 0 }
    };
    onChange(choicesObj);
    scheduleSave();
    // Re-render the whole choices list cleanly
    renderChoicesEditor(container, choicesObj, onChange, depth);
  });
  addRow.appendChild(addBtn);
  container.appendChild(addRow);
}

function renderChoiceCard(container, choicesObj, key, onChange, depth) {
  const choice = choicesObj[key];

  const card = el("div", { class: "choice-card" });
  const hdr = el("div", { class: "choice-card-header" });
  const bdy = el("div", { class: "choice-card-body collapsed" });

  const keyBadge = el("span", { class: "tag green" }, key);
  const textPreview = el("span", { style: "margin-left:8px; color:#aaa; font-size:12px;" });
  const previewText = typeof choice.text === "string"
    ? choice.text
    : (choice.text?.[choice.text.length - 1]?.text || "");
  textPreview.textContent = previewText.slice(0, 50) || "(no text)";

  const toggleIcon = el("span", { style: "margin-right:6px; color:#666;" }, "▶");

  const hdrLeft = el("div", { style: "display:flex; align-items:center; gap:6px; flex:1;" });
  hdrLeft.appendChild(toggleIcon);
  hdrLeft.appendChild(keyBadge);
  hdrLeft.appendChild(textPreview);
  if (choice.if)   hdrLeft.appendChild(el("span", { class: "tag blue" }, "🔒 gated"));
  if (choice.next) hdrLeft.appendChild(el("span", { class: "tag" }, "→ branch"));

  const hdrRight = el("div", { style: "display:flex; gap:6px;" });

  const renameBtn = el("button", { class: "small" }, "✏️");
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const newKey = prompt("New choice key (single letter/word):", key);
    if (!newKey || newKey === key) return;
    if (choicesObj[newKey]) { alert("Key already exists!"); return; }
    // Preserve insertion order by rebuilding the object
    const entries = Object.entries(choicesObj);
    const idx = entries.findIndex(([k]) => k === key);
    entries[idx] = [newKey, entries[idx][1]];
    // Clear and repopulate choicesObj
    Object.keys(choicesObj).forEach(k => delete choicesObj[k]);
    entries.forEach(([k, v]) => choicesObj[k] = v);
    onChange(choicesObj);
    scheduleSave();
    renderChoicesEditor(container, choicesObj, onChange, depth);
  });

  const delBtn = el("button", { class: "small danger" }, "✕");
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm(`Delete choice "${key}"?`)) return;
    delete choicesObj[key];
    onChange(choicesObj);
    scheduleSave();
    renderChoicesEditor(container, choicesObj, onChange, depth);
  });

  hdrRight.appendChild(renameBtn);
  hdrRight.appendChild(delBtn);
  hdr.appendChild(hdrLeft);
  hdr.appendChild(hdrRight);

  // Toggle collapse
  let collapsed = true;
  hdr.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    collapsed = !collapsed;
    toggleIcon.textContent = collapsed ? "▶" : "▼";
    bdy.classList.toggle("collapsed", collapsed);
  });

  // ---- Body ----

  // Text
  const textSection = el("div", { style: "margin-bottom:10px;" });
  textSection.appendChild(el("label", {}, "Choice text:"));
  renderTextField(textSection, choice.text, newVal => {
    choice.text = newVal;
    const preview = typeof newVal === "string" ? newVal : (newVal?.[newVal.length - 1]?.text || "");
    textPreview.textContent = preview.slice(0, 50) || "(no text)";
    onChange(choicesObj);
  }, "What the player sees...");
  bdy.appendChild(textSection);

  // Gate condition
  const gateSection = el("div", { style: "margin-bottom:10px;" });
  const gateToggle = el("label", { class: "inline-label" });
  const gateChk = el("input", { type: "checkbox" });
  gateChk.checked = !!choice.if;
  gateToggle.appendChild(gateChk);
  gateToggle.appendChild(document.createTextNode(" Gate this choice (requires condition to show)"));
  gateSection.appendChild(gateToggle);

  const showLockedRow = el("div", { style: "margin-top:6px; display:" + (choice.if ? "block" : "none") });
  const showLockedToggle = el("label", { class: "inline-label" });
  const showLockedChk = el("input", { type: "checkbox" });
  showLockedChk.checked = !!choice.showLocked;
  showLockedToggle.appendChild(showLockedChk);
  showLockedToggle.appendChild(document.createTextNode(" Show as locked (greyed out) when condition fails"));
  showLockedRow.appendChild(showLockedToggle);
  showLockedChk.addEventListener("change", () => {
    choice.showLocked = showLockedChk.checked;
    onChange(choicesObj);
    scheduleSave();
  });

  const condContainer = el("div", { class: "condition-builder", style: "display:" + (choice.if ? "block" : "none") });
  if (choice.if) {
    renderConditionBuilder(condContainer, choice.if, newCond => {
      choice.if = newCond;
      onChange(choicesObj);
      scheduleSave();
    });
  }

  gateChk.addEventListener("change", () => {
    if (gateChk.checked) {
      choice.if = { stat: "royalty", op: ">", value: 0 };
      condContainer.style.display = "block";
      showLockedRow.style.display = "block";
      renderConditionBuilder(condContainer, choice.if, newCond => {
        choice.if = newCond;
        onChange(choicesObj);
        scheduleSave();
      });
    } else {
      delete choice.if;
      delete choice.showLocked;
      condContainer.style.display = "none";
      showLockedRow.style.display = "none";
      showLockedChk.checked = false;
    }
    onChange(choicesObj);
    scheduleSave();
  });

  gateSection.appendChild(condContainer);
  gateSection.appendChild(showLockedRow);
  bdy.appendChild(gateSection);

  // Effects
  const effSection = el("div", { style: "margin-bottom:10px;" });
  effSection.appendChild(el("label", {}, "Effects:"));
  const effContainer = el("div");
  renderEffectsEditor(effContainer, choice.effects || {}, newEff => {
    choice.effects = newEff;
    onChange(choicesObj);
  });
  effSection.appendChild(effContainer);
  bdy.appendChild(effSection);

  // Branch (next)
  const branchSection = el("div");
  const branchToggle = el("label", { class: "inline-label" });
  const branchChk = el("input", { type: "checkbox" });
  branchChk.checked = !!choice.next;
  branchToggle.appendChild(branchChk);
  branchToggle.appendChild(document.createTextNode(" Add branch dialogue (next)"));
  branchSection.appendChild(branchToggle);

  const branchBody = el("div", { class: "branch-block", style: "display:" + (choice.next ? "block" : "none") });

  function renderBranchBody() {
    clearEl(branchBody);
    if (!choice.next) return;
    branchBody.appendChild(el("div", { class: "branch-label" }, "↳ Branch"));

    branchBody.appendChild(el("label", {}, "Branch description:"));
    const descContainer = el("div", { style: "margin-bottom:10px;" });
    renderTextField(descContainer, choice.next.desc, newVal => {
      choice.next.desc = newVal;
      onChange(choicesObj);
      scheduleSave();
    }, "What happens after this choice...");
    branchBody.appendChild(descContainer);

    branchBody.appendChild(el("label", {}, "Branch choices:"));
    if (!choice.next.choices) choice.next.choices = {};
    if (depth < 5) {
      renderChoicesEditor(branchBody, choice.next.choices, newChoices => {
        choice.next.choices = newChoices;
        onChange(choicesObj);
        scheduleSave();
      }, depth + 1);
    } else {
      branchBody.appendChild(el("div", {}, "(max branch depth reached)"));
    }
  }

  branchChk.addEventListener("change", () => {
    if (branchChk.checked) {
      choice.next = { desc: "", choices: {} };
      branchBody.style.display = "block";
      renderBranchBody();
    } else {
      if (!confirm("Remove branch? This will delete all nested choices.")) {
        branchChk.checked = true;
        return;
      }
      delete choice.next;
      branchBody.style.display = "none";
      clearEl(branchBody);
    }
    onChange(choicesObj);
    scheduleSave();
  });

  if (choice.next) renderBranchBody();

  branchSection.appendChild(branchBody);
  bdy.appendChild(branchSection);

  card.appendChild(hdr);
  card.appendChild(bdy);
  container.appendChild(card);
}

// ============================================================
//  VARIANT EDITOR
// ============================================================

function renderVariantEditor(container, variant, isDefault, onChange) {
  clearEl(container);

  // Condition (not for default)
  if (!isDefault) {
    const condSection = el("div", { class: "section" });
    const condHdr = el("div", { class: "section-header" });
    condHdr.appendChild(el("span", {}, "Condition (when this variant is used)"));
    const condBdy = el("div", { class: "section-body" });
    makeCollapsible(condHdr, condBdy, false);
    const condContainer = el("div", { class: "condition-builder" });
    condBdy.appendChild(condContainer);
    renderConditionBuilder(condContainer, variant.if || null, newCond => {
      variant.if = newCond;
      onChange(variant);
      scheduleSave();
    });
    condSection.appendChild(condHdr);
    condSection.appendChild(condBdy);
    container.appendChild(condSection);
  }

  // Visual
  const visualSection = el("div", { class: "section" });
  const visualHdr = el("div", { class: "section-header" });
  visualHdr.appendChild(el("span", {}, "Visual"));
  const visualBdy = el("div", { class: "section-body" });
  makeCollapsible(visualHdr, visualBdy, false);

  const visual = variant.visual || {};

  const portraitRow = el("div", { class: "form-row" });
  const portraitGroup = el("div", { class: "form-group" });
  portraitGroup.appendChild(el("label", {}, "Portrait path (e.g. images/truffle.png)"));
  const portraitIn = el("input", { type: "text", placeholder: "images/default.png", value: visual.portrait || "" });
  portraitIn.addEventListener("input", () => {
    if (!variant.visual) variant.visual = {};
    variant.visual.portrait = portraitIn.value;
    onChange(variant);
    scheduleSave();
  });
  portraitGroup.appendChild(portraitIn);
  portraitRow.appendChild(portraitGroup);

  const colorGroup = el("div", { class: "form-group shrink" });
  colorGroup.appendChild(el("label", {}, "Accent colour"));
  const colorIn = el("input", { type: "color", value: visual.color || "#888888" });
  colorIn.addEventListener("input", () => {
    if (!variant.visual) variant.visual = {};
    variant.visual.color = colorIn.value;
    onChange(variant);
    scheduleSave();
  });
  colorGroup.appendChild(colorIn);
  portraitRow.appendChild(colorGroup);

  // Colour hex display
  const colorHexGroup = el("div", { class: "form-group shrink" });
  colorHexGroup.appendChild(el("label", {}, "Hex"));
  const colorHexIn = el("input", { type: "text", value: visual.color || "#888888", style: "width:80px;" });
  colorHexIn.addEventListener("input", () => {
    if (!variant.visual) variant.visual = {};
    variant.visual.color = colorHexIn.value;
    colorIn.value = colorHexIn.value;
    onChange(variant);
    scheduleSave();
  });
  colorIn.addEventListener("input", () => {
    colorHexIn.value = colorIn.value;
  });
  colorHexGroup.appendChild(colorHexIn);
  portraitRow.appendChild(colorHexGroup);

  visualBdy.appendChild(portraitRow);
  visualSection.appendChild(visualHdr);
  visualSection.appendChild(visualBdy);
  container.appendChild(visualSection);

  // Description
  const descSection = el("div", { class: "section" });
  const descHdr = el("div", { class: "section-header" });
  descHdr.appendChild(el("span", {}, "Description"));
  const descBdy = el("div", { class: "section-body" });
  makeCollapsible(descHdr, descBdy, false);
  renderTextField(descBdy, variant.desc, newVal => {
    variant.desc = newVal;
    onChange(variant);
    scheduleSave();
  }, "NPC description shown to player...");
  descSection.appendChild(descHdr);
  descSection.appendChild(descBdy);
  container.appendChild(descSection);

  // Choices
  const choicesSection = el("div", { class: "section" });
  const choicesHdr = el("div", { class: "section-header" });
  choicesHdr.appendChild(el("span", {}, "Choices"));
  const choicesBdy = el("div", { class: "section-body" });
  makeCollapsible(choicesHdr, choicesBdy, false);
  if (!variant.choices) variant.choices = {};
  renderChoicesEditor(choicesBdy, variant.choices, newChoices => {
    variant.choices = newChoices;
    onChange(variant);
    scheduleSave();
  });
  choicesSection.appendChild(choicesHdr);
  choicesSection.appendChild(choicesBdy);
  container.appendChild(choicesSection);
}

// ============================================================
//  NPC EDITOR
// ============================================================

function renderNpcEditor(npcName) {
  const pane = document.getElementById("editor-content");
  clearEl(pane);

  const npc = DATA.npcs[npcName];
  if (!npc) return;

  // Header
  const hdr = el("div", { class: "npc-editor-header" });
  const nameIn = el("input", { type: "text", value: npcName });
  nameIn.addEventListener("change", () => {
    const newName = nameIn.value.trim();
    if (!newName || newName === npcName) { nameIn.value = npcName; return; }
    if (DATA.npcs[newName]) { alert("An NPC with that name already exists!"); nameIn.value = npcName; return; }
    DATA.npcs[newName] = DATA.npcs[npcName];
    delete DATA.npcs[npcName];
    // Update schedule references
    DATA.schedule.forEach(day => {
      day.forEach((slot, i) => { if (slot === npcName) day[i] = newName; });
    });
    if (activeVariantIndex[npcName] !== undefined) {
      activeVariantIndex[newName] = activeVariantIndex[npcName];
      delete activeVariantIndex[npcName];
    }
    currentView = "npc:" + newName;
    scheduleSave();
    renderNpcList();
    renderNpcEditor(newName);
  });
  hdr.appendChild(nameIn);

  const dupBtn = el("button", {}, "⧉ Duplicate");
  dupBtn.addEventListener("click", () => {
    let newName = npcName + "_copy";
    let i = 2;
    while (DATA.npcs[newName]) newName = npcName + "_copy" + i++;
    DATA.npcs[newName] = clone(DATA.npcs[npcName]);
    scheduleSave();
    renderNpcList();
    selectNpc(newName);
  });

  const delBtn = el("button", { class: "danger" }, "🗑 Delete NPC");
  delBtn.addEventListener("click", () => {
    if (!confirm(`Delete NPC "${npcName}"? This cannot be undone.`)) return;
    delete DATA.npcs[npcName];
    DATA.schedule.forEach(day => {
      day.forEach((slot, i) => { if (slot === npcName) day[i] = ""; });
    });
    scheduleSave();
    renderNpcList();
    currentView = null;
    clearEl(pane);
    pane.appendChild(el("div", { class: "placeholder" }, "NPC deleted. Select another."));
  });

  hdr.appendChild(dupBtn);
  hdr.appendChild(delBtn);
  pane.appendChild(hdr);

  // Variant toggle
  const useVariants = isVariantBased(npc);
  const variantToggle = el("label", { class: "inline-label", style: "margin-bottom:12px; display:flex;" });
  const variantChk = el("input", { type: "checkbox" });
  variantChk.checked = useVariants;
  variantToggle.appendChild(variantChk);
  variantToggle.appendChild(document.createTextNode(" Use variant system (multiple versions of this NPC)"));
  pane.appendChild(variantToggle);

  const variantArea = el("div");
  pane.appendChild(variantArea);

  variantChk.addEventListener("change", () => {
    if (variantChk.checked) {
      const flat = clone(npc);
      delete flat.variants;
      DATA.npcs[npcName] = { variants: [flat] };
      activeVariantIndex[npcName] = 0;
    } else {
      const first = clone(DATA.npcs[npcName].variants?.[0] || {});
      delete first.if;
      DATA.npcs[npcName] = first;
    }
    scheduleSave();
    renderNpcEditor(npcName);
  });

  if (useVariants) {
    renderVariantTabs(variantArea, npcName);
  } else {
    const varContainer = el("div");
    renderVariantEditor(varContainer, DATA.npcs[npcName], true, () => {
      scheduleSave();
    });
    variantArea.appendChild(varContainer);
  }
}

function renderVariantTabs(container, npcName) {
  clearEl(container);
  const npc = DATA.npcs[npcName];
  const variants = npc.variants;
  const activeIdx = Math.min(activeVariantIndex[npcName] ?? 0, variants.length - 1);
  activeVariantIndex[npcName] = activeIdx;

  // Tab bar
  const tabBar = el("div", { class: "variant-tabs" });

  variants.forEach((v, i) => {
    const isDefault = i === variants.length - 1;
    const tab = el("div", { class: "variant-tab" + (i === activeIdx ? " active" : "") });
    tab.textContent = isDefault ? `Default (${i + 1})` : `Variant ${i + 1}`;
    tab.addEventListener("click", () => {
      activeVariantIndex[npcName] = i;
      renderVariantTabs(container, npcName);
    });
    tabBar.appendChild(tab);
  });

  const addTabBtn = el("button", { class: "small primary" }, "+ Add Variant");
  addTabBtn.addEventListener("click", () => {
    const newVariant = {
      if: { stat: "royalty", op: ">", value: 0 },
      desc: "",
      visual: {},
      choices: {}
    };
    // Insert before the last (default) variant
    variants.splice(variants.length - 1, 0, newVariant);
    activeVariantIndex[npcName] = variants.length - 2;
    scheduleSave();
    renderVariantTabs(container, npcName);
  });
  tabBar.appendChild(addTabBtn);

  if (variants.length > 1) {
    const delTabBtn = el("button", { class: "small danger" }, "✕ Delete Variant");
    delTabBtn.addEventListener("click", () => {
      if (!confirm(`Delete Variant ${activeIdx + 1}?`)) return;
      variants.splice(activeIdx, 1);
      activeVariantIndex[npcName] = Math.max(0, activeIdx - 1);
      scheduleSave();
      renderVariantTabs(container, npcName);
    });
    tabBar.appendChild(delTabBtn);
  }

  if (activeIdx > 0) {
    const moveLeftBtn = el("button", { class: "small" }, "← Move");
    moveLeftBtn.addEventListener("click", () => {
      [variants[activeIdx - 1], variants[activeIdx]] = [variants[activeIdx], variants[activeIdx - 1]];
      activeVariantIndex[npcName] = activeIdx - 1;
      scheduleSave();
      renderVariantTabs(container, npcName);
    });
    tabBar.appendChild(moveLeftBtn);
  }

  if (activeIdx < variants.length - 1) {
    const moveRightBtn = el("button", { class: "small" }, "→ Move");
    moveRightBtn.addEventListener("click", () => {
      [variants[activeIdx], variants[activeIdx + 1]] = [variants[activeIdx + 1], variants[activeIdx]];
      activeVariantIndex[npcName] = activeIdx + 1;
      scheduleSave();
      renderVariantTabs(container, npcName);
    });
    tabBar.appendChild(moveRightBtn);
  }

  container.appendChild(tabBar);

  // Active variant editor
  const isDefault = activeIdx === variants.length - 1;
  const varContainer = el("div");
  renderVariantEditor(varContainer, variants[activeIdx], isDefault, () => {
    scheduleSave();
  });
  container.appendChild(varContainer);
}

// ============================================================
//  SCHEDULE EDITOR
// ============================================================

function renderScheduleEditor() {
  const pane = document.getElementById("editor-content");
  clearEl(pane);

  pane.appendChild(el("h2", { style: "margin-bottom:12px;" }, "📅 Schedule"));

  // Always use live NPC names so newly added NPCs appear
  const npcNames = ["", ...getNpcNames()];

  const days = DATA.config.days;
  const slotsPerDay = DATA.config.npcs_per_day;

  // Sync schedule dimensions to config
  while (DATA.schedule.length < days) DATA.schedule.push(Array(slotsPerDay).fill(""));
  DATA.schedule.length = days;
  DATA.schedule.forEach(day => {
    while (day.length < slotsPerDay) day.push("");
    day.length = slotsPerDay;
  });

  const table = el("table", { class: "schedule-table" });
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", {}, "Day"));
  for (let s = 0; s < slotsPerDay; s++) {
    headRow.appendChild(el("th", {}, `Slot ${s + 1}`));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  DATA.schedule.forEach((day, dayIdx) => {
    const row = el("tr");
    row.appendChild(el("td", { style: "font-weight:bold; color:#aaa;" }, `Day ${dayIdx + 1}`));
    day.forEach((slot, slotIdx) => {
      const td = el("td");
      const sel = el("select");
      npcNames.forEach(name => {
        const opt = el("option", { value: name }, name || "(empty)");
        if (name === slot) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => {
        DATA.schedule[dayIdx][slotIdx] = sel.value;
        scheduleSave();
      });
      td.appendChild(sel);
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  pane.appendChild(table);

  const controls = el("div", { class: "row-actions", style: "margin-top:14px;" });

  const addDayBtn = el("button", {}, "+ Add Day");
  addDayBtn.addEventListener("click", () => {
    DATA.config.days++;
    DATA.schedule.push(Array(DATA.config.npcs_per_day).fill(""));
    scheduleSave();
    renderScheduleEditor();
  });

  const remDayBtn = el("button", { class: "danger" }, "- Remove Day");
  remDayBtn.addEventListener("click", () => {
    if (DATA.config.days <= 1) return;
    DATA.config.days--;
    DATA.schedule.pop();
    scheduleSave();
    renderScheduleEditor();
  });

  const addSlotBtn = el("button", {}, "+ Add Slot");
  addSlotBtn.addEventListener("click", () => {
    DATA.config.npcs_per_day++;
    DATA.schedule.forEach(day => day.push(""));
    scheduleSave();
    renderScheduleEditor();
  });

  const remSlotBtn = el("button", { class: "danger" }, "- Remove Slot");
  remSlotBtn.addEventListener("click", () => {
    if (DATA.config.npcs_per_day <= 1) return;
    DATA.config.npcs_per_day--;
    DATA.schedule.forEach(day => day.pop());
    scheduleSave();
    renderScheduleEditor();
  });

  controls.appendChild(addDayBtn);
  controls.appendChild(remDayBtn);
  controls.appendChild(addSlotBtn);
  controls.appendChild(remSlotBtn);
  pane.appendChild(controls);
}

// ============================================================
//  CONFIG EDITOR
// ============================================================

function renderConfigEditor() {
  const pane = document.getElementById("editor-content");
  clearEl(pane);

  pane.appendChild(el("h2", { style: "margin-bottom:12px;" }, "⚙️ Config"));

  const note = el("p", { style: "color:#888; margin-bottom:12px; font-size:12px;" },
    "Changing days/npcs_per_day here also resizes the schedule. Use the Schedule editor to assign NPCs to slots.");
  pane.appendChild(note);

  const daysGroup = el("div", { class: "form-group", style: "max-width:200px; margin-bottom:12px;" });
  daysGroup.appendChild(el("label", {}, "Number of days"));
  const daysIn = el("input", { type: "number", value: DATA.config.days, min: "1" });
  daysIn.addEventListener("change", () => {
    const v = Math.max(1, parseInt(daysIn.value) || 1);
    daysIn.value = v;
    DATA.config.days = v;
    while (DATA.schedule.length < v) DATA.schedule.push(Array(DATA.config.npcs_per_day).fill(""));
    DATA.schedule.length = v;
    scheduleSave();
  });
  daysGroup.appendChild(daysIn);
  pane.appendChild(daysGroup);

  const slotsGroup = el("div", { class: "form-group", style: "max-width:200px; margin-bottom:12px;" });
  slotsGroup.appendChild(el("label", {}, "NPCs per day (slots)"));
  const slotsIn = el("input", { type: "number", value: DATA.config.npcs_per_day, min: "1" });
  slotsIn.addEventListener("change", () => {
    const v = Math.max(1, parseInt(slotsIn.value) || 1);
    slotsIn.value = v;
    DATA.config.npcs_per_day = v;
    DATA.schedule.forEach(day => {
      while (day.length < v) day.push("");
      day.length = v;
    });
    scheduleSave();
  });
  slotsGroup.appendChild(slotsIn);
  pane.appendChild(slotsGroup);

  pane.appendChild(el("p", { style: "color:#666; font-size:12px;" },
    "Stat keys (fixed): " + STAT_KEYS.join(", ")));
}

// ============================================================
//  NPC LIST
// ============================================================

function renderNpcList() {
  const list = document.getElementById("npc-list");
  clearEl(list);

  getNpcNames().forEach(name => {
    const isActive = currentView === "npc:" + name;
    const item = el("div", { class: "npc-list-item" + (isActive ? " active" : "") });
    const nameSpan = el("span", { class: "npc-list-name" }, name);
    const delSpan = el("span", { class: "npc-list-del", title: "Delete NPC" }, "✕");
    delSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`Delete NPC "${name}"?`)) return;
      delete DATA.npcs[name];
      DATA.schedule.forEach(day => {
        day.forEach((slot, i) => { if (slot === name) day[i] = ""; });
      });
      scheduleSave();
      renderNpcList();
      if (currentView === "npc:" + name) {
        currentView = null;
        const pane = document.getElementById("editor-content");
        clearEl(pane);
        pane.appendChild(el("div", { class: "placeholder" }, "NPC deleted. Select another."));
      }
    });
    item.appendChild(nameSpan);
    item.appendChild(delSpan);
    item.addEventListener("click", () => selectNpc(name));
    list.appendChild(item);
  });
}

function selectNpc(name) {
  currentView = "npc:" + name;
  renderNpcList();
  renderNpcEditor(name);
  // Clear active state on nav buttons
  document.getElementById("btn-nav-schedule").classList.remove("active");
  document.getElementById("btn-nav-config").classList.remove("active");
}

// ============================================================
//  VALIDATION
// ============================================================

function runValidation() {
  const warnings = [];

  if (DATA.schedule.length !== DATA.config.days) {
    warnings.push({ msg: `Schedule has ${DATA.schedule.length} days but config says ${DATA.config.days}`, type: "error" });
  }

  DATA.schedule.forEach((day, i) => {
    if (day.length !== DATA.config.npcs_per_day) {
      warnings.push({ msg: `Day ${i + 1} has ${day.length} slots but config says ${DATA.config.npcs_per_day}`, type: "error" });
    }
    day.forEach((slot, j) => {
      if (!slot) {
        warnings.push({ msg: `Day ${i + 1}, Slot ${j + 1} is empty`, type: "warn" });
      } else if (!DATA.npcs[slot]) {
        warnings.push({ msg: `Day ${i + 1}, Slot ${j + 1}: NPC "${slot}" does not exist`, type: "error" });
      }
    });
  });

  Object.entries(DATA.npcs).forEach(([name, npc]) => {
    if (isVariantBased(npc)) {
      if (!npc.variants || npc.variants.length === 0) {
        warnings.push({ msg: `NPC "${name}" has an empty variants array`, type: "error" });
      } else {
        const last = npc.variants[npc.variants.length - 1];
        if (last.if) {
          warnings.push({ msg: `NPC "${name}": last variant has a condition — it should be the default (no condition)`, type: "warn" });
        }
        npc.variants.forEach((v, i) => {
          checkChoices(name, v.choices || {}, warnings, `variant ${i + 1}`);
        });
      }
    } else {
      if (!npc.choices || Object.keys(npc.choices).length === 0) {
        warnings.push({ msg: `NPC "${name}" has no choices`, type: "warn" });
      }
      checkChoices(name, npc.choices || {}, warnings, "");
    }

    const portrait = isVariantBased(npc)
      ? npc.variants?.[0]?.visual?.portrait
      : npc.visual?.portrait;
    if (portrait && !portrait.startsWith("images/")) {
      warnings.push({ msg: `NPC "${name}": portrait path "${portrait}" doesn't start with images/`, type: "warn" });
    }
  });

  if (warnings.length === 0) {
    warnings.push({ msg: "All checks passed! ✓", type: "ok" });
  }

  displayWarnings(warnings);
}

function checkChoices(npcName, choices, warnings, context) {
  Object.entries(choices).forEach(([key, choice]) => {
    if (!choice.text && choice.text !== 0) {
      warnings.push({ msg: `NPC "${npcName}" ${context} choice "${key}": missing text`, type: "warn" });
    }
    if (choice.effects && !Array.isArray(choice.effects)) {
      Object.keys(choice.effects).forEach(k => {
        if (!STAT_KEYS.includes(k)) {
          warnings.push({ msg: `NPC "${npcName}" ${context} choice "${key}": unknown effect key "${k}"`, type: "error" });
        }
      });
    }
    if (choice.next && choice.next.choices) {
      checkChoices(npcName, choice.next.choices, warnings, `${context} → branch of ${key}`);
    }
  });
}

function displayWarnings(warnings) {
  const body = document.getElementById("warnings-body");
  const badge = document.getElementById("warning-count-badge");
  clearEl(body);

  const errorCount = warnings.filter(w => w.type === "error").length;
  const warnCount  = warnings.filter(w => w.type === "warn").length;

  if (errorCount + warnCount > 0) {
    badge.style.display = "inline";
    badge.textContent = errorCount + warnCount;
  } else {
    badge.style.display = "none";
  }

  warnings.forEach(w => {
    const icon = w.type === "error" ? "❌" : w.type === "ok" ? "✅" : "⚠️";
    const item = el("div", { class: "warning-item " + (w.type || "warn") }, icon + " " + w.msg);
    body.appendChild(item);
  });
}

// ============================================================
//  JSON PREVIEW
// ============================================================

function refreshJsonPreview() {
  const pre = document.getElementById("json-preview");
  if (!pre) return;
  const panel = document.getElementById("json-preview-panel");
  if (panel.classList.contains("hidden")) return;
  pre.textContent = JSON.stringify(DATA, null, 2);
}

// ============================================================
//  SAVE / LOAD
// ============================================================

function saveJson() {
  const str = JSON.stringify(DATA, null, 2);
  const blob = new Blob([str], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dialogue.json";
  a.click();
  URL.revokeObjectURL(url);
}

function loadData(json) {
  try {
    const parsed = JSON.parse(json);
    DATA = parsed;
    if (!DATA.config) DATA.config = { days: 3, npcs_per_day: 5 };
    if (!DATA.npcs)   DATA.npcs = {};
    if (!DATA.schedule) DATA.schedule = [];
    activeVariantIndex = {};
    currentView = null;
    renderNpcList();
    const pane = document.getElementById("editor-content");
    clearEl(pane);
    pane.appendChild(el("div", { class: "placeholder" }, "Data loaded! Select an NPC or open Schedule / Config."));
    refreshJsonPreview();
    runValidation();
  } catch (e) {
    alert("Failed to parse JSON: " + e.message);
  }
}

// ============================================================
//  SMALL FORM HELPERS
// ============================================================

function makeSelect(options, currentVal, onChange) {
  const sel = el("select");
  options.forEach(opt => {
    const o = el("option", { value: opt }, opt);
    if (opt === currentVal) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function makeNumberInput(currentVal, onChange) {
  const inp = el("input", { type: "number", value: currentVal });
  inp.addEventListener("change", () => onChange(parseInt(inp.value) || 0));
  return inp;
}

function makeTextInput(currentVal, onChange, placeholder = "") {
  const inp = el("input", { type: "text", value: currentVal, placeholder });
  inp.addEventListener("input", () => onChange(inp.value));
  return inp;
}

function makeCheckbox(labelText, checked, onChange) {
  const lbl = el("label", { class: "inline-label" });
  const chk = el("input", { type: "checkbox" });
  chk.checked = checked;
  chk.addEventListener("change", () => onChange(chk.checked));
  lbl.appendChild(chk);
  lbl.appendChild(document.createTextNode(" " + labelText));
  return lbl;
}

function appendFormGroup(row, labelText, inputEl) {
  const group = el("div", { class: "form-group" });
  group.appendChild(el("label", {}, labelText));
  group.appendChild(inputEl);
  row.appendChild(group);
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // Draft banner
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    document.getElementById("draft-banner").style.display = "flex";
  }

  document.getElementById("btn-restore-draft").addEventListener("click", () => {
    const d = localStorage.getItem(DRAFT_KEY);
    if (d) loadData(d);
    document.getElementById("draft-banner").style.display = "none";
  });

  document.getElementById("btn-discard-draft").addEventListener("click", () => {
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById("draft-banner").style.display = "none";
  });

  // Toolbar
  document.getElementById("btn-save").addEventListener("click", saveJson);

  document.getElementById("btn-validate").addEventListener("click", () => {
    runValidation();
    document.getElementById("warnings-body").style.display = "block";
    document.getElementById("warnings-toggle-icon").textContent = "▲";
  });

  document.getElementById("btn-preview-toggle").addEventListener("click", () => {
    const panel = document.getElementById("json-preview-panel");
    panel.classList.toggle("hidden");
    refreshJsonPreview();
  });

  document.getElementById("btn-load-server").addEventListener("click", async () => {
    try {
      const res = await fetch("dialogue.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      loadData(text);
    } catch (e) {
      alert("Could not load dialogue.json from server: " + e.message);
    }
  });

  document.getElementById("file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadData(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btn-add-npc").addEventListener("click", () => {
    let name = prompt("NPC name:");
    if (!name) return;
    name = name.trim();
    if (!name) return;
    if (DATA.npcs[name]) { alert("An NPC with that name already exists!"); return; }
    DATA.npcs[name] = {
      desc: "",
      visual: { portrait: "images/default.png", color: "#888888" },
      choices: {}
    };
    scheduleSave();
    renderNpcList();
    selectNpc(name);
  });

  document.getElementById("btn-nav-schedule").addEventListener("click", () => {
    currentView = "schedule";
    renderNpcList();
    renderScheduleEditor();
    document.getElementById("btn-nav-schedule").classList.add("active");
    document.getElementById("btn-nav-config").classList.remove("active");
  });

  document.getElementById("btn-nav-config").addEventListener("click", () => {
    currentView = "config";
    renderNpcList();
    renderConfigEditor();
    document.getElementById("btn-nav-config").classList.add("active");
    document.getElementById("btn-nav-schedule").classList.remove("active");
  });

  // Warnings panel collapse toggle
  document.getElementById("warnings-header").addEventListener("click", () => {
    const body = document.getElementById("warnings-body");
    const icon = document.getElementById("warnings-toggle-icon");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    icon.textContent = isHidden ? "▲" : "▼";
  });

  // Initial state
  renderNpcList();
  displayWarnings([{ msg: "Click Validate to check your data, or load a dialogue.json to get started.", type: "warn" }]);
});
