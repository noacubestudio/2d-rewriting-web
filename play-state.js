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
    const apply_limit = RULE_APPLICATION_LIMIT;
    let application_count = 0;
    let failed_application_count = 0;
    let limit_reached_count = 0;
    let rules_checked_count = 0;

    // if there are certain rules selected, only apply those rules.
    // also do rule expansion here.
    const ruleset = process_rules(PROJECT.rules, sel);

    
    if (OPTIONS.run_in_loop) {
        // run until a single global limit is reached or until no more rules can be applied.
        // when a rule is applied, go back to the start of the ruleset.
        // when a rule can no longer be applied, go to the next rule.

        // this will probably require optimization to be reasonably fast.
        // the most obvious would be a shared cursor that doesn't have to reset to 0,0 every time.
        // it just needs to offset to the first position that overlaps with the last applied rule.

        // also, maybe it should not be possible for a pattern to match in the same place twice.

        let rule_index = 0;
        let loop_limit = apply_limit * ruleset.length; // TODO, arbitrary
        rules_checked_count = null; // TODO, hard to track.
        while (application_count < loop_limit && rule_index < ruleset.length) {
            const rule = ruleset[rule_index];
            let rule_success = apply_rule(rule);
            if (rule_success) {
                rule_index = 0;
                application_count++;
            } else {
                rule_index++;
                failed_application_count++;
            }
        }
    } else {
        // run in order
        ruleset.forEach((rule) => {
            let rule_success = true;
            let rule_application_count = 0;
            while (rule_success && rule_application_count < apply_limit) {
                rule_success = apply_rule(rule);
                rule_application_count++;
            }
            application_count += rule_application_count;
            rules_checked_count++;
            if (rule_application_count >= apply_limit) limit_reached_count++;
        });
    }

    // application was successful if at least one rule was applied.
    if (application_count > 0) {
        return { rules_checked_count, application_count, failed_application_count, limit_reached_count };
    }
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
        ruleset.push(rule);

        // add other 3 rotated versions of the rule
        if (rule.rotate) {
            let next_rule_version = rule;
            for (let i = 0; i < 3; i++) {
                next_rule_version = structuredClone(next_rule_version);
                get_rule_patterns(next_rule_version).forEach((p) => { rotate_pattern(p); });
                ruleset.push(next_rule_version);
            }
        }
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