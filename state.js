function blank_pattern(w = TILE_SIZE, h = TILE_SIZE) {
    return {
        width: w, height: h,
        pixels: Array.from({ length: h }, () => Array(w).fill(0))
    };
}

function add_rule(index = rules.length, original = null) {
    const new_rule = (original) ? structuredClone(original) : [
        [ blank_pattern(), blank_pattern() ] // sinple part with before and after pattern
    ];
    rules.splice(index, 0, new_rule);
}

function duplicate_selection() {
    if (!ui_state.selected_path) { return; }
    if (ui_state.selected_path.length === 1) {
        add_rule(ui_state.selected_path[0] + 1, rules[ui_state.selected_path[0]]);
        rules_ui_set_selection([ui_state.selected_path[0] + 1]);
        render_all_rules();
    }
}

function delete_selection() {
    if (!ui_state.selected_path) { return; }
    if (ui_state.selected_path.length === 1) {
        if (rules.length === 1) { return; } // can't delete last rule
        rules.splice(ui_state.selected_path[0], 1);
        rules_ui_set_selection([]);
        render_all_rules();
    } else if (ui_state.selected_path.length === 2) {
        const rule = rules[ui_state.selected_path[0]];
        if (rule.length === 1) { return; } // can't delete last part
        rule.splice(ui_state.selected_path[1], 1);
        rules_ui_set_selection([]);
        render_all_rules();
    }
}

function reorder_selection(direction) {
    if (!ui_state.selected_path) { return; }
    // TODO
}

function clear_selection() {
    // TODO
}

function rotate_patterns_in_selection() {
    // TODO
}

function resize_patterns_in_selection(x_direction, y_direction) {
    // TODO
}

function shift_patterns_in_selection(x_direction, y_direction) {
    // TODO
}