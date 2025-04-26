// actions are functions that modify the state of the project, activated with button click or keypress.
// the state before the action is saved for undo.
// if an action is successful, the state is pushed to the undo stack and render updates are triggered.

function do_action(action, id) {
    if (NOT_UNDOABLE_ACTIONS.includes(id)) {
        // this action is itself not undoable
        action();
        return;
    }
    
    if (id === 'run' || id === 'run_all') {
        // this action changes the state of the play pattern, not the selected pattern
        const previous_state = structuredClone(PROJECT.play_pattern);
        const success = action(PROJECT.selected);

        if (success) {
            if (OPTIONS.run_in_loop) {
                const match_count = success.application_count;
                const check_count = success.failed_application_count + success.application_count;
                console.log(`Ran rules in loop. Checked ${check_count} rules, applied ${match_count} rules`);
                if (match_count < 1) return; // nothing changed

            } else {
                const application_count = success.application_count;
                const limit_reached_count = success.limit_reached_count || 0;
                const rules_checked_count = success.rules_checked_count;
                const change_count = application_count - rules_checked_count; // last run is always unsuccessful
                if (rules_checked_count === 1) {
                    if (application_count >= RULE_APPLICATION_LIMIT) {
                        console.warn(`Rule checked ${RULE_APPLICATION_LIMIT} times, limit reached`);
                    } else {
                        console.log(`Rule applied ${change_count} times`);
                    }
                } else {
                    if (limit_reached_count > 0) {
                        console.warn(`${rules_checked_count} rules checked ${RULE_APPLICATION_LIMIT} times (for ${limit_reached_count} rules)`);
                    } else {
                        console.log(`${rules_checked_count} rules applied ${change_count} times`);
                    }
                }
                if (change_count < 1) return; // nothing changed
            }
            
            update_play_pattern_el();
            push_to_undo_stack(true, previous_state);
        } else {
            console.warn(`Action '${id}' failed, probably because no rules were applied`);
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
            update_play_pattern_el();
        } else if (success.render_type === 'rules') {
            update_all_rule_els();
        } else if (success.render_type === 'rule') {
            [...success.render_ids].forEach(update_rule_el_by_id);
        } else {
            console.warn("Action occured, but no re-render specified");
        }

        push_to_undo_stack(play_selected, previous_state, previous_selection);

        // run after change
        if (OPTIONS.run_after_change && play_selected) {
            console.log("Running after change...");
            do_action(ACTIONS.find(a => a.id === 'run_all').action, 'run_all');
        }
        return;
    } 

    console.log(`Action '${id}' failed.`);
}

// when an action/ drawing on a pattern takes place
function push_to_undo_stack(play_selected, state_to_push, selection_to_push) {
    const undo_stack = play_selected ? UNDO_STACK.play_pattern : UNDO_STACK.rules;
    const undo_stack_type = play_selected ? 'play_pattern' : 'rules';
    undo_stack.push(state_to_push);
    UNDO_STACK.last_undo_stack_types.push(undo_stack_type);
    if (undo_stack.length > UNDO_STACK_LIMIT) undo_stack.shift();

    if (play_selected) return;
    // also push the selection to the undo stack
    UNDO_STACK.selected.push(selection_to_push || PROJECT.selected);
    if (UNDO_STACK.selected.length > UNDO_STACK_LIMIT) UNDO_STACK.selected.shift();
}


// general action functions
// most are in editor-state.js and play-state.js and use the active selection for context
// those return what needs to be rendered and the new selection

function undo_action() {
    const last_stack_type = UNDO_STACK.last_undo_stack_types.pop();
    if (PROJECT.selected.type === 'play' || (last_stack_type === 'play_pattern' && PROJECT.selected.type === null)) {
        if (UNDO_STACK.play_pattern.length > 0) {
            PROJECT.play_pattern = UNDO_STACK.play_pattern.pop();
            update_play_pattern_el();
            console.log("undo play_pattern", PROJECT.play_pattern.id);
            return;
        }
        console.log("Nothing to undo");
        return;
    }

    if (UNDO_STACK.rules.length > 0) {
        // undo action on rules
        PROJECT.rules = UNDO_STACK.rules.pop();
        update_all_rule_els();

        // undo selection to state before action
        const old_sel = structuredClone(PROJECT.selected);
        const new_sel = UNDO_STACK.selected.pop();
        const same = selections_equal(old_sel, new_sel);
        if (!same) {
            PROJECT.selected = new_sel;
            update_selected_els(old_sel, new_sel);
            update_action_buttons();
        }
        console.log("undo rules");
        return;
    }
    console.log("Nothing to undo");
}

function do_tool_setting(option_key, value) {
    OPTIONS[option_key] = value;
    save_options();
}

function zoom_pixel_grids(change) {
    OPTIONS.pixel_scale += change;
    OPTIONS.pixel_scale = Math.max(2, Math.min(OPTIONS.pixel_scale, 100));
    save_options();

    // render everything again
    update_all_rule_els();
    update_play_pattern_el();
}

function save_options() {
    localStorage.setItem('options', JSON.stringify(OPTIONS));
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

            clear_undo_stack();

            update_all_rule_els();
            update_play_pattern_el();
        } catch (err) {
            alert("Invalid project file.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

const NEW_PROJECT_DIALOG_EL = document.getElementById("new-project-dialog");
function new_project() {
    // open the dialog to create a new project
    NEW_PROJECT_DIALOG_EL.showModal();
}

NEW_PROJECT_DIALOG_EL.addEventListener("close", () => {
    if (NEW_PROJECT_DIALOG_EL.returnValue === "ok") {
        // use the new tile size from the input
        const new_tile_size = +document.getElementById("tile-size-input").value;
        if (isNaN(new_tile_size) || new_tile_size < 1) {
            alert("Invalid tile size. Please enter a positive number.");
            return;
        }
        OPTIONS.default_tile_size = new_tile_size;
        save_options();

        // reset the project
        clear_project_obj();
        clear_undo_stack();
        init_starter_project();
    }
});


// drawing

function start_drawing(pattern, x, y) {
    const state_to_push = pattern.id === 'play' ? PROJECT.play_pattern : PROJECT.rules;
    push_to_undo_stack(pattern.id === 'play', structuredClone(state_to_push));

    // set at start of drawing
    UI_STATE.draw_start_x = x;
    UI_STATE.draw_start_y = y;
    UI_STATE.draw_x = x;
    UI_STATE.draw_y = y;

    // if multiselect, draw in all selected patterns
    if (PROJECT.selected.type === 'pattern' && PROJECT.selected.paths.length > 1) {
        UI_STATE.draw_patterns = get_selected_rule_patterns(PROJECT.selected);
    } else {
        UI_STATE.draw_patterns = [pattern];
    }

    // clone the pixels for each pattern that is being edited. 
    // this is so that lines and rectangles can be previewed before they are finished.
    UI_STATE.draw_pixels_cloned = UI_STATE.draw_patterns.map((p) => structuredClone(p.pixels));

    // draw
    pick_draw_value(pattern.pixels[y][x]); // based on previous value
    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, OPTIONS.selected_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

function continue_drawing(x, y) {
    if (OPTIONS.selected_tool !== 'brush') {
        // reset the pixels to the state at the start of drawing
        for (let i = 0; i < UI_STATE.draw_patterns.length; i++) {
            UI_STATE.draw_patterns[i].pixels = structuredClone(UI_STATE.draw_pixels_cloned[i]);
        }
    }
    UI_STATE.draw_x = x;
    UI_STATE.draw_y = y;

    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, OPTIONS.selected_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

function finish_drawing() {
    if (!UI_STATE.is_drawing) return;
    
    UI_STATE.is_drawing = false;
    UI_STATE.draw_start_x = null;
    UI_STATE.draw_start_y = null;
    UI_STATE.draw_x = null;
    UI_STATE.draw_y = null;
    if (UI_STATE.draw_patterns.length === 1 && 
        UI_STATE.draw_patterns[0].id === 'play' &&
        OPTIONS.run_after_change) {
        // run the action after drawing
        console.log("Running after drawing...");
        do_action(ACTIONS.find(a => a.id === 'run_all').action, 'run_all');
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

function value_to_color(value) { 
    if (value === -1) return "transparent"; // wildcard
    return PIXEL_PALLETTE[value] || "magenta";
}

function contrast_to_color(value) {
    if (value === -1) return "white";
    return TEXT_ON_PIXEL_PALLETTE[value] || "purple";
}

function draw_pattern_to_canvas(pattern, canvas) {
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