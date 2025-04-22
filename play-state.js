// functions that modify the play_pattern only.
// the play_pattern is the main area where the rules are applied.

function initial_play_pattern() {
    // initial
    function blank_play_pattern(w = 8 * PROJECT.tile_size, h = 8 * PROJECT.tile_size) {
        return {
            id: 'play',
            width: w,
            height: h,
            pixels: Array.from({ length: h }, () => Array(w).fill(0))
        };
    }

    PROJECT.play_pattern = blank_play_pattern();
}

// action that can modify the play_pattern. returns stats (application count, etc.)
function apply_selected_rule(path) {
    if (!path || path.pattern_id === 'play') return;

    const { rule } = get_selected_rule_objects(path);
    if (!rule) return;

    const apply_limit = RULE_APPLICATION_LIMIT;
    let success = true; let application_count = 0;

    while (success && application_count < apply_limit) {
        success = apply_rule(rule);
        application_count++;
    }

    if (application_count > 0) {
        return { new_path: path, render: 'play', application_count };
    }
}

function apply_all_rules(path) {
    const apply_limit = RULE_APPLICATION_LIMIT;
    let application_count = 0;
    let limit_reached_count = 0;

    PROJECT.rules.forEach((rule) => {
        let rule_success = true;
        let rule_application_count = 0;
        while (rule_success && rule_application_count < apply_limit) {
            rule_success = apply_rule(rule);
            rule_application_count++;
        }
        application_count += rule_application_count;
        if (rule_application_count >= apply_limit) limit_reached_count++;
    });

    if (application_count > 0) {
        return { new_path: path, render: 'play', application_count, limit_reached_count };
    }
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