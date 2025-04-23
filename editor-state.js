// init rules

function set_default_rules() {
    PROJECT.rules.push({
        id: generate_id('rule'),
        parts: [
            {
                id: generate_id('part'),
                patterns: [blank_pattern(), blank_pattern()]
            },
        ]
    });
    // add dot to the second pattern
    const middle_coord = Math.floor(PROJECT.tile_size / 2);
    PROJECT.rules[0].parts[0].patterns[1].pixels[middle_coord][middle_coord] = 1;
}

function blank_pattern(w = PROJECT.tile_size, h = PROJECT.tile_size) {
    return {
        id: generate_id('pat'),
        width: w, 
        height: h,
        pixels: Array.from({ length: h }, () => Array(w).fill(0))
    };
}

function generate_id(prefix = "id") {
    // use the date and a counter (stored in PROJECT.rules) to generate a unique id
    return `${prefix}_${Date.now().toString(36)}_${(PROJECT.editor_obj_id_counter++).toString(36)}`;
}

// refresh ids when a rule is duplicated
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

// selection ids -> rule, part, pattern objects
function get_selected_rule_objects(sel) {
    const object_groups = [];
    sel.paths.forEach(path => {
        const rule = PROJECT.rules.find(r => r.id === path.rule_id);
        if (!rule) return;

        const part = path.part_id ? rule.parts.find(p => p.id === path.part_id) : null;
        const pattern = (part && path.pattern_id) ? part.patterns.find(pat => pat.id === path.pattern_id) : null;
        object_groups.push({ rule, part, pattern });
    });
    return object_groups;
}

// selection ids -> selected pattern objects
function get_selected_rule_patterns(sel) {
    const found_patterns = new Set();
    const object_groups = get_selected_rule_objects(sel);

    object_groups.forEach(({ rule, part, pattern }) => {
        if (pattern) {
            found_patterns.add(pattern);
        } else if (part) {
            part.patterns.forEach(p => found_patterns.add(p));
        } else if (rule) {
            rule.parts.forEach(p => p.patterns.forEach(pat => found_patterns.add(pat)));
        }
    });
    return [...found_patterns];
}


// functions that modify the state of the rules and play_pattern, usually based on the selected objects.
// called from actions.js, they return:
// - new_selected (like PROJECT.selected) to be set in the state
// - render_ids ([] of rule_id) or render_type ('play' | 'rules') to be rendered.

function duplicate_selection(sel) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };
    output.new_selected.paths = [];

    if (sel.type === 'pattern') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part, pattern }) => {
            const insert_index = part.patterns.findIndex(p => p.id === pattern.id) + 1;
            const new_pattern = deep_clone_with_ids(pattern);
            part.patterns.splice(insert_index, 0, new_pattern);
            output.new_selected.paths.push({ rule_id: rule.id, part_id: part.id, pattern_id: new_pattern.id });
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'part') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part }) => {
            const insert_index = rule.parts.findIndex(p => p.id === part.id) + 1;
            const new_part = deep_clone_with_ids(part);
            rule.parts.splice(insert_index, 0, new_part);
            output.new_selected.paths.push({ rule_id: rule.id, part_id: new_part.id });
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'rule') {
        output.render_type = 'rules';
        object_groups.forEach(({ rule }) => {
            const insert_index = PROJECT.rules.findIndex(r => r.id === rule.id) + 1;
            const new_rule = deep_clone_with_ids(rule);
            PROJECT.rules.splice(insert_index, 0, new_rule);
            output.new_selected.paths.push({ rule_id: new_rule.id });
        });
        return output;
    }
}

function delete_selection(sel) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };
    output.new_selected.paths = [];

    // each deletion can silently fail. in those cases, the patterns should remain selected.
    // otherwise, select the previous pattern, part or rule, if available.
    // if not, don't select anything.

    // TODO: selecting all the previous patterns can break because those might themselves be deleted???

    if (sel.type === 'pattern') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part, pattern }) => {
            const index = part.patterns.findIndex(p => p.id === pattern.id);
            const sel_path = { rule_id: rule.id, part_id: part.id, pattern_id: pattern.id };
            if (part.patterns.length <= 2) { // keep at least 2 patterns
                output.new_selected.paths.push(sel_path);
                return;
            }
            part.patterns.splice(index, 1);
            output.render_ids.add(rule.id);
            if (part.patterns[index - 1]) {
                sel_path.pattern_id = part.patterns[index - 1].id;
                output.new_selected.paths.push(sel_path);
            } 
        });
        return output;
    } else if (sel.type === 'part') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part }) => {
            const index = rule.parts.findIndex(p => p.id === part.id);
            const sel_path = { rule_id: rule.id, part_id: part.id };
            if (rule.parts.length <= 1) { // keep at least 1 part
                output.new_selected.paths.push(sel_path);
                return;
            }
            rule.parts.splice(index, 1);
            output.render_ids.add(rule.id);
            if (rule.parts[index - 1]) {
                sel_path.part_id = rule.parts[index - 1].id;
                output.new_selected.paths.push(sel_path);
            }
        });
        return output;
    } else if (sel.type === 'rule') {
        output.render_type = 'rules';
        object_groups.forEach(({ rule }) => {
            const index = PROJECT.rules.findIndex(r => r.id === rule.id);
            const sel_path = { rule_id: rule.id };
            if (PROJECT.rules.length <= 1) { // keep at least 1 rule
                output.new_selected.paths.push(sel_path);
                return;
            }
            PROJECT.rules.splice(index, 1);
            if (PROJECT.rules[index - 1]) {
                sel_path.rule_id = PROJECT.rules[index - 1].id;
                output.new_selected.paths.push(sel_path);
            }
        });
        return output;
    }
}

function reorder_selection(sel, direction) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };

    // TODO: weird things could happen with adjacent selected objects being reordered at the same time.

    if (sel.type === 'pattern') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part, pattern }) => {
            const index = part.patterns.findIndex(p => p.id === pattern.id);
            const target = index + direction;
            if (target < 0 || target >= part.patterns.length) return;
            [part.patterns[index], part.patterns[target]] = [part.patterns[target], part.patterns[index]];
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'part') {
        output.render_type = 'rule';
        object_groups.forEach(({ rule, part }) => {
            const index = rule.parts.findIndex(p => p.id === part.id);
            const target = index + direction;
            if (target < 0 || target >= rule.parts.length) return;
            [rule.parts[index], rule.parts[target]] = [rule.parts[target], rule.parts[index]];
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'rule') {
        output.render_type = 'rules';
        object_groups.forEach(({ rule }) => {
            const index = PROJECT.rules.findIndex(r => r.id === rule.id);
            const target = index + direction;
            if (target < 0 || target >= PROJECT.rules.length) return;
            [PROJECT.rules[index], PROJECT.rules[target]] = [PROJECT.rules[target], PROJECT.rules[index]];
        });
        return output;
    }
}

function clear_selection(sel) {
    if (sel.type === null) return;

    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };

    if (sel.type === 'play') {
        const pattern = PROJECT.play_pattern;
        pattern.pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
        output.render_type = 'play';
        return output;
    }

    const object_groups = get_selected_rule_objects(sel);
    output.render_type = 'rule';
    
    if (sel.type === 'pattern') {
        object_groups.forEach(({ rule, part, pattern }) => {
            // reset pattern to empty
            pattern.pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'part') {
        object_groups.forEach(({ rule, part }) => {
            // reset part to initial state
            part.patterns = [blank_pattern(), blank_pattern()];
            output.render_ids.add(rule.id);
        });
        return output;
    } else if (sel.type === 'rule') {
        object_groups.forEach(({ rule }) => {
            // reset rule to initial state
            rule.parts = [{
                id: generate_id('part'),
                patterns: [blank_pattern(), blank_pattern()]
            }];
            output.render_ids.add(rule.id);
        });
        return output;
    }
}

function rotate_patterns_in_selection(sel) {
    if (sel.type === null) return;

    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };

    if (sel.type === 'play') {
        rotate_pattern(PROJECT.play_pattern, 1);
        output.render_type = 'play';
        return output;
    }

    const patterns = get_selected_rule_patterns(sel);
    let rotate_times = 1;

    // if individual patterns are selected and any of the patterns are non-square, rotate twice
    // TODO: this might feel weird and could be more elaborate
    if (sel.type === 'pattern') {
        patterns.forEach(pattern => {
            if (pattern.width !== pattern.height) rotate_times = 2;
        });
    }

    if (patterns.length) {
        output.render_type = 'rule';
        patterns.forEach(pattern => {
            rotate_pattern(pattern, rotate_times);
        });
        // also loop through the rules to know what to render
        get_selected_rule_objects(sel).forEach(({ rule }) => {
            output.render_ids.add(rule.id);
        });
        return output;
    }
}

function resize_patterns_in_selection(sel, x_direction, y_direction) {
    if (sel.type === null) return;

    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };
    const tile_size = PROJECT.tile_size;

    if (sel.type === 'play') {
        const new_width = Math.max(tile_size, PROJECT.play_pattern.width + x_direction * tile_size);
        const new_height = Math.max(tile_size, PROJECT.play_pattern.height + y_direction * tile_size);
        resize_pattern(PROJECT.play_pattern, new_width, new_height);
        output.render_type = 'play';
        return output;
    }

    const sel_for_resize = structuredClone(sel);
    // remove the pattern_id from the selections to resize all patterns in the parts
    sel_for_resize.paths.forEach(path => {
        if (path.pattern_id) {
            path.pattern_id = undefined;
        }
    });

    const patterns = get_selected_rule_patterns(sel_for_resize);
    if (patterns.length) {
        output.render_type = 'rule';
        patterns.forEach(pattern => {
            const new_width = Math.max(tile_size, pattern.width + x_direction * tile_size);
            const new_height = Math.max(tile_size, pattern.height + y_direction * tile_size);
            resize_pattern(pattern, new_width, new_height);
        });
        // also loop through the rules to know what to render
        get_selected_rule_objects(sel).forEach(({ rule }) => {
            output.render_ids.add(rule.id);
        });
        return output;
    }
}

function shift_patterns_in_selection(sel, x_direction, y_direction) {
    if (sel.type === null) return;

    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };

    if (sel.type === 'play') {
        shift_pattern(PROJECT.play_pattern, x_direction, y_direction);
        output.render_type = 'play';
        return output;
    }

    const patterns = get_selected_rule_patterns(sel);
    if (patterns.length) {
        output.render_type = 'rule';
        patterns.forEach(pattern => shift_pattern(pattern, x_direction, y_direction));
        // also loop through the rules to know what to render
        get_selected_rule_objects(sel).forEach(({ rule }) => {
            output.render_ids.add(rule.id);
        });
        return output;
    }
}

function flip_patterns_in_selection(sel, h_bool, v_bool) {
    if (sel.type === null) return;

    const output = { new_selected: structuredClone(sel), render_type: null, render_ids: new Set() };

    if (sel.type === 'play') {
        if (h_bool) flip_pattern(PROJECT.play_pattern, true);
        if (v_bool) flip_pattern(PROJECT.play_pattern, false);
        output.render_type = 'play';
        return output;
    }
    
    const patterns = get_selected_rule_patterns(sel);
    if (patterns.length) {
        output.render_type = 'rule';
        patterns.forEach(pattern => {
            if (h_bool) flip_pattern(pattern, true);
            if (v_bool) flip_pattern(pattern, false);
        });
        // also loop through the rules to know what to render
        get_selected_rule_objects(sel).forEach(({ rule }) => {
            output.render_ids.add(rule.id);
        });
        return output;
    }
}


// Pattern manipulation functions

function draw_in_pattern(pattern, x, y, tool, ui_state) {
    if (!pattern) return;

    if (tool === 'brush') {
        pattern.pixels[y][x] = ui_state.draw_value;
        return;
    }

    if (tool === 'rect') {
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

    if (tool === 'line') {
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

    if (tool === 'fill') {
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