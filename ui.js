// only used in ui.js
const RULES_CONTAINER_EL = document.getElementById("rules-container");
const SCREEN_CONTAINER_EL = document.getElementById("screen-container");
const ACTIONS_CONTAINER_EL = document.getElementById("actions-container");
const TOOL_SETTINGS_CONTAINER_EL = document.getElementById("tool-settings-container");


// init

function init_starter_project() {
    // add defaults
    set_default_rules();
    set_default_play_pattern();
    // render
    update_css_vars();
    update_all_rule_els();
    update_play_pattern_el();
}

init_starter_project();

render_menu_buttons();
update_action_buttons();
set_true_vh();



// permanent window/ main DOM/ document event listeners

// keyboard shortcuts
document.addEventListener("keydown", (e) => {
    if (UI_STATE.is_drawing) return; // ignore key events while drawing
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return; // ignore key events in inputs

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
                do_tool_setting(bindings_group.option_key, binding.value);
                update_tool_buttons(bindings_group.group, i);
                return;
            }
        }
    }
});

RULES_CONTAINER_EL.addEventListener("pointerup", (e) => {
    if (UI_STATE.is_drawing) {
        finish_drawing();
        return;
    }

    if (e.target.tagName === "INPUT") return; // comment input does not change selection

    // select rules, parts or patterns.
    const old_sel = structuredClone(PROJECT.selected);
    const new_sel = get_new_sel(e.target);
    
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

function get_new_sel(el) { // used above to get selection info from the event target
    const rule = el.closest(".rule");
    const part = el.closest(".rule-part");
    const pattern = el.closest(".pattern-wrap");
    if (pattern) {
        return { type: 'pattern', paths: [{
            rule_id: rule?.dataset.id, part_id: part?.dataset.id, pattern_id: pattern?.dataset.id
        }]}
    } else if (part) {
        return { type: 'part', paths: [{
            rule_id: rule?.dataset.id, part_id: part?.dataset.id
        }]}
    } else if (rule) {
        return { type: 'rule', paths: [{
            rule_id: rule?.dataset.id
        }]}
    }
    return { type: null, paths: [] };
}

SCREEN_CONTAINER_EL.addEventListener("pointerup", (e) => {
    if (UI_STATE.is_drawing) {
        finish_drawing();
        return;
    }

    // select or deselect play pattern.
    const old_sel = structuredClone(PROJECT.selected);
    const new_sel = { 
        type: (e.target.closest(".screen-wrap") ? 'play' : null), 
        paths: [] 
    }; 
    const same = selections_equal(old_sel, new_sel);

    if (same) return;
    PROJECT.selected = new_sel;
    update_selected_els(old_sel, new_sel);
    update_action_buttons();
});

// stop gestures when leaving
window.addEventListener("blur", () => finish_drawing);
window.addEventListener("pointercancel", () => finish_drawing);
window.addEventListener("pointerup", () => finish_drawing);

// drag files on window to load
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

window.addEventListener("resize", set_true_vh);
screen.orientation.addEventListener("change", set_true_vh); // mobile orientation change
function set_true_vh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--vh-100', `${vh * 100}px`);
}


// rendering functions

function render_menu_buttons() {

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

    ACTIONS.forEach(({hint, action, id, keys}) => {
        if (!hint) return; // skip
        const btn = document.createElement("button");
        btn.textContent = hint;
        btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
        btn.className = "action-button";
        btn.classList.add(id ? "action-" + id : "action-button");
        btn.addEventListener("click", () => { do_action(action, id); });
        ACTIONS_CONTAINER_EL.appendChild(btn);
    });

    TOOL_SETTINGS.forEach(({group, hint: group_label_text, option_key, options}) => {
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
        options.forEach(({label, keys, value}, i) => {
            const btn = document.createElement("button");
            btn.className = "tool-button";
            btn.dataset.group = group;
            btn.dataset.option_index = i;
            if (value === OPTIONS[option_key]) btn.classList.add("active"); // initially active button
            if (group === "colors") {
                btn.classList.add("color-button");
                if (value !== -1) {
                    btn.style.backgroundColor = value_to_color(value);
                    btn.style.backgroundImage = "none";
                }
                btn.style.color = contrast_to_color(value);
            }
            btn.textContent = label;
            btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
            btn.addEventListener("click", () => { 
                do_tool_setting(option_key, value); 
                const matching_buttons = group_container.querySelectorAll(`button[data-group="${group}"]`);
                matching_buttons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active")
            });
            group_container.appendChild(btn);
        });

        TOOL_SETTINGS_CONTAINER_EL.appendChild(group_container);
    });
}

function update_tool_buttons(group, index) {
    const btns_in_group = TOOL_SETTINGS_CONTAINER_EL.querySelectorAll(`button[data-group="${group}"]`);
    btns_in_group.forEach(b => {
        if (b.dataset.option_index == index) {
            b.classList.add("active")
        } else {
            b.classList.remove("active")
        }
    });
}

function update_action_buttons() {
    const sel_type = PROJECT.selected.type;

    // show all first
    ACTIONS_CONTAINER_EL.querySelectorAll(".action-button").forEach(b => b.classList.remove("hidden"));

    // go through IDs
    ACTIONS.forEach(({id}) => {
        if (sel_type === 'play' && ACTIONS_HIDDEN_WHEN_PLAY_SELECTED.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        } else if (sel_type === null && !ACTIONS_SHOWN_WHEN_NOTHING_SELECTED.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        } else if (sel_type && sel_type !== 'play' && ACTIONS_HIDDEN_WHEN_RULE_SELECTED.includes(id)) {
            ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));
        }
    });

    // some actions change based on selection
    const last_sel_type = UNDO_STACK.last_undo_stack_types[UNDO_STACK.last_undo_stack_types.length - 1];
    const show_play = sel_type === 'play' || (sel_type === null && last_sel_type === 'play_pattern');
    const undo_button_text = "♻️ Undo " + (show_play ? "(Main Grid)" : "(Rule Editor)");
    ACTIONS_CONTAINER_EL.querySelector(`.action-undo`).textContent = undo_button_text;
}

function create_rule_el(rule) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.id = rule.id;

    // rule label
    const rule_label = document.createElement("label");
    let rule_label_text = rule.label || "?";
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
    if (rule.has_comment) {
        const rule_comment = document.createElement("input");
        const ghost = document.getElementById('input-ghost');
        rule_comment.className = "rule-comment";
        rule_comment.value = rule.comment || "";
        rule_comment.placeholder = "Add a comment...";
        rule_comment.addEventListener("input", (e) => {
            rule.comment = e.target.value;
            resize_input(rule_comment);
        });
        function resize_input(input) {
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
            if (sel_path.rule_id === rule.id) update_rule_highlight(sel_path, ruleEl)
        });
    }
    return ruleEl;
}

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
            cell.dataset.x = x;
            cell.dataset.y = y;
            grid.appendChild(cell);
        }
    }

    grid.addEventListener("pointerdown", (e) => {
        e.preventDefault();

        UI_STATE.is_drawing = true;
        const cell = e.target;
        if (cell.classList.contains("pixel")) {
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
        const cell = document.elementFromPoint(e.clientX, e.clientY);
        if (cell.classList.contains("pixel")) {
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

function draw_patterns_to_canvases(patterns) {
    patterns.forEach(p => {
        const canvas = document.querySelector(`.pattern-wrap[data-id="${p.id}"] canvas`);
        if (canvas) draw_pattern_to_canvas(p, canvas);
    });
}

function update_rule_highlight(sel_path, rule_el) {
    if (sel_path.part_id) {
        const part_el = rule_el.querySelector(`.rule-part[data-id="${sel_path.part_id}"]`);
        if (part_el && sel_path.pattern_id) {
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
    RULES_CONTAINER_EL.innerHTML = "";
    PROJECT.rules.forEach((rule, index) => {
        rule.label = index + 1;
        const rule_el = create_rule_el(rule);
        RULES_CONTAINER_EL.appendChild(rule_el);
    });
    // console.log(`Rendered all ${PROJECT.rules.length} rules`);
}

function update_rule_el_by_id(rule_id) {
    const index = PROJECT.rules.findIndex(r => r.id === rule_id);
    if (index === -1) return;

    // Remove existing DOM node
    const old_el = document.querySelector(`.rule[data-id="${rule_id}"]`);
    if (old_el) old_el.remove();

    // Re-render and insert at the right position
    PROJECT.rules[index].label = index + 1;
    const new_el = create_rule_el(PROJECT.rules[index]);
    RULES_CONTAINER_EL.insertBefore(new_el, RULES_CONTAINER_EL.children[index]);

    // console.log(`Rendered rule with id: ${rule_id}`);
}

function update_play_pattern_el() {
    const canvas = document.getElementById("screen-canvas");
    const wrap_el = SCREEN_CONTAINER_EL.querySelector("#screen-container .screen-wrap");
    const pattern = PROJECT.play_pattern;

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
