function blank_pattern(w = TILE_SIZE, h = TILE_SIZE) {
    return {
        id: generate_id('pat'),
        width: w, 
        height: h,
        pixels: Array.from({ length: h }, () => Array(w).fill(0))
    };
}

function initial_rule() {
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

function get_selected_rule_objects(path) {
    if (!path) return {};

    const rule = rules.find(r => r.id === path.rule_id);
    if (!rule) return {};

    const part = path.part_id ? rule.parts.find(p => p.id === path.part_id) : null;
    const pattern = (part && path.pattern_id) ? part.patterns.find(pat => pat.id === path.pattern_id) : null;

    return { rule, part, pattern };
}

function get_selected_rule_patterns(path) {
    if (!path) return [];

    if (path.pattern_id) {
        const { pattern } = get_selected_rule_objects(path);
        return pattern ? [pattern] : [];
    }

    if (path.part_id) {
        const { part } = get_selected_rule_objects(path);
        return part ? part.patterns : [];
    }

    if (path.rule_id) {
        const { rule } = get_selected_rule_objects(path);
        return rule ? rule.parts.flatMap(part => part.patterns) : [];
    }

    return [];
}

function duplicate_selection() {
    const path = ui_state.selected_path;
    if (!path) return;
    if (path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

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
    console.log('duplicated selection', ui_state.selected_path);
}

function delete_selection() {
    const path = ui_state.selected_path;
    if (!path) return;
    if (path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

    if (path.pattern_id && part) {
        if (part.patterns.length <= 2) return; // keep at least 2 patterns
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        part.patterns.splice(index, 1);
        ui_state.selected_path = part.patterns[index - 1] ? { rule_id: path.rule_id, part_id: path.part_id, pattern_id: part.patterns[index - 1].id } : null;
    } else if (path.part_id && rule) {
        if (rule.parts.length <= 1) return; // keep at least 1 part
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        rule.parts.splice(index, 1);
        ui_state.selected_path = rule.parts[index - 1] ? { rule_id: path.rule_id, part_id: rule.parts[index - 1].id } : null;
    } else if (path.rule_id) {
        if (rules.length <= 1) return; // keep at least 1 rule
        const index = rules.findIndex(r => r.id === path.rule_id);
        rules.splice(index, 1);
        ui_state.selected_path = rules[index - 1] ? { rule_id: rules[index - 1].id } : null;
    }
    render_all_rules();
}


function reorder_selection(direction) {
    const path = ui_state.selected_path;
    if (!path) return;
    if (path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

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
    } else if (path.rule_id) {
        const index = rules.findIndex(r => r.id === path.rule_id);
        const target = index + direction;
        if (target < 0 || target >= rules.length) return;

        [rules[index], rules[target]] = [rules[target], rules[index]];
    }
    render_all_rules();
    console.log('reordered selection', ui_state.selected_path);
}

function clear_selection() {
    const path = ui_state.selected_path;
    if (!path) return;

    if (path.pattern_id === 'play') {
        play_pattern.pixels = Array.from({ length: play_pattern.height }, () => Array(play_pattern.width).fill(0));
        render_play_pattern();
        console.log('cleared play pattern');
        return;
    }
    
    const { rule, part, pattern } = get_selected_rule_objects(path);
    
    if (path.pattern_id && part) {
        // reset pattern to empty
        pattern.pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
    } else if (path.part_id && rule) {
        // reset part to initial state
        part.patterns = [blank_pattern(), blank_pattern()];
    } else if (path.rule_id) {
        // reset rule to initial state
        rule.parts = [
            {
                id: generate_id('part'),
                patterns: [blank_pattern(), blank_pattern()]
            },
        ]
    }
    render_rule_by_id(path.rule_id);
    console.log('cleared selection', ui_state.selected_path);
}

function rotate_patterns_in_selection() {
    const path = ui_state.selected_path;
    if (path.rule_id) {
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => rotate_pattern(pattern, 1));
        render_rule_by_id(path.rule_id);
    } else if (path.pattern_id === 'play') {
        rotate_pattern(play_pattern, 1);
        render_play_pattern();
    }
    console.log('rotated patterns in selection', path);
}

function resize_patterns_in_selection(x_direction, y_direction) {
    const path = structuredClone(ui_state.selected_path);
    if (path.rule_id) {
        path.pattern_id = null; // to get all patterns in the rule
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => {
            const new_width = Math.max(TILE_SIZE, pattern.width + x_direction * TILE_SIZE);
            const new_height = Math.max(TILE_SIZE, pattern.height + y_direction * TILE_SIZE);
            resize_pattern(pattern, new_width, new_height);
        });
        render_rule_by_id(path.rule_id);
    } else if (path.pattern_id === 'play') {
        const new_width = Math.max(TILE_SIZE, play_pattern.width + x_direction * TILE_SIZE);
        const new_height = Math.max(TILE_SIZE, play_pattern.height + y_direction * TILE_SIZE);
        console.log('resizing play pattern', new_width, new_height);
        resize_pattern(play_pattern, new_width, new_height);
        render_play_pattern();
    }
    console.log('resized patterns in selection', path);
}

function shift_patterns_in_selection(x_direction, y_direction) {
    const path = ui_state.selected_path;
    if (path.rule_id) {
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => shift_pattern(pattern, x_direction, y_direction));
        render_rule_by_id(path.rule_id);
    } else if (path.pattern_id === 'play') {
        shift_pattern(play_pattern, x_direction, y_direction);
        render_play_pattern();
    }
    console.log('shifted patterns in selection', path);
}

function flip_patterns_in_selection(h_bool, v_bool) {
    const path = ui_state.selected_path;
    if (path.rule_id) {
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => {
            if (h_bool) flip_pattern(pattern, true);
            if (v_bool) flip_pattern(pattern, false);
        });
        render_rule_by_id(path.rule_id);
    } else if (path.pattern_id === 'play') {
        if (h_bool) flip_pattern(play_pattern, true);
        if (v_bool) flip_pattern(play_pattern, false);
        render_play_pattern();
    }
    console.log('flipped patterns in selection', path);
}


function rotate_pattern(pattern, times = 1) {
    for (let i = 0; i < times; i++) {
        const new_pixels = pattern.pixels[0].map((_, index) => pattern.pixels.map(row => row[index]).reverse());
        pattern.pixels = new_pixels;
    }
    pattern.width = pattern.pixels[0].length;
    pattern.height = pattern.pixels.length;
}

function resize_pattern(pattern, new_width, new_height, fill = 0) {
    const old_pixels = pattern.pixels;
    const old_height = old_pixels.length;
    const old_width = old_pixels[0]?.length || 0;

    const new_pixels = Array.from({ length: new_height }, (_, y) =>
        Array.from({ length: new_width }, (_, x) =>
            (y < old_height && x < old_width) ? old_pixels[y][x] : fill
        )
    );

    pattern.width = new_width;
    pattern.height = new_height;
    pattern.pixels = new_pixels;
}

function shift_pattern(pattern, x_direction, y_direction) {
    if (y_direction !== 0) {
        const new_pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
        for (let y = 0; y < pattern.height; y++) {
            const new_y = (y + y_direction + pattern.height) % pattern.height;
            new_pixels[new_y] = pattern.pixels[y];
        }
        pattern.pixels = new_pixels;
    }
    if (x_direction !== 0) {
        const new_pixels = pattern.pixels.map(row => Array.from({ length: pattern.width }, () => 0));
        for (let y = 0; y < pattern.height; y++) {
            for (let x = 0; x < pattern.width; x++) {
                const new_x = (x + x_direction + pattern.width) % pattern.width;
                new_pixels[y][new_x] = pattern.pixels[y][x];
            }
        }
        pattern.pixels = new_pixels;
    }
}

function flip_pattern(pattern, horizontal = true) {
    if (horizontal) {
        pattern.pixels = pattern.pixels.map(row => row.reverse());
    } else {
        pattern.pixels.reverse();
    }
    pattern.width = pattern.pixels[0].length;
    pattern.height = pattern.pixels.length;
}