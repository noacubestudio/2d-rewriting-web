function initial_play_pattern() {
    // initial
    function blank_play_pattern(w = 8 * TILE_SIZE, h = 8 * TILE_SIZE) {
        return {
            id: 'play',
            width: w,
            height: h,
            pixels: Array.from({ length: h }, () => Array(w).fill(0))
        };
    }

    play_pattern = blank_play_pattern();
}

function apply_selected_rule() {
    const path = ui_state.selected_path;
    if (!path || path.pattern_id === 'play') return;

    const { rule } = get_selected_rule_objects(path);
    if (!rule) return;

    const was_successful = apply_rule(rule);
    if (was_successful) render_play_pattern();
}

function apply_rule(rule) {
    let target_pattern = play_pattern;
    
    // find a match for the initial pattern of every part in the play_pattern
    const part_matches = [];
    rule.parts.forEach((part) => {
        const part_pattern = part.patterns[0];
        const { x, y } = find_pattern_in_target(part_pattern, target_pattern);
        if (x === -1 || y === -1) return; // no match found
        part_matches.push({ part, x, y });
    });

    if (part_matches.length < rule.parts.length) {
        console.log('not all parts matched');
        return false;
    }

    // apply the rule to the play_pattern
    apply_matches_in_target(part_matches, target_pattern);
    console.log('rule applied', rule.id);
    return true;
}

function find_pattern_in_target(pattern, target) {
    for (let y = 0; y <= target.height - pattern.height; y += TILE_SIZE) {
        for (let x = 0; x <= target.width - pattern.width; x += TILE_SIZE) {
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
            if (target.pixels[y + py][x + px] !== pattern.pixels[py][px]) {
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
                target.pixels[y + py][x + px] = pattern.pixels[py][px];
            }
        }
    });
}