function blank_pattern(w = TILE_SIZE, h = TILE_SIZE) {
    return {
        id: generate_id(),
        width: w, 
        height: h,
        pixels: Array.from({ length: h }, () => Array(w).fill(0))
    };
}

function initial_rule() {
    function blank_pattern(w = TILE_SIZE, h = TILE_SIZE) {
        return {
            id: generate_id('pat'),
            width: w, 
            height: h,
            pixels: Array.from({ length: h }, () => Array(w).fill(0))
        };
    }

    rules.push({
        id: generate_id('rule'),
        parts: [
            {
                id: generate_id('part'),
                patterns: [blank_pattern(), blank_pattern()]
            },
        ]
    });
}

function get_selected_rule_objects() {
    const path = ui_state.selected_path;
    if (!path) return {};

    const rule = rules.find(r => r.id === path.rule_id);
    if (!rule) return {};

    const part = path.part_id ? rule.parts.find(p => p.id === path.part_id) : null;
    const pattern = (part && path.pattern_id) ? part.patterns.find(pat => pat.id === path.pattern_id) : null;

    return { rule, part, pattern };
}

function duplicate_selection() {
    const path = ui_state.selected_path;
    if (!path) return;

    const { rule, part, pattern } = get_selected_rule_objects();

    if (path.pattern_id && part) {
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        const new_pattern = deep_clone_with_ids(pattern);
        part.patterns.splice(index + 1, 0, new_pattern);
        ui_state.selected_path = {
            rule_id: path.rule_id,
            part_id: path.part_id,
            pattern_id: new_pattern.id
        };

    } else if (path.part_id && rule) {
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        const new_part = deep_clone_with_ids(part);
        rule.parts.splice(index + 1, 0, new_part);
        ui_state.selected_path = {
            rule_id: path.rule_id,
            part_id: new_part.id
        };

    } else if (path.rule_id) {
        const index = rules.findIndex(r => r.id === path.rule_id);
        const new_rule = deep_clone_with_ids(rule);
        rules.splice(index + 1, 0, new_rule);
        ui_state.selected_path = {
            rule_id: new_rule.id
        };
    }

    render_all_rules();
    render_rules_selection(path, ui_state.selected_path);
    console.log('duplicated selection', ui_state.selected_path);
}

function delete_selection() {
    const path = ui_state.selected_path;
    if (!path) return;

    const { rule, part, pattern } = get_selected_rule_objects();

    if (path.pattern_id && part) {
        if (part.patterns.length <= 2) return; // keep at least 2 patterns
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        part.patterns.splice(index, 1);
    } else if (path.part_id && rule) {
        if (rule.parts.length <= 1) return; // keep at least 1 part
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        rule.parts.splice(index, 1);
    } else if (path.rule_id) {
        if (rules.length <= 1) return; // keep at least 1 rule
        const index = rules.findIndex(r => r.id === path.rule_id);
        rules.splice(index, 1);
    }
    render_all_rules();
    ui_state.selected_path = null;
}


function reorder_selection(direction) {
    const path = ui_state.selected_path;
    if (!path) return;

    const { rule, part, pattern } = get_selected_rule_objects();

    if (path.pattern_id && part) {
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        const target = index + direction;
        if (target < 0 || target >= part.patterns.length) return;

        [part.patterns[index], part.patterns[target]] = [part.patterns[target], part.patterns[index]];
    } else if (path.part_id && rule) {
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        const target = index + direction;
        if (target < 0 || target >= rule.parts.length) return;

        [rule.parts[index], rule.parts[target]] = [rule.parts[target], rule.parts[index]];
    }
    else if (path.rule_id) {
        const index = rules.findIndex(r => r.id === path.rule_id);
        const target = index + direction;
        if (target < 0 || target >= rules.length) return;

        [rules[index], rules[target]] = [rules[target], rules[index]];
    }
    render_all_rules();
    // path did not change, but force re-render because it moved
    render_rules_selection(null, ui_state.selected_path);
    console.log('reordered selection', ui_state.selected_path);
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