const DEFAULT_PATTERN_SIZE = TILE_SIZE;

// basic rules structure
function blank_pattern(w = DEFAULT_PATTERN_SIZE, h = DEFAULT_PATTERN_SIZE) {
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
    // add dot to the second pattern
    const middle_coord = Math.floor(DEFAULT_PATTERN_SIZE / 2);
    rules[0].parts[0].patterns[1].pixels[middle_coord][middle_coord] = 1;
}

function generate_id(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${(id_counter++).toString(36)}`;
}


// each rule, each part, each pattern gets a new id when cloned
function deep_clone_with_ids(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deep_clone_with_ids);
    } else if (obj && typeof obj === 'object') {
        const copy = {};
        for (const key in obj) {
            copy[key] = deep_clone_with_ids(obj[key]);
        }
        if ("pixels" in copy) {
            copy.id = generate_id("pat");
        } else if ("patterns" in copy) {
            copy.id = generate_id("part");
        } else if ("parts" in copy) {
            copy.id = generate_id("rule");
        }
        return copy;
    }
    return obj;
}

// use the path to get the actual rule, part, pattern objects in the rules object
function get_selected_rule_objects(path) {
    if (!path) return {};

    const rule = rules.find(r => r.id === path.rule_id);
    if (!rule) return {};

    const part = path.part_id ? rule.parts.find(p => p.id === path.part_id) : null;
    const pattern = (part && path.pattern_id) ? part.patterns.find(pat => pat.id === path.pattern_id) : null;

    return { rule, part, pattern };
}

// get all patterns in the selection path
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

// actions
// functions that modify the state of the rules and play_pattern, usually based on the selection path.
// they return 
// - new_path (modified or unmodified path object to be selected)
// - render: 'play' | 'rules' | rule_id (to be rendered)

function duplicate_selection(path) {
    if (!path || path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

    if (path.pattern_id && part) {
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        const new_pattern = deep_clone_with_ids(pattern);
        part.patterns.splice(index + 1, 0, new_pattern);
        return { new_path: { ...path, pattern_id: new_pattern.id }, render: path.rule_id };

    } else if (path.part_id && rule) {
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        const new_part = deep_clone_with_ids(part);
        rule.parts.splice(index + 1, 0, new_part);
        return { new_path: { ...path, part_id: new_part.id }, render: path.rule_id };

    } else if (path.rule_id) {
        const index = rules.findIndex(r => r.id === path.rule_id);
        const new_rule = deep_clone_with_ids(rule);
        rules.splice(index + 1, 0, new_rule);
        return { new_path: { ...path, rule_id: new_rule.id }, render: 'rules' };
    }
}

function delete_selection(path) {
    if (!path || path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

    if (path.pattern_id && part) {
        if (part.patterns.length <= 2) return; // keep at least 2 patterns
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        part.patterns.splice(index, 1);
        const new_path = part.patterns[index - 1] ? { ...path, pattern_id: part.patterns[index - 1].id } : null;
        return { new_path, render: path.rule_id };

    } else if (path.part_id && rule) {
        if (rule.parts.length <= 1) return; // keep at least 1 part
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        rule.parts.splice(index, 1);
        const new_path = rule.parts[index - 1] ? { ...path, part_id: rule.parts[index - 1].id } : null;
        return { new_path, render: path.rule_id };

    } else if (path.rule_id) {
        if (rules.length <= 1) return; // keep at least 1 rule
        const index = rules.findIndex(r => r.id === path.rule_id);
        rules.splice(index, 1);
        const new_path = rules[index - 1] ? { ...path, rule_id: rules[index - 1].id } : null;
        return { new_path, render: 'rules' };
    }
}

function reorder_selection(path, direction) {
    if (!path || path.pattern_id === 'play') return;

    const { rule, part, pattern } = get_selected_rule_objects(path);

    if (path.pattern_id && part) {
        const index = part.patterns.findIndex(p => p.id === path.pattern_id);
        const target = index + direction;
        if (target < 0 || target >= part.patterns.length) return;
        [part.patterns[index], part.patterns[target]] = [part.patterns[target], part.patterns[index]];
        return { new_path: path, render: path.rule_id };

    } else if (path.part_id && rule) {
        const index = rule.parts.findIndex(p => p.id === path.part_id);
        const target = index + direction;
        if (target < 0 || target >= rule.parts.length) return;
        [rule.parts[index], rule.parts[target]] = [rule.parts[target], rule.parts[index]];
        return { new_path: path, render: path.rule_id };

    } else if (path.rule_id) {
        const index = rules.findIndex(r => r.id === path.rule_id);
        const target = index + direction;
        if (target < 0 || target >= rules.length) return;
        [rules[index], rules[target]] = [rules[target], rules[index]];
        return { new_path: path, render: 'rules' };
    }
}

function clear_selection(path) {
    if (!path) return;

    if (path.pattern_id === 'play') {
        play_pattern.pixels = Array.from({ length: play_pattern.height }, () => Array(play_pattern.width).fill(0));
        return { new_path: path, render: 'play' };
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
    } else { return; }
    return { new_path: path, render: path.rule_id };
}

function rotate_patterns_in_selection(path) {
    if (!path) return;

    if (path.pattern_id === 'play') {
        rotate_pattern(play_pattern, 1);
        return { new_path: path, render: 'play' };
    }

    if (path.rule_id) {
        let rotate_times = 1;
        if (path.pattern_id) {
            // a non-square pattern selected individually has to be rotated twice so the width and height are correct
            const { pattern } = get_selected_rule_objects(path);
            if (pattern.width !== pattern.height) rotate_times = 2;
        }
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => rotate_pattern(pattern, rotate_times));
        return { new_path: path, render: path.rule_id };
    } 
}

function resize_patterns_in_selection(path, x_direction, y_direction) {
    if (!path) return;

    if (path.pattern_id === 'play') {
        const new_width = Math.max(TILE_SIZE, play_pattern.width + x_direction * TILE_SIZE);
        const new_height = Math.max(TILE_SIZE, play_pattern.height + y_direction * TILE_SIZE);
        resize_pattern(play_pattern, new_width, new_height);
        return { new_path: path, render: 'play' };
    }

    if (path.rule_id) {
        const path_for_resize = { ...path };
        path_for_resize.pattern_id = undefined; // resize all patterns in the part
        const patterns = get_selected_rule_patterns(path_for_resize);
        patterns.forEach(pattern => {
            const new_width = Math.max(TILE_SIZE, pattern.width + x_direction * TILE_SIZE);
            const new_height = Math.max(TILE_SIZE, pattern.height + y_direction * TILE_SIZE);
            resize_pattern(pattern, new_width, new_height);
        });
        return { new_path: path, render: path.rule_id };
    } 
}

function shift_patterns_in_selection(path, x_direction, y_direction) {
    if (!path) return;

    if (path.pattern_id === 'play') {
        shift_pattern(play_pattern, x_direction, y_direction);
        return { new_path: path, render: 'play' };
    }

    if (path.rule_id) {
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => shift_pattern(pattern, x_direction, y_direction));
        return { new_path: path, render: path.rule_id };
    }
}

function flip_patterns_in_selection(path, h_bool, v_bool) {
    if (!path) return;

    if (path.pattern_id === 'play') {
        if (h_bool) flip_pattern(play_pattern, true);
        if (v_bool) flip_pattern(play_pattern, false);
        return { new_path: path, render: 'play' };
    }
    
    if (path.rule_id) {
        const patterns = get_selected_rule_patterns(path);
        patterns.forEach(pattern => {
            if (h_bool) flip_pattern(pattern, true);
            if (v_bool) flip_pattern(pattern, false);
        });
        return { new_path: path, render: path.rule_id };
    }
}


// Pattern manipulation functions

function draw_in_pattern(pattern, x, y, ui_state) {
    if (!pattern) return;

    if (ui_state.selected_tool === 'brush') {
        pattern.pixels[y][x] = ui_state.draw_value;
        return;
    }

    if (ui_state.selected_tool === 'rect') {
        const fromX = Math.min(ui_state.draw_start_x, x);
        const fromY = Math.min(ui_state.draw_start_y, y);
        const toX   = Math.max(ui_state.draw_start_x, x);
        const toY   = Math.max(ui_state.draw_start_y, y);

        for (let row = fromY; row <= toY; row++) {
            for (let col = fromX; col <= toX; col++) {
                pattern.pixels[row][col] = ui_state.draw_value;
            }
        }
        return;
    }

    if (ui_state.selected_tool === 'line') {
        let fromX = ui_state.draw_start_x;
        let fromY = ui_state.draw_start_y;
        const toX = x;
        const toY = y;

        const dx = Math.abs(toX - fromX);
        const dy = Math.abs(toY - fromY);
        const sx = (fromX < toX) ? 1 : -1;
        const sy = (fromY < toY) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            pattern.pixels[fromY][fromX] = ui_state.draw_value;
            if (fromX === toX && fromY === toY) break;
            const err2 = err * 2;
            if (err2 > -dy) { err -= dy; fromX += sx; }
            if (err2 < dx)  { err += dx; fromY += sy; }
        }
        return;
    }

    if (ui_state.selected_tool === 'fill') {
        const target_color = pattern.pixels[y][x];
        if (target_color === ui_state.draw_value) return;

        const stack = [[x, y]];
        while (stack.length > 0) {
            const [px, py] = stack.pop();
            if (px < 0 || px >= pattern.width || py < 0 || py >= pattern.height) continue;
            if (pattern.pixels[py][px] !== target_color) continue;
            pattern.pixels[py][px] = ui_state.draw_value;
            stack.push([px + 1, py]);
            stack.push([px - 1, py]);
            stack.push([px, py + 1]);
            stack.push([px, py - 1]);
        }
    }
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