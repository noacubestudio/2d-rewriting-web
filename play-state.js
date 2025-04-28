// initial state of the play_pattern (main grid, where the rules are applied)

function set_default_play_pattern(w = 8, h = 8) {
    const cells_width = w * PROJECT.tile_size;
    const cells_height = h * PROJECT.tile_size;

    PROJECT.play_pattern = {
        id: 'play',
        width: cells_width,
        height: cells_height,
        pixels: Array.from({ length: cells_height }, () => Array(cells_width).fill(0))
    };
}

// functions that modify the play_pattern only.

function apply_rules(sel) {
    const group_loop_limit = RULE_APPLICATION_LIMIT;
    const stats = {
        application_count: 0,
        failed_count: 0,
        groups_application_count: 0,
        groups_failed_count: 0,
        groups_that_hit_limit: [],
    };

    // if there are certain rules selected, only apply those rules.
    // return groups of rules (id, rules) to be applied.
    const ruleset = process_rules(PROJECT.rules, sel);
    console.log("Ruleset:", ruleset);

    ruleset.forEach(({ id, rules }) => {
        // the id is the rule id that expanded into a group of rules.

        // loop each group of rules before going to the next group.
        // currently, loops are only generated for rotated rules.

        let rule_index = 0;
        let group_application_count = 0;
        let group_failed_count = 0;
        while (group_application_count < group_loop_limit && rule_index < rules.length) {
            const rule = rules[rule_index];
            let rule_success = apply_rule(rule);
            if (rule_success) {
                group_application_count++;
                rule_index = 0; // reset to start of group
            } else {
                group_failed_count++;
                rule_index++; // try the next rule in the group
            }
        }
        // add to the total number of applications and misses.
        // add to the count of how many groups were applied and failed.
        stats.application_count += group_application_count;
        stats.failed_count += group_failed_count;
        if (group_application_count >= 1) {
            stats.groups_application_count++;
            if (group_application_count >= group_loop_limit) stats.groups_that_hit_limit.push(id);
        } else {
            stats.groups_failed_count++;
        }
    });

    return stats;
}

function process_rules(rules, sel) {
    const ruleset = [];

    // get selected rule ids from the selection, otherwise use all rules
    let selected_rule_ids = null;
    if (sel) {
        if (sel.type === null || sel.type === 'play') return;
        const object_groups = get_selected_rule_objects(sel);
        selected_rule_ids = new Set(object_groups.map((obj) => obj.rule.id));
        if (selected_rule_ids.size === 0) return;
    }

    rules.forEach((rule) => {
        // skip if the rule is not selected
        if (selected_rule_ids && !selected_rule_ids.has(rule.id)) return;

        // start a new group if the rule is not part of one already.
        // if it is part, keep adding to the last group.
        const group = (rule.part_of_group) ? ruleset[ruleset.length - 1] : { id: rule.id, rules: [] };
        group.rules.push(rule);

        // add other 3 rotated versions of the rule
        if (rule.rotate) {
            let next_rule_version = rule;
            for (let i = 0; i < 3; i++) {
                next_rule_version = structuredClone(next_rule_version);
                get_rule_patterns(next_rule_version).forEach((p) => { rotate_pattern(p); });
                group.rules.push(next_rule_version);
            }
        }
        if (!rule.part_of_group) ruleset.push(group); // add new group to the ruleset
    });
    return ruleset;
}

function apply_rule(rule) {
    let target_pattern = PROJECT.play_pattern;
    
    // find a match for the initial pattern of every part in the play_pattern
    const part_matches = [];
    rule.parts.forEach((part) => {
        const part_pattern = part.patterns[0];
        const { x, y } = find_pattern_in_target(part_pattern, target_pattern);
        if (x === -1 || y === -1) return; // no match found
        part_matches.push({ part, x, y });
    });

    if (part_matches.length < rule.parts.length) {
        return false;
    }

    // apply the rule to the play_pattern
    apply_matches_in_target(part_matches, target_pattern);
    return true;
}

function find_pattern_in_target(pattern, target) {
    for (let y = 0; y <= target.height - pattern.height; y += PROJECT.tile_size) {
        for (let x = 0; x <= target.width - pattern.width; x += PROJECT.tile_size) {
            if (is_pattern_match(pattern, target, x, y)) {
                return { x, y };
            }
        }
    }
    return { x: -1, y: -1 }; // no match found
}

function is_pattern_match(pattern, target, x, y) {
    for (let py = 0; py < pattern.height; py++) {
        for (let px = 0; px < pattern.width; px++) {
            const target_pixel = target.pixels[y + py][x + px];
            const pattern_pixel = pattern.pixels[py][px];
            if (target_pixel !== pattern_pixel && target_pixel >= 0 && pattern_pixel >= 0) {
                return false;
            }
        }
    }
    return true;
}

function apply_matches_in_target(part_matches, target) {
    part_matches.forEach(({ part, x, y }) => {
        // random pattern except the first one, which is the before state
        const random_replace_index = 1 + Math.floor(Math.random() * (part.patterns.length - 1));
        const pattern = part.patterns[random_replace_index];
        for (let py = 0; py < pattern.height; py++) {
            for (let px = 0; px < pattern.width; px++) {
                const pattern_pixel = pattern.pixels[py][px];
                if (pattern_pixel === -1) continue; // skip empty pixels
                target.pixels[y + py][x + px] = pattern.pixels[py][px];
            }
        }
    });
}