// rendering, event handling, undo, drawing.

const rules_container = document.getElementById("rules-container");
const screen_container = document.getElementById("screen-container");
const actions_container = document.getElementById("actions-container");
const tool_settings_container = document.getElementById("tool-settings-container");

const ACTIONS = [
    { id: "run"      , hint: "✅ Run Rule"   , keys: ["Enter"                ], action: (s) => apply_selected_rule(s) },
    { id: "run_all"  , hint: "✅ Run All"    , keys: [" "                    ], action: (s) => apply_all_rules(s) },
    { id: "load"     , hint: "📂 Load"       , keys: ["o"                    ], action: () => use_file_input_and_load() },
    { id: "save"     , hint: "💾 Save"       , keys: ["s"                    ], action: () => save_project() },
    { id: "undo"     , hint: "♻️ Undo Action", keys: ["z"                    ], action: () => undo_action() },
    { id: "undo"     , hint: null            , keys: ["u"                    ], action: () => undo_action() },
    { id: "delete"   , hint: "❌ Delete"     , keys: ["Delete"               ], action: (s) => delete_selection(s) },
    { id: "clear"    , hint: "🧼 Clear"      , keys: ["w"                    ], action: (s) => clear_selection(s) },
    { id: "duplicate", hint: "📄 Duplicate"  , keys: ["d"                    ], action: (s) => duplicate_selection(s) },
    { id: "swap"     , hint: null            , keys: ["ArrowUp"              ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: null            , keys: ["ArrowDown"            ], action: (s) => reorder_selection(s,1) },
    { id: "swap"     , hint: "⬅️ Swap Back"  , keys: ["ArrowLeft"            ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: "➡️ Swap Next"  , keys: ["ArrowRight"           ], action: (s) => reorder_selection(s,1) },
    { id: "resize"   , hint: "➖ Width"      , keys: ["ArrowLeft" , "Control"], action: (s) => resize_patterns_in_selection(s,-1,0) },
    { id: "resize"   , hint: "➕ Width"      , keys: ["ArrowRight", "Control"], action: (s) => resize_patterns_in_selection(s,1,0) },
    { id: "resize"   , hint: "➖ Height"     , keys: ["ArrowUp"   , "Control"], action: (s) => resize_patterns_in_selection(s,0,-1) },
    { id: "resize"   , hint: "➕ Height"     , keys: ["ArrowDown" , "Control"], action: (s) => resize_patterns_in_selection(s,0,1) },
    { id: "rotate"   , hint: "🔃 Rotate"     , keys: ["r"                    ], action: (s) => rotate_patterns_in_selection(s) },
    { id: "flip"     , hint: "↔️ Flip Hor."  , keys: ["h"                    ], action: (s) => flip_patterns_in_selection(s, true, false) },
    { id: "flip"     , hint: "↕️ Flip Ver."  , keys: ["v"                    ], action: (s) => flip_patterns_in_selection(s, false, true) },
    { id: "shift"    , hint: "⬅️ Shift Left" , keys: ["ArrowLeft" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,-1,0) },
    { id: "shift"    , hint: "➡️ Shift Right", keys: ["ArrowRight", "Alt"    ], action: (s) => shift_patterns_in_selection(s,1,0) },
    { id: "shift"    , hint: "⬆️ Shift Up"   , keys: ["ArrowUp"   , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,-1) },
    { id: "shift"    , hint: "⬇️ Shift Down" , keys: ["ArrowDown" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,1) },
];

const TOOL_SETTINGS = [
    { group: "colors", hint: null, options: [
        { color: 1, label: "White"   , keys: ["1"], action: () => tool_color(1) },
        { color: 2, label: "Light"   , keys: ["2"], action: () => tool_color(2) },
        { color: 3, label: "Dark"    , keys: ["3"], action: () => tool_color(3) },
        { color: 0, label: "Black"   , keys: ["4"], action: () => tool_color(0) },
        { color:-1, label: "Wildcard", keys: ["5"], action: () => tool_color(-1) },

    ]},
    { group: "tools", hint: null, options: [
        { label: "✏️"    , keys: ["b"], action: () => tool_shape('brush') },
        { label: "➖"     , keys: ["l"], action: () => tool_shape('line') },
        { label: "🔳", keys: ["n"], action: () => tool_shape('rect') },
        { label: "🪣"     , keys: ["f"], action: () => tool_shape('fill') },
    ]},
    { group: "tools", hint: "Run after change", options: [
        { label: "Off", keys: null, action: () => toggle_run_after_change() },
        { label: "On" , keys: null, action: () => toggle_run_after_change() },
    ]}
];

document.addEventListener("keydown", (e) => {
    if (UI_STATE.is_drawing) return; // ignore key events while drawing

    const pressed = new Set([
        e.key,
        ...(e.ctrlKey ? ["Control"] : []),
        ...(e.shiftKey ? ["Shift"] : []),
        ...(e.altKey ? ["Alt"] : []),
    ]);

    for (const binding of ACTIONS) {
        if (binding.keys.every(k => pressed.has(k)) && binding.keys.length === pressed.size) {
            e.preventDefault();
            do_action(binding.action, binding.id);
            break;
        }
    }

    for (const bindings_group of TOOL_SETTINGS) {
        for (let i = 0; i < bindings_group.options.length; i++) {
            const binding = bindings_group.options[i];
            if (!binding.keys) continue;
            if (binding.keys.every(k => pressed.has(k)) && binding.keys.length === pressed.size) {
                e.preventDefault();
                do_tool_setting(binding.action);

                // highlight the active button to match
                const btns_in_group = tool_settings_container.querySelectorAll(`button[data-group="${bindings_group.group}"]`);
                btns_in_group.forEach(b => {
                    if (b.dataset.option_index == i) {
                        b.classList.add("active")
                    } else {
                        b.classList.remove("active")
                    }
                });
                return;
            }
        }
    }
});

function do_action(action, id) {
    if (id === 'undo' || id === 'save' || id === 'load') {
        // this action is itself not undoable
        action();
        return;
    }
    
    if (id === 'run' || id === 'run_all') {
        // this action changes the state of the play pattern, not the selected pattern
        const previous_state = structuredClone(PROJECT.play_pattern);
        const success = action(PROJECT.selected);
        if (success) {
            const application_count = success.application_count;
            const limit_reached_count = success.limit_reached_count || 0;
            const change_count = application_count - PROJECT.rules.length; // last run is always unsuccessful
            if (id === 'run') {
                if (application_count >= RULE_APPLICATION_LIMIT) {
                    console.warn(`Rule checked ${RULE_APPLICATION_LIMIT} times, limit reached`);
                } else {
                    console.log(`Rule applied ${change_count} times`);
                }
            } else if (id === 'run_all') {
                if (limit_reached_count > 0) {
                    console.warn(`Rule checked ${RULE_APPLICATION_LIMIT} times (for ${limit_reached_count} rules)`);
                } else {
                    console.log(`Rules together applied ${change_count} times`);
                }
            }
            if (change_count < 1) return; // nothing changed

            render_play_pattern();
            push_to_undo_stack(true, previous_state);
        }
        return;
    }
    
    // save state for undo
    const play_selected = PROJECT.selected.type === 'play';
    const previous_state = structuredClone(play_selected ? PROJECT.play_pattern : PROJECT.rules);
    const previous_selection = structuredClone(PROJECT.selected);

    // do action
    const success = action(PROJECT.selected);
    if (success) {
        // change selection
        PROJECT.selected = success.new_selected;

        // render changes 
        if (success.render_type === 'play') {
            render_play_pattern();
        } else if (success.render_type === 'rules') {
            render_all_rules();
        } else if (success.render_type === 'rule') {
            [...success.render_ids].forEach(render_rule_by_id);
        } else {
            console.warn("Action occured, but no re-render specified");
        }

        push_to_undo_stack(play_selected, previous_state, previous_selection);

        console.log("Pushed to undo stack", UNDO_STACK.rules.length, UNDO_STACK.selected.length);

        // run after change
        if (OPTIONS.run_after_change && play_selected) {
            console.log("Running after change...");
            do_action(ACTIONS.find(a => a.id === 'run_all').action, 'run_all');
        }
        return;
    } 

    console.log(`Action '${id}' failed.`);
}

function push_to_undo_stack(play_selected, state_to_push, selection_to_push) {
    const undo_stack = play_selected ? UNDO_STACK.play_pattern : UNDO_STACK.rules;
    undo_stack.push(state_to_push);
    if (undo_stack.length > UNDO_STACK_LIMIT) undo_stack.shift();

    // also push the selection to the undo stack
    if (play_selected) return;
    UNDO_STACK.selected.push(selection_to_push || PROJECT.selected);
    if (UNDO_STACK.selected.length > UNDO_STACK_LIMIT) UNDO_STACK.selected.shift();
}

function undo_action() {
    if (PROJECT.selected.type === 'play') {
        if (UNDO_STACK.play_pattern.length > 0) {
            PROJECT.play_pattern = UNDO_STACK.play_pattern.pop();
            render_play_pattern();
            console.log("undo play_pattern", PROJECT.play_pattern.id);
            return;
        }
        console.log("Nothing to undo");
        return
    }

    if (UNDO_STACK.rules.length > 0) {
        // undo action on rules
        PROJECT.rules = UNDO_STACK.rules.pop();
        render_all_rules();

        // undo selection to state before action
        const old_sel = structuredClone(PROJECT.selected);
        const new_sel = UNDO_STACK.selected.pop();
        const same = selections_equal(old_sel, new_sel);
        if (!same) {
            PROJECT.selected = new_sel;
            render_selection_change(old_sel, new_sel);
        }
        console.log("undo rules");
        return;
    }
    console.log("Nothing to undo");
}

function do_tool_setting(action) {
    action();
}

function tool_color(value) {
    OPTIONS.selected_palette_value = value;
}

function tool_shape(shape) {
    OPTIONS.selected_tool = shape;
}

function toggle_run_after_change() {
    OPTIONS.run_after_change = !OPTIONS.run_after_change;
}

function prettify_keys(keys) {
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

function render_menu_buttons() {
    ACTIONS.forEach(({hint, action, id, keys}) => {
        if (!hint) return; // skip
        const btn = document.createElement("button");
        btn.textContent = hint;
        btn.title = (keys) ? "Hotkey: " + prettify_keys(keys) : "No hotkey"; // tooltip
        btn.className = "action-button";
        btn.classList.add(id ? "action-" + id : "action-button");
        btn.addEventListener("click", () => { do_action(action, id); });
        actions_container.appendChild(btn);
    });

    TOOL_SETTINGS.forEach(({group, hint: group_label_text, options}) => {
        // make container for options and add label in front
        const group_container = document.createElement("div");
        group_container.className = "options-container";
        group_container.dataset.group = group;
        if (group_label_text) {
            const group_label_el = document.createElement("label");
            group_label_el.textContent = group_label_text;
            group_label_el.className = "group-label";
            group_container.appendChild(group_label_el);
        }

        // add options to container
        options.forEach(({label, action, keys, color}, i) => {
            const btn = document.createElement("button");
            btn.className = "tool-button";
            btn.dataset.group = group;
            btn.dataset.option_index = i;
            if (i === 0) btn.classList.add("active"); // first button is active by default
            if (color !== undefined) {
                btn.classList.add("color-button");
                if (color !== -1) {
                    btn.style.backgroundColor = value_to_color(color);
                } else {
                    btn.style.backgroundImage = "repeating-linear-gradient(45deg,#666,#666 1px,#333 1px,#333 4px)";
                }
                btn.style.color = contrast_to_color(color);
            }
            btn.textContent = label;
            btn.title = (keys) ? "Hotkey: " + prettify_keys(keys) : "No hotkey"; // tooltip
            btn.addEventListener("click", () => { 
                do_tool_setting(action); 
                const matching_buttons = group_container.querySelectorAll(`button[data-group="${group}"]`);
                matching_buttons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active")
            });
            group_container.appendChild(btn);
        });

        tool_settings_container.appendChild(group_container);
    });
}

function show_actions_for_selection() {
    const sel_type = PROJECT.selected.type;

    // show all first
    actions_container.querySelectorAll(".action-button").forEach(b => b.classList.remove("hidden"));

    // go through IDs
    ACTIONS.forEach(({id}) => {
        if (sel_type === 'play' && ['run', 'delete', 'duplicate', 'swap', 'save', 'load'].includes(id)) {
            actions_container.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        } else if (sel_type === null && !['run_all', 'save', 'load', 'undo'].includes(id)) {
            actions_container.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        } else if (sel_type && sel_type !== 'play' && ['save', 'load', 'run_all'].includes(id)) {
            actions_container.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        }
    });

    // some actions change based on selection
    const undo_button_text = "♻️ Undo " + (sel_type === 'play' ? "(Main Grid)" : "(Rule Editor)");
    actions_container.querySelector(`.action-undo`).textContent = undo_button_text;
}

function save_project() {
    const data = JSON.stringify(PROJECT, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.json";
    a.click();
    
    URL.revokeObjectURL(url);
}

function use_file_input_and_load() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";

    input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) load_project(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

function load_project(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const json = JSON.parse(reader.result);
            Object.assign(PROJECT, json);

            // reset undo stacks
            UNDO_STACK.rules = [];
            UNDO_STACK.rule_selection = [];
            UNDO_STACK.play_pattern = [];

            render_all_rules();
            render_play_pattern();
        } catch (err) {
            alert("Invalid project file.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}


function value_to_color(value) { 
    if (value === -1) return "transparent"; // wildcard
    const PIXEL_PALLETTE = ["#222", "#fff", "#6cd9b5", "#036965"];
    return PIXEL_PALLETTE[value] || "magenta";
}

function contrast_to_color(value) {
    if (value === -1) return "white";
    const TEXT_ON_PIXEL_PALLETTE = ["#fff", "#000", "#000", "#fff"];
    return TEXT_ON_PIXEL_PALLETTE[value] || "purple";
}

function draw_pattern_to_canvas(canvas, pattern) {
    const scale = OPTIONS.pixel_scale;
    canvas.width = pattern.width * scale;
    canvas.height = pattern.height * scale;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const value = (pattern.pixels[y] !== undefined) ? pattern.pixels[y][x] : null;
            ctx.fillStyle = value_to_color(value);
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

function pick_draw_value(value_at_pixel) {
    if (OPTIONS.selected_tool !== 'brush') {
        // simply use the new value
        UI_STATE.draw_value = OPTIONS.selected_palette_value;
        return;
    }
    // when starting on the color itself, erase instead of draw
    UI_STATE.draw_value = (value_at_pixel === OPTIONS.selected_palette_value) ? 
      0 : OPTIONS.selected_palette_value;
}

function create_editor_div(pattern, drawing_callback) {
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${pattern.width}, 1fr)`;
    grid.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    grid.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
    grid.style.setProperty("--tile-size", PROJECT.tile_size);
    grid.style.setProperty("--pixel-scale", OPTIONS.pixel_scale);

    // pixels
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const cell = document.createElement("div");
            cell.className = "pixel";
            // add data-x and data-y attributes
            cell.dataset.x = x;
            cell.dataset.y = y;
            grid.appendChild(cell);
        }
    }

    grid.addEventListener("mousedown", (e) => {
        UI_STATE.is_drawing = true;
        const cell = e.target;
        if (cell.classList.contains("pixel")) {
            const state_to_push = pattern.id === 'play' ? PROJECT.play_pattern : PROJECT.rules;
            push_to_undo_stack(pattern.id === 'play', structuredClone(state_to_push));

            // start drawing
            UI_STATE.draw_start_x = +cell.dataset.x;
            UI_STATE.draw_start_y = +cell.dataset.y;
            UI_STATE.draw_pattern_before = structuredClone(pattern.pixels);
            const value_before = pattern.pixels[+cell.dataset.y][+cell.dataset.x];
            pick_draw_value(value_before);

            drawing_callback(+cell.dataset.x, +cell.dataset.y);
        }
    });

    grid.addEventListener("mouseup", () => {
        UI_STATE.is_drawing = false;

        // run after change
        if (OPTIONS.run_after_change && pattern.id === 'play') {
            console.log("Running after change...");
            do_action(ACTIONS.find(a => a.id === 'run_all').action, 'run_all');
        }
    });

    grid.addEventListener("mouseover", (e) => {
        if (!UI_STATE.is_drawing) return;
        const cell = e.target;
        if (cell.classList.contains("pixel")) {
            if (OPTIONS.selected_tool !== 'brush') {
                // reset the pattern to the state at the start of drawing
                pattern.pixels = structuredClone(UI_STATE.draw_pattern_before);
            }
            drawing_callback(+cell.dataset.x, +cell.dataset.y);
        }
    });

    return grid;
}

function render_rule(rule) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.id = rule.id;

    // rule label
    const rule_label = document.createElement("label");
    rule_label.textContent = rule.label || "?";
    rule_label.className = "rule-label";
    ruleEl.appendChild(rule_label);

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
            draw_pattern_to_canvas(canvas, pattern);
            wrapEl.appendChild(canvas);

            const is_selected = PROJECT.selected.type === 'pattern' && 
                PROJECT.selected.paths.find(p => p.pattern_id === pattern.id);

            if (is_selected) {
                const grid = create_editor_div(pattern, (x, y) => { 
                    draw_in_pattern(pattern, x, y, OPTIONS.selected_tool, UI_STATE);
                    draw_pattern_to_canvas(canvas, pattern);
                });
                wrapEl.appendChild(grid);
            }

            partEl.appendChild(wrapEl);

            if (pat_index === 0) {
                const arrowEl = document.createElement("label");
                arrowEl.textContent = '▶';
                partEl.appendChild(arrowEl);
            }
        });

        ruleEl.appendChild(partEl);
    });

    if (PROJECT.selected.type !== 'play') {
        PROJECT.selected.paths.forEach(path => {
            if (path.rule_id === rule.id) select_in_rule(path, ruleEl)
        });
    }
    return ruleEl;
}

function select_in_rule(path, ruleEl) {
    if (path.part_id) {
        const partEl = ruleEl.querySelector(`.rule-part[data-id="${path.part_id}"]`);
        if (partEl && path.pattern_id) {
            const patternEl = partEl.querySelector(`.pattern-wrap[data-id="${path.pattern_id}"]`);
            if (patternEl) {
                patternEl.classList.add("selected");
            }
        } else if (partEl) {
            partEl.classList.add("selected");
        }
    } else {
        ruleEl.classList.add("selected");
    }
}

function render_all_rules() {
    rules_container.innerHTML = "";
    PROJECT.rules.forEach((rule, index) => {
        rule.label = index + 1;
        const ruleEl = render_rule(rule);
        rules_container.appendChild(ruleEl);
    });
    console.log(`Rendered all ${PROJECT.rules.length} rules`);
}

function render_rule_by_id(rule_id) {
    const index = PROJECT.rules.findIndex(r => r.id === rule_id);
    if (index === -1) return;

    // Remove existing DOM node
    const oldEl = document.querySelector(`.rule[data-id="${rule_id}"]`);
    if (oldEl) oldEl.remove();

    // Re-render and insert at the right position
    PROJECT.rules[index].label = index + 1;
    const newEl = render_rule(PROJECT.rules[index]);
    rules_container.insertBefore(newEl, rules_container.children[index]);

    console.log(`Rendered rule with id: ${rule_id}`);
}

function render_play_pattern() {
    const canvas = document.getElementById("screen-canvas");
    const wrapEl = document.querySelector("#screen-container .screen-wrap");
    const pattern = PROJECT.play_pattern;

    canvas.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    canvas.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
    draw_pattern_to_canvas(canvas, pattern);

    wrapEl.querySelectorAll(".grid").forEach(grid => grid.remove());
    if (PROJECT.selected.type === 'play') {
        const grid = create_editor_div(pattern, (x, y) => { 
            draw_in_pattern(pattern, x, y, OPTIONS.selected_tool, UI_STATE);
            draw_pattern_to_canvas(canvas, pattern);
        });
        wrapEl.appendChild(grid);
        wrapEl.classList.add("selected");
    } else{
        wrapEl.classList.remove("selected");
    }
    console.log("Rendered play pattern");
}

function render_selection_change(old_sel, new_sel) {
    const old_rule_id = old_sel.paths[0]?.rule_id;
    const new_rule_id = new_sel.paths[0]?.rule_id;
    
    if (old_rule_id && new_rule_id && old_rule_id === new_rule_id) {
        // rule stayed selected, but change happened inside.
        render_rule_by_id(old_rule_id);
    } else {
        // something different is selected.
        if (old_rule_id) render_rule_by_id(old_rule_id); // deselect old rule
        if (new_rule_id) render_rule_by_id(new_rule_id); // select new rule
        if (old_sel.type === 'play' || new_sel.type === 'play') render_play_pattern();
    }
    show_actions_for_selection();
}

function selections_equal(a, b) {
    if (a.type !== b.type) return false;
    if (!a.paths.length && !b.paths.length) return true; // both empty
    if (a.paths.length !== b.paths.length) return false; // different length

    for (let i = 0; i < a.paths.length; i++) {
        const a_path = a.paths[i];
        const b_path = b.paths[i];
        if (a_path.rule_id !== b_path.rule_id) return false;
        if (a_path.part_id !== b_path.part_id) return false;
        if (a_path.pattern_id !== b_path.pattern_id) return false;
    }
    return true;
}

function init() {
    // click event for selection
    rules_container.addEventListener("click", (e) => {
        function get_new_sel(el) {
            const rule = el.closest(".rule");
            const part = el.closest(".rule-part");
            const pattern = el.closest(".pattern-wrap");

            if (pattern) {
                return {
                    type: 'pattern',
                    paths: [{
                        rule_id: rule?.dataset.id, part_id: part?.dataset.id, pattern_id: pattern?.dataset.id
                    }]
                }
            } else if (part) {
                return {
                    type: 'part',
                    paths: [{
                        rule_id: rule?.dataset.id, part_id: part?.dataset.id
                    }]
                }
            } else if (rule) {
                return {
                    type: 'rule',
                    paths: [{
                        rule_id: rule?.dataset.id
                    }]
                }
            }
            return { type: null, paths: [] };
        }

        const old_sel = structuredClone(PROJECT.selected);
        const new_sel = get_new_sel(e.target);
        const same = selections_equal(old_sel, new_sel);

         // click again on rule or part to deselect
        const should_toggle = same && new_sel.type !== 'pattern';
        
        PROJECT.selected = should_toggle ? { type: null, paths: [] } : new_sel;
        if (same && !should_toggle) return;
        render_selection_change(old_sel, new_sel);
    });

    screen_container.addEventListener("click", (e) => {
        const old_sel = structuredClone(PROJECT.selected);
        const new_sel = { 
            type: (e.target.closest(".screen-wrap") ? 'play' : null), 
            paths: [] 
        }; 
        const same = selections_equal(old_sel, new_sel);

        if (same) return;
        PROJECT.selected = new_sel;
        render_selection_change(old_sel, new_sel);
    });

    // just in case
    window.addEventListener("blur", (e) => UI_STATE.is_drawing = false);
    window.addEventListener("pointercancel", (e) => UI_STATE.is_drawing = false);
    window.addEventListener("mouseup", (e) => UI_STATE.is_drawing = false);

    // drag files to load
    window.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });
    window.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === "application/json") {
            load_project(file);
        } else {
            alert("Please drop a valid JSON file.");
        }
    });

    // init rules
    initial_rule();
    render_all_rules();

    // init screen
    const wrapEl = document.createElement("div");
    wrapEl.className = "screen-wrap";
    screen_container.appendChild(wrapEl);

    const screen_canvas = document.createElement("canvas");
    screen_canvas.id = "screen-canvas";
    wrapEl.appendChild(screen_canvas);

    initial_play_pattern();
    render_play_pattern();

    // init menu
    render_menu_buttons();
    show_actions_for_selection();
}
init();
