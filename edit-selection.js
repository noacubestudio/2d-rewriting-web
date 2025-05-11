import { PROJECT } from "./state.js";
import { generate_id, get_blank_pattern } from "./utils.js";
import { rotate_pattern, resize_pattern, shift_pattern, flip_pattern } from "./edit-pattern.js";

/** @typedef {import('./state.js').Selection} Selection */
/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Part} Part */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').Rule_Flag_Key} Rule_Flag_Key */


/**
 * Refresh ids when a rule is duplicated
 * @template T
 * @param {T & (Rule | Part | Pattern)} obj - The object to clone
 * @returns {T & (Rule | Part | Pattern)} - The cloned object with updated ids
 */
function deep_clone_with_ids(obj) {
    if (Array.isArray(obj)) {
        // @ts-ignore
        return obj.map(item => deep_clone_with_ids(item));

    } else if (obj && typeof obj === 'object' && 'id' in obj) {
        const copy = /** @type {T & (Rule | Part | Pattern)} */({});
        for (const key in obj) {
            // @ts-ignore
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

/** 
 * @param {Selection} sel
 */
export function get_selected_rule_objects(sel) {
    /** @type {{ rule: Rule, part: Part | null, pattern: Pattern | null }[]} */
    const object_groups = [];
    sel.paths.forEach(path => {
        const rule = PROJECT.rules.find(r => r.id === path.rule_id);
        if (!rule) return;

        const part = rule.parts.find(p => p.id === path.part_id) ?? null;
        const pattern = (part ? part.patterns.find(pat => pat.id === path.pattern_id) : null) ?? null;
        object_groups.push({ rule, part, pattern });
    });
    return object_groups;
}

/** 
 * @param {Selection} sel 
 * @returns {Pattern[]}
 */
export function get_selected_rule_patterns(sel) {
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

// after rules move around, make sure they stay valid.
function keep_rules_valid() {
    // first rule is never part of a group
    PROJECT.rules[0].part_of_group = false;
}



// functions that modify the state of the rules and play_pattern, usually based on the selected objects.

/**
 * Returns updated selection and information about what to render.
 * @typedef {Object} Selection_Edit_Output
 * @property {Selection} new_selected - new selection object to be set in the state
 * @property {Set<string>} render_ids - set of rule ids to be rendered
 * @property {boolean} render_play - whether to render the play pattern
 * @property {boolean} [reordered] - whether rules were reodered
*/

/** 
 * @param {Selection} sel 
 * @returns {Selection_Edit_Output | undefined}
 */
export function duplicate_sel(sel) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };
    output.new_selected.paths = [];

    if (sel.type === 'pattern') {
        object_groups.forEach(({ rule, part, pattern }) => {
            if (!part || !pattern) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            const insert_index = part.patterns.findIndex(p => p.id === pattern.id) + 1;
            const new_pattern = deep_clone_with_ids(pattern);
            part.patterns.splice(insert_index, 0, new_pattern);
            output.new_selected.paths.push({ rule_id: rule.id, part_id: part.id, pattern_id: new_pattern.id });
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'part') {
        object_groups.forEach(({ rule, part }) => {
            if (!part) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            const insert_index = rule.parts.findIndex(p => p.id === part.id) + 1;
            const new_part = deep_clone_with_ids(part);
            rule.parts.splice(insert_index, 0, new_part);
            output.new_selected.paths.push({ rule_id: rule.id, part_id: new_part.id });
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'rule') {
        object_groups.forEach(({ rule }) => {
            const insert_index = PROJECT.rules.findIndex(r => r.id === rule.id) + 1;
            const new_rule = deep_clone_with_ids(rule);
            PROJECT.rules.splice(insert_index, 0, new_rule);
            output.new_selected.paths.push({ rule_id: new_rule.id });
            output.render_ids.add(new_rule.id);
            output.render_ids.add(rule.id); // also render original to deselect
            output.reordered = true;
        });
    } else return; // should not happen
    return output;
}

/** 
 * @param {Selection} sel 
 * @returns {Selection_Edit_Output | undefined}
 */
export function delete_sel(sel) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };
    output.new_selected.paths = [];

    // each deletion can silently fail. in those cases, the patterns should remain selected.
    // otherwise, select the previous pattern, part or rule, if available. if not, don't select anything.

    // TODO: selecting all the previous patterns can break because those might themselves be deleted???

    if (sel.type === 'pattern') {
        object_groups.forEach(({ rule, part, pattern }) => {
            if (!part || !pattern) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            const index = part.patterns.findIndex(p => p.id === pattern.id);
            const sel_path = { rule_id: rule.id, part_id: part.id, pattern_id: pattern.id };
            if (part.patterns.length <= 1) { // keep at least 1 pattern
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
    } else if (sel.type === 'part') {
        object_groups.forEach(({ rule, part }) => {
            if (!part) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
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
    } else if (sel.type === 'rule') {
        object_groups.forEach(({ rule }) => {
            const index = PROJECT.rules.findIndex(r => r.id === rule.id);
            const sel_path = { rule_id: rule.id };
            if (PROJECT.rules.length <= 1) { // keep at least 1 rule
                output.new_selected.paths.push(sel_path);
                return;
            }
            output.render_ids.add(rule.id); // delete in DOM
            PROJECT.rules.splice(index, 1);
            if (PROJECT.rules[index - 1]) {
                sel_path.rule_id = PROJECT.rules[index - 1].id;
                output.new_selected.paths.push(sel_path);
                output.render_ids.add(PROJECT.rules[index - 1].id); // select in DOM
            }
            output.reordered = true;
        });
        keep_rules_valid(); // deletion can cause other rules to move
    } else return; // should not happen
    return output;
}

/** 
 * @param {Selection} sel 
 * @param {number} direction
 * @returns {Selection_Edit_Output | undefined}
 */
export function reorder_sel(sel, direction) {
    if (sel.type === null || sel.type === 'play') return;

    const object_groups = get_selected_rule_objects(sel);
    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    // TODO: weird things could happen with adjacent selected objects being reordered at the same time.

    if (sel.type === 'pattern') {
        object_groups.forEach(({ rule, part, pattern }) => {
            if (!part || !pattern) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            const index = part.patterns.findIndex(p => p.id === pattern.id);
            const target = index + direction;
            if (target < 0 || target >= part.patterns.length) return;
            [part.patterns[index], part.patterns[target]] = [part.patterns[target], part.patterns[index]];
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'part') {
        object_groups.forEach(({ rule, part }) => {
            if (!part) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            const index = rule.parts.findIndex(p => p.id === part.id);
            const target = index + direction;
            if (target < 0 || target >= rule.parts.length) return;
            [rule.parts[index], rule.parts[target]] = [rule.parts[target], rule.parts[index]];
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'rule') {
        object_groups.forEach(({ rule }) => {
            const index = PROJECT.rules.findIndex(r => r.id === rule.id);
            const target = index + direction;
            if (target < 0 || target >= PROJECT.rules.length) return;
            [PROJECT.rules[index], PROJECT.rules[target]] = [PROJECT.rules[target], PROJECT.rules[index]];
            output.render_ids.add(PROJECT.rules[index].id);
            output.render_ids.add(PROJECT.rules[target].id); // render both to swap
            output.reordered = true;
        });
        keep_rules_valid(); // movement can cause rules to become invalid in some cases
    } else return; // should not happen
    return output;
}

/** 
 * @param {Selection} sel 
 * @param {Selection} dest_sel
 * @returns {Selection_Edit_Output | undefined}
 */
export function move_sel_to_dest(sel, dest_sel) {
    if (sel.type === 'rule' || sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    // case: move play pattern into part of a rule.
    if (sel.type === 'play') {
        const object_dest = get_selected_rule_objects(dest_sel)[0];
        output.render_play = true;
        output.new_selected.paths = [];
        output.new_selected.type = 'pattern'; // change type to pattern

        // insert the play pattern into the part
        const new_pattern = deep_clone_with_ids(PROJECT.play_pattern);
        insert_pattern_at(object_dest, new_pattern);
        return output;
    }

    const objects_to_move = get_selected_rule_objects(sel);
    const object_dest = get_selected_rule_objects(dest_sel)[0];
    output.new_selected.paths = [];

    // case: move pattern(s) into part of a rule.
    if (sel.type === 'pattern') {
        objects_to_move.forEach(({ rule, part, pattern }) => {
            // ignore if not moved
            if (part?.id === object_dest.part?.id) return;

            // deletion - only if not the last pattern in the part
            if (!part || !pattern) throw new Error(`Can't remove: ${JSON.stringify(sel)}`);
            if (part.patterns.length >= 2) {
                const index = part.patterns.findIndex(p => p.id === pattern.id);
                part.patterns.splice(index, 1);
            }
            output.render_ids.add(rule.id); // deselected or removed

            // insertion
            const new_pattern = deep_clone_with_ids(pattern);
            insert_pattern_at(object_dest, new_pattern);
        });
        return output;
    }

    // case: move part(s) into a rule.
    if (sel.type === 'part') {
        objects_to_move.forEach(({ rule, part }) => {
            // ignore if not moved
            if (rule?.id === object_dest.rule?.id) return;

            // deletion - only if not the last part in the rule
            if (!part) throw new Error(`Can't remove: ${JSON.stringify(sel)}`);
            if (rule.parts.length >= 2) {
                const index = rule.parts.findIndex(p => p.id === part.id);
                rule.parts.splice(index, 1);
            }
            output.render_ids.add(rule.id); // deselected or removed

            // insertion
            const new_part = deep_clone_with_ids(part);
            insert_part_at(object_dest, new_part);
        });
        return output;
    }


    /**
     * @param {{ rule: Rule, part: Part | null, pattern: Pattern | null }} object_dest 
     * @param {Pattern} new_pattern 
     */
    function insert_pattern_at(object_dest, new_pattern) {
        if (!object_dest.part) throw new Error(`Can't insert at: ${JSON.stringify(dest_sel)}`);
        const insert_index = object_dest.part.patterns.length;
        
        object_dest.part.patterns.splice(insert_index, 0, new_pattern);
        const dest_sel_path = { rule_id: object_dest.rule.id, part_id: object_dest.part.id, pattern_id: new_pattern.id };
        output.new_selected.paths.push(dest_sel_path);
        output.render_ids.add(object_dest.rule.id);

        // if there is a dimension mismatch after the move, resize all patterns to the largest width and height
        const example_pattern = object_dest.part.patterns[0];
        if (example_pattern.width !== new_pattern.width || example_pattern.height !== new_pattern.height) {
            const new_width = Math.max(example_pattern.width, new_pattern.width);
            const new_height = Math.max(example_pattern.height, new_pattern.height);
            object_dest.part.patterns.forEach(p => {
                if (p.width !== new_width || p.height !== new_height) {
                    resize_pattern(p, new_width, new_height);
                }
            });
        }
    }

    /**
     * @param {{ rule: Rule, part: Part | null, pattern: Pattern | null }} object_dest
     * @param {Part} new_part 
     */
    function insert_part_at(object_dest, new_part) {
        if (!object_dest.rule) throw new Error(`Can't insert at: ${JSON.stringify(dest_sel)}`);
        const insert_index = object_dest.rule.parts.length;
        
        object_dest.rule.parts.splice(insert_index, 0, new_part);
        const dest_sel_path = { rule_id: object_dest.rule.id, part_id: new_part.id };
        output.new_selected.paths.push(dest_sel_path);
        output.render_ids.add(object_dest.rule.id);
    }
}

/** 
 * @param {Selection} sel 
 * @returns {Selection_Edit_Output | undefined}
 */
export function clear_sel(sel) {
    if (sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    if (sel.type === 'play') {
        const pattern = PROJECT.play_pattern;
        pattern.pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
        output.render_play = true;
        return output;
    }

    const object_groups = get_selected_rule_objects(sel);
    
    if (sel.type === 'pattern') {
        object_groups.forEach(({ rule, part, pattern }) => {
            if (!part || !pattern) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            // reset pattern to empty
            pattern.pixels = Array.from({ length: pattern.height }, () => Array(pattern.width).fill(0));
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'part') {
        object_groups.forEach(({ rule, part }) => {
            if (!part) throw new Error(`Incomplete selection: ${JSON.stringify(sel)}`);
            // reset part to initial state
            part.patterns = [get_blank_pattern(), get_blank_pattern()];
            output.render_ids.add(rule.id);
        });
    } else if (sel.type === 'rule') {
        object_groups.forEach(({ rule }) => {
            // reset rule to initial state
            rule.parts = [{
                id: generate_id('part'),
                patterns: [get_blank_pattern(), get_blank_pattern()]
            }];
            // reset certain properties
            rule.comment = undefined;
            rule.show_comment = undefined;
            rule.keybind = undefined;
            output.render_ids.add(rule.id);
        });
    } else return; // should not happen
    return output;
}

/** 
 * @param {Selection} sel
 * @param {Rule_Flag_Key} flag - flag to toggle
 * @returns {Selection_Edit_Output | undefined}
 */
export function toggle_rule_flag(sel, flag) {
    if (sel.type === null || sel.type === 'play') return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };
    const rules = get_selected_rule_objects(sel);

    rules.forEach(({ rule }) => {
        if (flag === 'part_of_group' && PROJECT.rules.findIndex(r => r.id === rule.id) === 0) return;
        rule[flag] = !rule[flag];
        output.render_ids.add(rule.id);
    });
    if (output.render_ids.size) return output;
}

/** 
 * @param {Selection} sel 
 * @returns {Selection_Edit_Output | undefined}
 */
export function rotate_patterns_in_sel(sel) {
    if (sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    if (sel.type === 'play') {
        rotate_pattern(PROJECT.play_pattern, 1);
        output.render_play = true;
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

/** 
 * @param {Selection} sel 
 * @param {number} x_direction
 * @param {number} y_direction
 * @returns {Selection_Edit_Output | undefined}
 */
export function resize_patterns_in_sel(sel, x_direction, y_direction) {
    if (sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };
    const tile_size = PROJECT.tile_size;

    if (sel.type === 'play') {
        const new_width = Math.max(tile_size, PROJECT.play_pattern.width + x_direction * tile_size);
        const new_height = Math.max(tile_size, PROJECT.play_pattern.height + y_direction * tile_size);
        resize_pattern(PROJECT.play_pattern, new_width, new_height);
        output.render_play = true;
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

/** 
 * @param {Selection} sel 
 * @param {number} x_direction
 * @param {number} y_direction
 * @returns {Selection_Edit_Output | undefined}
 */
export function shift_patterns_in_sel(sel, x_direction, y_direction) {
    if (sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    if (sel.type === 'play') {
        shift_pattern(PROJECT.play_pattern, x_direction, y_direction);
        output.render_play = true;
        return output;
    }

    const patterns = get_selected_rule_patterns(sel);
    if (patterns.length) {
        patterns.forEach(pattern => shift_pattern(pattern, x_direction, y_direction));
        // also loop through the rules to know what to render
        get_selected_rule_objects(sel).forEach(({ rule }) => {
            output.render_ids.add(rule.id);
        });
        return output;
    }
}

/**
 * @param {Selection} sel 
 * @param {boolean} h_bool - horizontal flip
 * @param {boolean} v_bool - vertical flip
 * @returns {Selection_Edit_Output | undefined}
 */
export function flip_patterns_in_sel(sel, h_bool, v_bool) {
    if (sel.type === null) return;

    /** @type {Selection_Edit_Output} */
    const output = { new_selected: structuredClone(sel), render_play: false, render_ids: new Set() };

    if (sel.type === 'play') {
        if (h_bool) flip_pattern(PROJECT.play_pattern, true);
        if (v_bool) flip_pattern(PROJECT.play_pattern, false);
        output.render_play = true;
        return output;
    }
    
    const patterns = get_selected_rule_patterns(sel);
    if (patterns.length) {
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