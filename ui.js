import { PROJECT, OPTIONS, UI_STATE, UNDO_STACK } from "./state.js";
import { clear_project_obj, clear_undo_stack, selections_equal } from "./state.js";

import { ACTIONS, ACTION_BUTTON_VISIBILITY, TOOL_SETTINGS, init_starter_project, save_options, load_project } from "./actions.js";
import { do_action, do_tool_setting, start_drawing, continue_drawing, finish_drawing } from "./actions.js";

/** @typedef {import('./state.js').Selection} Selection */
/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').Options} Options */


const RULES_CONTAINER_EL = document.getElementById("rules-container");
const SCREEN_CONTAINER_EL = document.getElementById("screen-container");
const ACTIONS_CONTAINER_EL = document.getElementById("actions-container");
const TOOL_SETTINGS_CONTAINER_EL = document.getElementById("tool-settings-container");


// init

init_starter_project(render_callback); // load and render default rules and play pattern.
render_menu_buttons();
update_action_buttons();
set_true_vh();


// permanent window/ main DOM/ document event listeners

// keyboard shortcuts
document.addEventListener("keydown", (e) => {
    if (UI_STATE.is_drawing) return; // ignore key events while drawing
    const target = /** @type {HTMLElement} */ (e.target);
    if (["INPUT", "TEXTAREA"].includes(target.tagName)) return; // ignore key events in inputs

    const pressed = new Set([
        e.key,
        ...(e.ctrlKey ? ["Control"] : []),
        ...(e.shiftKey ? ["Shift"] : []),
        ...(e.altKey ? ["Alt"] : []),
    ]);

    for (const binding of ACTIONS) {
        if (!binding.keys) continue;
        if (binding.keys.every(k => pressed.has(k)) && binding.keys.length === pressed.size) {
            e.preventDefault();
            do_action(binding.action, binding.id, render_callback);
            break;
        }
    }

    for (const bindings_group of TOOL_SETTINGS) {
        for (let i = 0; i < bindings_group.options.length; i++) {
            const binding = bindings_group.options[i];
            if (!binding.keys) continue;
            if (binding.keys.every(k => pressed.has(k)) && binding.keys.length === pressed.size) {
                e.preventDefault();
                do_tool_setting(bindings_group.option_key, binding.value);
                update_tool_buttons(bindings_group.option_key, i);
                return;
            }
        }
    }
});

if (RULES_CONTAINER_EL) RULES_CONTAINER_EL.addEventListener("pointerup", (e) => {
    if (UI_STATE.is_drawing) {
        finish_drawing(render_callback);
        return;
    }
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target) return;
    if (target.tagName === "INPUT") return; // comment input does not change selection

    // select rules, parts or patterns.
    const old_sel = structuredClone(PROJECT.selected);
    const new_sel = get_new_sel(target);
    
    const ctrl_held = e.ctrlKey || e.metaKey; // MacOS
    if (ctrl_held) {
        if (PROJECT.selected.type !== new_sel.type) {
            // if the type is different, restart selection
            PROJECT.selected = new_sel;
        } else {
            // add or remove from selection
            PROJECT.selected = toggle_in_selection(PROJECT.selected, new_sel);
        }
    } else {
        const same = selections_equal(old_sel, new_sel);
        const should_toggle = same && new_sel.type !== 'pattern'; // click again on rule or part to deselect
        PROJECT.selected = should_toggle ? { type: null, paths: [] } : new_sel;
        if (same && !should_toggle) return;
    }
    update_selected_els(old_sel, new_sel);
    update_action_buttons();
});

/**
 * @param {HTMLElement} el - element that was clicked
 * @returns {Selection}
 */
function get_new_sel(el) {
    const rule    = /** @type {HTMLElement} */ (el.closest(".rule"));
    const part    = /** @type {HTMLElement} */ (el.closest(".rule-part"));
    const pattern = /** @type {HTMLElement} */ (el.closest(".pattern-wrap"));

    if (!rule || !rule.dataset.id) return { type: null, paths: [] }; // no rule selected

    if (!part || !part.dataset.id) return { type: 'rule', paths: [{ // no part selected, is rule
        rule_id: rule.dataset.id
    }]};

    if (!pattern || !pattern.dataset.id) return { type: 'part', paths: [{ // no pattern selected, is part
        rule_id: rule.dataset.id,
        part_id: part.dataset.id
    }]};

    return { type: 'pattern', paths: [{ // pattern selected
        rule_id: rule.dataset.id,
        part_id: part.dataset.id,
        pattern_id: pattern.dataset.id
    }]};
}

if (SCREEN_CONTAINER_EL) SCREEN_CONTAINER_EL.addEventListener("pointerup", (e) => {
    if (UI_STATE.is_drawing) {
        finish_drawing(render_callback);
        return;
    }
    const target = /** @type {HTMLElement} */ (e.target);

    // select or deselect play pattern.
    const old_sel = structuredClone(PROJECT.selected);
    /** @type {Selection} */
    const new_sel = { 
        type: (target.closest(".screen-wrap") ? 'play' : null), 
        paths: [] 
    }; 
    const same = selections_equal(old_sel, new_sel);

    if (same) return;
    PROJECT.selected = new_sel;
    update_selected_els(old_sel, new_sel);
    update_action_buttons();
});

// stop gestures when leaving
window.addEventListener("blur", () => finish_drawing(render_callback));
window.addEventListener("pointercancel", () => finish_drawing(render_callback));
window.addEventListener("pointerup", () => finish_drawing(render_callback));

// drag files on window to load
window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
});
window.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = (e.dataTransfer) ? e.dataTransfer.files[0] : null;
    if (file && file.type === "application/json") {
        load_project(file, render_callback);
    } else {
        alert("Please drop a valid JSON file.");
    }
});

window.addEventListener("resize", set_true_vh);
screen.orientation.addEventListener("change", set_true_vh); // mobile orientation change
function set_true_vh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--vh-100', `${vh * 100}px`);
}

/** @type {HTMLDialogElement} */
const NEW_PROJECT_DIALOG_EL = /** @type {any} */(document.getElementById("new-project-dialog"));

if (NEW_PROJECT_DIALOG_EL) NEW_PROJECT_DIALOG_EL.addEventListener("close", () => {
    if (NEW_PROJECT_DIALOG_EL.returnValue === "ok") {
        // use the new tile size from the input
        const tile_size_input = /** @type {HTMLInputElement} */ (document.getElementById("tile-size-input"));
        if (!tile_size_input) throw new Error("No tile size input found");
        const new_tile_size = +tile_size_input.value;
        if (isNaN(new_tile_size) || new_tile_size < 1) {
            alert("Invalid tile size. Please enter a positive number.");
            return;
        }
        OPTIONS.default_tile_size = new_tile_size;
        // TODO: add palette input.

        save_options();

        // reset the project
        clear_project_obj();
        clear_undo_stack();
        init_starter_project(render_callback);
    }
});

/**
 * @callback render_callback
 * @param {"selection" | "play" | "rules" | "palette"} change_type
 * @param {{ rule_id?: string, old_sel?: Selection, new_sel?: Selection } | null} data
 * @returns {void}
*/

/** @type {render_callback} */
function render_callback(change_type, data) {
    // call various functions depending on the action taken.
    // pass to the action functions so they can call this function when needed.

    if (change_type === "selection" && data && data.new_sel && data.old_sel) {
        const { old_sel, new_sel } = data;
        update_selected_els(old_sel, new_sel);
        update_action_buttons();

    } else if (change_type === "play") {
        update_play_pattern_el();

    } else if (change_type === "rules") {
        if (data && data.rule_id) {
            update_rule_el_by_id(data.rule_id); 
            return;
        } 
        update_all_rule_els();

    } else if (change_type === "palette") {
        update_tool_button_set('selected_palette_value');
        // TODO: below is only needed if the previous value was different?
        // which it should be when out of bounds? or maybe default to 1.
        update_tool_buttons('selected_palette_value', OPTIONS.selected_palette_value);

    } else {
        console.warn("Unknown change type:", change_type, data);
    }
}


// rendering functions

function render_menu_buttons() {
    if (!ACTIONS_CONTAINER_EL) throw new Error("No actions container found");
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");

    ACTIONS.forEach(({hint, action, id, keys}) => {
        if (!hint) return; // skip
        const btn = document.createElement("button");
        btn.textContent = hint;
        btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
        btn.className = "action-button";
        btn.classList.add(id ? "action-" + id : "action-button");
        btn.addEventListener("click", () => { do_action(action, id, render_callback); });
        ACTIONS_CONTAINER_EL.appendChild(btn);
    });

    TOOL_SETTINGS.forEach(({hint: group_label_text, option_key, options}) => {
        // make container for options and add label in front
        const group_container = document.createElement("div");
        group_container.className = "options-container";
        group_container.dataset.group = option_key;
        if (group_label_text) {
            const group_label_el = document.createElement("label");
            group_label_el.textContent = group_label_text;
            group_label_el.className = "group-label";
            group_container.appendChild(group_label_el);
        }
        populate_with_options(group_container, option_key, options); // add options to container

        TOOL_SETTINGS_CONTAINER_EL.appendChild(group_container);
    });
}

/** 
 * @param {HTMLDivElement} group_container 
 * @param {keyof Options} option_key
 * @param {{label: string, keys: string[] | null, value: any }[]} options - the options to add
 */
function populate_with_options(group_container, option_key, options) {
    // add options to container
    options.forEach(({label, keys, value}, i) => {
        const btn = document.createElement("button");
        btn.className = "tool-button";
        btn.dataset.group = option_key;
        btn.dataset.option_index = i.toString();
        if (value === OPTIONS[option_key]) btn.classList.add("active"); // initially active button
        if (option_key === "selected_palette_value") {
            btn.classList.add("color-button");
            if (value !== -1) {
                btn.style.backgroundColor = value_to_color(value);
                btn.style.backgroundImage = "none";
                btn.style.color = UI_STATE.text_contrast_palette[value] || "black"; // magenta is missing bg color
            }
        }
        btn.textContent = label;
        btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
        btn.addEventListener("click", () => { 
            do_tool_setting(option_key, value); 
            const matching_buttons = group_container.querySelectorAll(`button[data-group="${option_key}"]`);
            matching_buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active")
        });
        group_container.appendChild(btn);
    });
}

/** @param {string[]} keys */
function prettify_hotkey_names(keys) {
    return keys.map(key => {
        switch (key) {
            case "ArrowUp": return "↑";
            case "ArrowDown": return "↓";
            case "ArrowLeft": return "←";
            case "ArrowRight": return "→";
            case "Control": return "CTRL";
            case " ": return "SPACE";
            default: return key.toUpperCase();
        }
    }).join(" + ");
}

/** @param {keyof Options} option_key */
function update_tool_button_set(option_key) {
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");
    const container_el = /** @type {HTMLDivElement} */ (TOOL_SETTINGS_CONTAINER_EL.querySelector(`.options-container[data-group="${option_key}"]`));
    if (!container_el) throw new Error(`Container for ${option_key} not found`);

    container_el.innerHTML = ""; // clear old buttons
    const group_object = TOOL_SETTINGS.find(g => g.option_key === option_key);
    if (!group_object) throw new Error(`Toolbar group object ${option_key} not found`);
    populate_with_options(container_el, option_key, group_object.options);
}

/**
 * @param {string} group - the group of buttons to update
 * @param {number} index - the index of the button to set active
 */
function update_tool_buttons(group, index) {
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");
    /** @type {NodeListOf<HTMLElement>} */
    const btns_in_group = TOOL_SETTINGS_CONTAINER_EL.querySelectorAll(`button[data-group="${group}"]`);
    btns_in_group.forEach(b => {
        if (b.dataset.option_index === index.toString()) {
            b.classList.add("active")
        } else {
            b.classList.remove("active")
        }
    });
}

function update_action_buttons() {
    if (!ACTIONS_CONTAINER_EL) throw new Error("No actions container found");

    const sel_type = PROJECT.selected.type;
    const visibility = ACTION_BUTTON_VISIBILITY;

    // show all first
    ACTIONS_CONTAINER_EL.querySelectorAll(".action-button").forEach(b => b.classList.remove("hidden"));

    // go through IDs
    ACTIONS.forEach(({id}) => {
        if (sel_type === 'play' && visibility.hide_when_play_selected.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));

        } else if (sel_type === null && !visibility.show_when_nothing_selected.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));

        } else if (sel_type && sel_type !== 'play' && visibility.hide_when_rule_selected.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        }
    });

    // some actions change based on selection
    const undo_button = ACTIONS_CONTAINER_EL.querySelector(`.action-undo`);
    if (undo_button) {
        const last_sel_type = UNDO_STACK.last_undo_stack_types[UNDO_STACK.last_undo_stack_types.length - 1];
        const show_play = sel_type === 'play' || (sel_type === null && last_sel_type === "play");
        undo_button.textContent = "♻️ Undo " + (show_play ? "(Main Grid)" : "(Rule Editor)");
    }
}

/**
 * get the palette color for a value - default to magenta if not found.
 * @param {number | null} value - the value to convert to a color
 * @returns {string} - the color as a css color string
 */
function value_to_color(value) { 
    if (value === -1) return "transparent"; // wildcard
    if (value === null || value >= PROJECT.palette.length) return "magenta"; // empty
    return PROJECT.palette[value];
}

/**
 * @param {Pattern} pattern - the pattern to draw
 * @param {HTMLCanvasElement} canvas - the canvas to draw on
 * @returns {void}
 */
function draw_pattern_to_canvas(pattern, canvas) {
    const scale = OPTIONS.pixel_scale;
    canvas.width = pattern.width * scale;
    canvas.height = pattern.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context found for canvas");
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const value = (pattern.pixels[y] !== undefined) ? pattern.pixels[y][x] : null;
            ctx.fillStyle = value_to_color(value);
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

/**
 * @param {Rule} rule - the rule to create the element for
 * @returns {HTMLDivElement} - the rule element
 */
function create_rule_el(rule) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.id = rule.id;

    // rule label
    const rule_label = document.createElement("label");
    let rule_label_text = rule.label.toString() || "?";
    if (rule.rotate) {
        rule_label_text += "x4";
        ruleEl.classList.add("flag-rotate");
    }
    if (rule.part_of_group) ruleEl.classList.add("flag-group");
    rule_label.textContent = rule_label_text;
    rule_label.className = "rule-label";
    ruleEl.appendChild(rule_label);

    // rule content
    const rule_content = document.createElement("div");
    rule_content.className = "rule-content";
    ruleEl.appendChild(rule_content);

    // comment
    if (rule.show_comment) {
        const rule_comment = document.createElement("input");
        rule_comment.className = "rule-comment";
        rule_comment.value = rule.comment || "";
        rule_comment.placeholder = "Add a comment...";
        rule_comment.addEventListener("input", (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            rule.comment = target.value;
            resize_input(rule_comment);
        });

        /** @param {HTMLInputElement} input */
        function resize_input(input) {
            const ghost = document.getElementById('input-ghost');
            if (!ghost) throw new Error("No ghost input found");
            ghost.textContent = input.value || input.placeholder || " ";
            ghost.style.font = window.getComputedStyle(input).font;
            input.style.width = (ghost.scrollWidth + 16) + "px"; // padding
        }
        rule_content.appendChild(rule_comment);
        resize_input(rule_comment); // initial
    }

    // parts
    const rule_parts = document.createElement("div");
    rule_parts.className = "rule-parts";
    rule_content.appendChild(rule_parts);
    rule.parts.forEach(part => {
        const partEl = document.createElement("div");
        partEl.className = "rule-part";
        partEl.dataset.id = part.id;

        part.patterns.forEach((pattern, pat_index) => {
            const wrapEl = document.createElement("div");
            wrapEl.className = "pattern-wrap";
            wrapEl.dataset.id = pattern.id;

            const canvas = document.createElement("canvas");
            canvas.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
            canvas.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
            draw_pattern_to_canvas(pattern, canvas);
            wrapEl.appendChild(canvas);

            const is_selected = PROJECT.selected.type === 'pattern' && 
                PROJECT.selected.paths.find(p => p.pattern_id === pattern.id);

            if (is_selected) {
                const grid = create_pattern_editor_el(pattern, canvas);
                wrapEl.appendChild(grid);
            }

            partEl.appendChild(wrapEl);

            if (pat_index === 0) {
                const arrowEl = document.createElement("label");
                arrowEl.textContent = part.patterns.length > 1 ? '→' : '?';
                arrowEl.style.fontSize = part.patterns.length > 1 ? "1.3em" : "1em";
                partEl.appendChild(arrowEl);
            }
        });

        rule_parts.appendChild(partEl);
    });

    if (PROJECT.selected.type !== 'play') {
        PROJECT.selected.paths.forEach(sel_path => {
            if (sel_path.rule_id === rule.id) add_rule_highlight(sel_path, ruleEl)
        });
    }
    return ruleEl;
}

/**
 * @param {Pattern} pattern - the pattern to create the editor for
 * @param {HTMLCanvasElement} canvas - the canvas to draw on
 * @returns {HTMLDivElement} - the grid element
 */
function create_pattern_editor_el(pattern, canvas) {
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${pattern.width}, 1fr)`;
    grid.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    grid.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;

    // pixels
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const cell = document.createElement("div");
            cell.className = "pixel";
            // add data-x and data-y attributes
            cell.dataset.x = x.toString();
            cell.dataset.y = y.toString();
            grid.appendChild(cell);
        }
    }

    grid.addEventListener("pointerdown", (e) => {
        e.preventDefault();

        UI_STATE.is_drawing = true;

        const cell = /** @type {HTMLElement | null} */ (e.target);
        if (cell && cell.classList.contains("pixel")) {
            if (!cell.dataset.x || !cell.dataset.y) return;
            const x = +cell.dataset.x;
            const y = +cell.dataset.y;
            // setup, draw, render. could be multiple patterns at once.
            const changed_patterns = start_drawing(pattern, x, y);
            if (pattern.id === PROJECT.play_pattern.id) { draw_pattern_to_canvas(pattern, canvas); return; }
            draw_patterns_to_canvases(changed_patterns);
        }
    });

    grid.addEventListener("pointermove", (e) => {
        if (!UI_STATE.is_drawing) return;

        const cell = /** @type {HTMLElement | null} */ (document.elementFromPoint(e.clientX, e.clientY));
        if (cell && cell.classList.contains("pixel")) {
            if (!cell.dataset.x || !cell.dataset.y) return;
            const x = +cell.dataset.x;
            const y = +cell.dataset.y;
            if (x === UI_STATE.draw_x && y === UI_STATE.draw_y) return; // no change
            // draw and render
            const changed_patterns = continue_drawing(x, y);
            if (pattern.id === PROJECT.play_pattern.id) { draw_pattern_to_canvas(pattern, canvas); return; }
            draw_patterns_to_canvases(changed_patterns);
        }
    });

    // pointerup with UI_STATE.is_drawing is not specific to the grid and not handled here.

    return grid;
}

/** @param {Pattern[]} patterns - the patterns to draw */
function draw_patterns_to_canvases(patterns) {
    patterns.forEach(p => {
        /** @type {HTMLCanvasElement | null} */
        const canvas = document.querySelector(`.pattern-wrap[data-id="${p.id}"] canvas`);
        if (canvas) draw_pattern_to_canvas(p, canvas);
    });
}

/**
 * @param {import("./state.js").Selection_Path} sel_path - the selection path to highlight
 * @param {HTMLDivElement} rule_el - the rule element to highlight in
 */
function add_rule_highlight(sel_path, rule_el) {
    
    if ('part_id' in sel_path) {
        const part_el = rule_el.querySelector(`.rule-part[data-id="${sel_path.part_id}"]`);
        if (part_el && 'pattern_id' in sel_path) {
            const pattern_el = part_el.querySelector(`.pattern-wrap[data-id="${sel_path.pattern_id}"]`);
            if (pattern_el) {
                pattern_el.classList.add("selected");
            }
        } else if (part_el) {
            part_el.classList.add("selected");
        }
    } else {
        rule_el.classList.add("selected");
    }
}

function update_all_rule_els() {
    if (!RULES_CONTAINER_EL) throw new Error("No rules container found");
    RULES_CONTAINER_EL.innerHTML = "";
    PROJECT.rules.forEach((rule, index) => {
        rule.label = index + 1;
        const rule_el = create_rule_el(rule);
        RULES_CONTAINER_EL.appendChild(rule_el);
    });
    // console.log(`Rendered all ${PROJECT.rules.length} rules`);
}

/** @param {string} rule_id */
function update_rule_el_by_id(rule_id) {
    if (!RULES_CONTAINER_EL) throw new Error("No rules container found");
    const index = PROJECT.rules.findIndex(r => r.id === rule_id);

    // Remove existing DOM node
    const old_el = document.querySelector(`.rule[data-id="${rule_id}"]`);
    if (old_el) old_el.remove();

    // Re-render and insert at the right position
    if (index === -1) return; // only if it exists still
    PROJECT.rules[index].label = index + 1;
    const new_el = create_rule_el(PROJECT.rules[index]);
    RULES_CONTAINER_EL.insertBefore(new_el, RULES_CONTAINER_EL.children[index]);

    // console.log(`Rendered rule with id: ${rule_id}`);
}

function update_play_pattern_el() {
    if (!SCREEN_CONTAINER_EL) throw new Error("No screen container found");
    /** @type {HTMLCanvasElement | null} */
    const canvas = /***/ (document.getElementById("screen-canvas"));
    const wrap_el = SCREEN_CONTAINER_EL.querySelector("#screen-container .screen-wrap");
    const pattern = PROJECT.play_pattern;
    if (!canvas || !wrap_el) throw new Error("No screen canvas or wrap element found");

    canvas.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    canvas.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
    draw_pattern_to_canvas(pattern, canvas);

    wrap_el.querySelectorAll(".grid").forEach(grid => grid.remove());
    if (PROJECT.selected.type === 'play') {
        const grid = create_pattern_editor_el(pattern, canvas);
        wrap_el.appendChild(grid);
        wrap_el.classList.add("selected");
    } else{
        wrap_el.classList.remove("selected");
    }
    // console.log("Rendered play pattern");
}

/**
 * Render elements again that lost or gained selection.
 * @param {Selection} old_sel - the old selection to update
 * @param {Selection} new_sel - the new selection to update
 * @returns {void}
 */
function update_selected_els(old_sel, new_sel) {
    // re-render play pattern
    if (old_sel.type === 'play' || new_sel.type === 'play') update_play_pattern_el();

    // collect rule IDs to re-render
    const old_rule_ids = new Set(old_sel.paths.map(p => p.rule_id).filter(Boolean));
    const new_rule_ids = new Set(new_sel.paths.map(p => p.rule_id).filter(Boolean));
    const all_rule_ids = new Set([...old_rule_ids, ...new_rule_ids]);
    
    for (const rule_id of all_rule_ids) {
        update_rule_el_by_id(rule_id);
    }
}

/**
 * @param {Selection} base_sel - the base selection to modify
 * @param {Selection} new_sel - the new selection to toggle
 * @returns {Selection} - the modified base selection
 */
function toggle_in_selection(base_sel, new_sel) {
    // go through base_sel and modify and return it.
    // assume that new_sel is a single path.
    const index = base_sel.paths.findIndex(p => {
        return p.rule_id === new_sel.paths[0].rule_id && 
               p.part_id === new_sel.paths[0].part_id && 
               p.pattern_id === new_sel.paths[0].pattern_id;
    });
    if (index >= 0) {
        base_sel.paths.splice(index, 1); // deselect
    } else {
        base_sel.paths.push(new_sel.paths[0]); // add
    }
    return base_sel;
}
