// rendering, event handling, undo, drawing.

const rules_container = document.getElementById("rules-container");
const screen_container = document.getElementById("screen-container");
const actions_container = document.getElementById("actions-container");
const tool_settings_container = document.getElementById("tool-settings-container");

const ACTIONS = [
    { id: "run"       , hint: "✅ Run Rule"   , keys: ["Enter"                ], action: (s) => apply_selected_rule(s) },
    { id: "run_all"   , hint: "✅ Run All"    , keys: [" "                    ], action: (s) => apply_all_rules(s) },
    { id: "delete"    , hint: "❌ Delete"     , keys: ["Delete"               ], action: (s) => delete_selection(s) },
    { id: "clear"     , hint: "🧼 Clear"      , keys: ["w"                    ], action: (s) => clear_selection(s) },
    { id: "duplicate" , hint: "📄 Duplicate"  , keys: ["d"                    ], action: (s) => duplicate_selection(s) },
    { id: "swap"      , hint: null            , keys: ["ArrowUp"              ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"      , hint: null            , keys: ["ArrowDown"            ], action: (s) => reorder_selection(s,1) },
    { id: "swap"      , hint: "⬅️ Swap Back"  , keys: ["ArrowLeft"            ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"      , hint: "➡️ Swap Next"  , keys: ["ArrowRight"           ], action: (s) => reorder_selection(s,1) },
    { id: "resize"    , hint: "➖ Height"     , keys: ["ArrowUp"   , "Control"], action: (s) => resize_patterns_in_selection(s,0,-1) },
    { id: "resize"    , hint: "➕ Height"     , keys: ["ArrowDown" , "Control"], action: (s) => resize_patterns_in_selection(s,0,1) },
    { id: "resize"    , hint: "➖ Width"      , keys: ["ArrowLeft" , "Control"], action: (s) => resize_patterns_in_selection(s,-1,0) },
    { id: "resize"    , hint: "➕ Width"      , keys: ["ArrowRight", "Control"], action: (s) => resize_patterns_in_selection(s,1,0) },
    { id: "rotate"    , hint: "🔃 Rotate"     , keys: ["r"                    ], action: (s) => rotate_patterns_in_selection(s) },
    { id: "flip"      , hint: "↔️ Flip Hor."  , keys: ["h"                    ], action: (s) => flip_patterns_in_selection(s, true, false) },
    { id: "flip"      , hint: "↕️ Flip Ver."  , keys: ["v"                    ], action: (s) => flip_patterns_in_selection(s, false, true) },
    { id: "shift"     , hint: "⬆️ Shift Up"   , keys: ["ArrowUp"   , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,-1) },
    { id: "shift"     , hint: "⬇️ Shift Down" , keys: ["ArrowDown" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,1) },
    { id: "shift"     , hint: "⬅️ Shift Left" , keys: ["ArrowLeft" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,-1,0) },
    { id: "shift"     , hint: "➡️ Shift Right", keys: ["ArrowRight", "Alt"    ], action: (s) => shift_patterns_in_selection(s,1,0) },
    { id: "undo"      , hint: "♻️ Undo Action", keys: ["z"                    ], action: () => undo_action() },
    { id: "undo"      , hint: null            , keys: ["u"                    ], action: () => undo_action() },
];

const TOOL_SETTINGS = [
    { group: "colors", hint: "Colors", options: [
        { color: 1, label: "White"   , keys: ["1"], action: () => tool_color(1) },
        { color: 2, label: "Light"   , keys: ["2"], action: () => tool_color(2) },
        { color: 3, label: "Dark"    , keys: ["3"], action: () => tool_color(3) },
        { color: 0, label: "Black"   , keys: ["4"], action: () => tool_color(0) },
        { color:-1, label: "Wildcard", keys: ["5"], action: () => tool_color(-1) },

    ]},
    { group: "tools", hint: "Drawing Tools", options: [
        { label: "Brush"    , keys: ["b"], action: () => tool_shape('brush') },
        { label: "Line"     , keys: ["l"], action: () => tool_shape('line') },
        { label: "Rectangle", keys: ["s"], action: () => tool_shape('rect') },
        { label: "Fill"     , keys: ["f"], action: () => tool_shape('fill') },
    ]},
    { group: "tools", hint: "Run after change", options: [
        { label: "Off", keys: null, action: () => toggle_run_after_change() },
        { label: "On" , keys: null, action: () => toggle_run_after_change() },
    ]}
];

document.addEventListener("keydown", (e) => {
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
    if (id === 'undo') {
        // this action is itself not undoable
        action();
        return;
    } 
    
    if (id === 'run' || id === 'run_all') {
        // this action changes the state of the play pattern, not the selected pattern
        const previous_state = structuredClone(PROJECT.play_pattern);
        const success = action(PROJECT.selected_path);
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
            // push to undo stack
            UNDO_STACK.play_pattern.push(previous_state);
            if (UNDO_STACK.play_pattern.length > UNDO_STACK_LIMIT) UNDO_STACK.play_pattern.shift();
        }
        return;
    }
    
    // save state for undo
    const play_selected = PROJECT.selected_path?.pattern_id === 'play';
    const previous_state = structuredClone(play_selected ? PROJECT.play_pattern : PROJECT.rules);
    const previous_selection = structuredClone(PROJECT.selected_path);

    // do action
    const success = action(PROJECT.selected_path);
    if (success) {
        // change selection
        PROJECT.selected_path = success.new_path;

        // render changes 
        if (success.render === 'play') {
            render_play_pattern();
        } else if (success.render === 'rules') {
            render_all_rules();
        } else if (success.render) {
            render_rule_by_id(success.render); // assume rule_id
        } else {
            console.warn("Action occured, but no re-render specified");
        }

        // push to undo stack
        const undo_stack = play_selected ? UNDO_STACK.play_pattern : UNDO_STACK.rules;
        undo_stack.push(previous_state);
        if (!play_selected) UNDO_STACK.rule_selection.push(previous_selection);
        if (undo_stack.length > UNDO_STACK_LIMIT) undo_stack.shift();
        if (UNDO_STACK.rule_selection.length > UNDO_STACK_LIMIT) UNDO_STACK.rule_selection.shift();

        // run after change
        if (OPTIONS.run_after_change && play_selected) {
            console.log("Running after change...");
            do_action(ACTIONS.find(a => a.id === 'run_all').action, 'run_all');
        }
        return;
    } 

    console.log(`Action '${id}' failed.`);
}

function undo_action() {
    if (PROJECT.selected_path?.pattern_id === 'play') {
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
        const old_path = structuredClone(PROJECT.selected_path);
        const new_path = UNDO_STACK.rule_selection.pop();
        const same = old_path && paths_equal(old_path, new_path);
        if (!same) {
            PROJECT.selected_path = new_path;
            render_selection_change(old_path, new_path);
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
    actions_container.classList.add("hidden"); // start hidden

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
        const group_label_el = document.createElement("label");
        group_label_el.textContent = group_label_text;
        group_label_el.className = "group-label";
        group_container.appendChild(group_label_el);

        // add options to container
        options.forEach(({label, action, keys, color}, i) => {
            const btn = document.createElement("button");
            btn.className = "tool-button";
            btn.dataset.group = group;
            btn.dataset.option_index = i;
            if (i === 0) btn.classList.add("active"); // first button is active by default
            if (color) {
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

function change_actions_after_selection() {
    const path = PROJECT.selected_path;
    if (!path) {
        actions_container.classList.add("hidden");
        return;
    } 
    actions_container.classList.remove("hidden");

    // show/hide actions based on selection
    const rules_only = ["run", "delete", "duplicate", "swap"];

    if (path.pattern_id === 'play') {
        rules_only.forEach(id => {
            actions_container.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        });
    } else {
        rules_only.forEach(id => {
            actions_container.querySelectorAll(`.action-${id}`).forEach(b => b.classList.remove("hidden"));
        });
    }

    // some actions change based on selection
    const undo_button_text = "♻️ Undo " + (path.pattern_id === 'play' ? "(Main Grid)" : "(Rule Editor)");
    actions_container.querySelector(`.action-undo`).textContent = undo_button_text;
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
            // add to undo stack
            const undo_stack = pattern.id === 'play' ? UNDO_STACK.play_pattern : UNDO_STACK.rules;
            undo_stack.push(structuredClone(pattern.id === 'play' ? PROJECT.play_pattern : PROJECT.rules));
            if (undo_stack.length > UNDO_STACK_LIMIT) undo_stack.shift();

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

            const is_selected = PROJECT.selected_path?.pattern_id === pattern.id;
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

    const path = PROJECT.selected_path;
    if (path && path.rule_id === rule.id) select_in_rule(path, ruleEl)

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
    PROJECT.rules.forEach(rule => {
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

    const path = PROJECT.selected_path;
    wrapEl.querySelectorAll(".grid").forEach(grid => grid.remove());
    if (path?.pattern_id === 'play') {
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

function render_selection_change(old_path, new_path) {
    const old_id = old_path?.rule_id;
    const new_id = new_path?.rule_id;
    // render deselected and selected rule
    if (old_id && old_id !== new_id) render_rule_by_id(old_id);
    if (new_id) render_rule_by_id(new_id);
    // render deselected or selected play pattern
    if (old_path?.pattern_id === 'play' || new_path?.pattern_id === 'play') render_play_pattern();

    // hide actions if nothing selected
    change_actions_after_selection();
}

function paths_equal(a, b) {
    if (!a || !b) return (a === b) // at least one is null
    return a.rule_id === b.rule_id && a.part_id === b.part_id && a.pattern_id === b.pattern_id;
}

function init() {
    // click event for selection
    rules_container.addEventListener("click", (e) => {
        function build_path(el) {
            const rule = el.closest(".rule");
            const part = el.closest(".rule-part");
            const wrap = el.closest(".pattern-wrap");
        
            if (!rule && !part && !wrap) return null;
        
            return {
                rule_id: rule?.dataset.id,
                part_id: part?.dataset.id,
                pattern_id: wrap?.dataset.id
            };
        }

        const old_path = structuredClone(PROJECT.selected_path);
        const new_path = build_path(e.target);
        const same = old_path && paths_equal(old_path, new_path);
        const should_toggle = same && !new_path.pattern_id; // click again on rule or part to deselect
        
        PROJECT.selected_path = should_toggle ? null : new_path;
        if (same && !should_toggle) return;
        render_selection_change(old_path, new_path);
    });

    screen_container.addEventListener("click", (e) => {
        const old_path = structuredClone(PROJECT.selected_path);
        const new_path = { pattern_id: 'play' };
        const same = old_path && paths_equal(old_path, new_path);

        if (same) return;
        PROJECT.selected_path = new_path;
        render_selection_change(old_path, new_path);
    });

    // just in case
    window.addEventListener("blur", (e) => UI_STATE.is_drawing = false);
    window.addEventListener("pointercancel", (e) => UI_STATE.is_drawing = false);
    window.addEventListener("mouseup", (e) => UI_STATE.is_drawing = false);

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
}
init();
