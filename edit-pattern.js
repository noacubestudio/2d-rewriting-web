/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Part} Part */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').UI_State} UI_State */
/** @typedef {import('./state.js').Options} Options */

// functions that just edit a pattern by drawing on it, applying a rule to it, rotating it, resizing it...

/**
 * Draw on a pattern at a given x and y position using a specified tool.
 * @param {Pattern} pattern - the pattern to draw on
 * @param {number} x - the x coordinate to draw at
 * @param {number} y - the y coordinate to draw at
 * @param {Options["selected_tool"]} tool - the tool to use for drawing (brush, rect, line, fill)
 * @param {UI_State} ui_state - the UI state containing drawing parameters
 */
export function draw_in_pattern(pattern, x, y, tool, ui_state) {
    if (!pattern) return;
    if (x < 0 || x >= pattern.width || y < 0 || y >= pattern.height) return;

    if (tool === 'brush') {
        pattern.pixels[y][x] = ui_state.draw_value;

    } else if (tool === 'rect') {
        const fromX = Math.min(ui_state.draw_start_x ?? Infinity, x);
        const fromY = Math.min(ui_state.draw_start_y ?? Infinity, y);
        const toX   = Math.max(ui_state.draw_start_x ?? -Infinity, x);
        const toY   = Math.max(ui_state.draw_start_y ?? -Infinity, y);

        for (let row = fromY; row <= toY; row++) {
            for (let col = fromX; col <= toX; col++) {
                pattern.pixels[row][col] = ui_state.draw_value;
            }
        }

    } else if (tool === 'line') {
        let fromX = ui_state.draw_start_x ?? x;
        let fromY = ui_state.draw_start_y ?? y;
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
        
    } else if (tool === 'fill') {
        const target_color = pattern.pixels[y][x];
        if (target_color === ui_state.draw_value) return;

        const stack = [[x, y]];
        while (stack.length) {
            const [px, py] = /** @type [number, number] */ (stack.pop() ?? undefined);
            if (px < 0 || px >= pattern.width || py < 0 || py >= pattern.height) continue;
            if (pattern.pixels[py][px] !== target_color) continue;
            pattern.pixels[py][px] = ui_state.draw_value;
            stack.push([px + 1, py]);
            stack.push([px - 1, py]);
            stack.push([px, py + 1]);
            stack.push([px, py - 1]);
        }
    } else {
        console.warn(`Unknown tool: ${tool}`);
    }
}

/**
 * Rotate a pattern 90 degrees clockwise a given number of times.
 * @param {Pattern} pattern - the pattern to rotate
 * @param {number} times - number of times to rotate the pattern (default is 1)
 */
export function rotate_pattern(pattern, times = 1) {
    for (let i = 0; i < times; i++) {
        const new_pixels = pattern.pixels[0].map((_, index) => pattern.pixels.map(row => row[index]).reverse());
        pattern.pixels = new_pixels;
    }
    pattern.width = pattern.pixels[0].length;
    pattern.height = pattern.pixels.length;
}

/**
 * Resize a pattern to a new width and height, filling empty pixels with a fill value.
 * @param {Pattern} pattern - the pattern to resize
 * @param {number} new_width - the new width of the pattern
 * @param {number} new_height - the new height of the pattern
 * @param {number} fill - the value to fill empty pixels with (default is 0)
 */
export function resize_pattern(pattern, new_width, new_height, fill = 0) {
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

/**
 * Shift a pattern in the x or y direction in pixels, which wrap around the edges.
 * @param {Pattern} pattern - the pattern to shift
 * @param {number} x_direction - number of pixels to shift in the x direction left (negative) or right (positive)
 * @param {number} y_direction - number of pixels to shift in the y direction up (negative) or down (positive)
 */
export function shift_pattern(pattern, x_direction, y_direction) {
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

/**
 * Flip a pattern horizontally or vertically.
 * @param {Pattern} pattern - the pattern to flip
 * @param {boolean} horizontal
 */
export function flip_pattern(pattern, horizontal = true) {
    if (horizontal) {
        pattern.pixels = pattern.pixels.map(row => row.reverse());
    } else {
        pattern.pixels.reverse();
    }
    pattern.width = pattern.pixels[0].length;
    pattern.height = pattern.pixels.length;
}



/**
 * Apply a rule to a target pattern.
 * @param {Pattern} target_pattern - the pattern to apply the rule to
 * @param {Rule} rule - the rule to apply
 * @param {number} step_size - the step size for searching the pattern in the target
 * @return {boolean} - true if the rule was applied, false otherwise
 */
export function apply_rule(target_pattern, rule, step_size) {
    // find a match for the initial pattern of every part in the play_pattern

    /** @type {{ part: Part, x: number, y: number }[]} */
    const part_matches = [];
    rule.parts.forEach((part) => {
        const part_pattern = part.patterns[0];
        const { x, y } = find_pattern_in_target(part_pattern, target_pattern, step_size);
        if (x === -1 || y === -1) return; // no match found
        part_matches.push({ part, x, y });
    });

    if (part_matches.length < rule.parts.length) {
        return false;
    }

    // apply the rule to the play_pattern
    const has_replaced = apply_matches_in_target(part_matches, target_pattern);
    return has_replaced; // a useless rule does not need to be checked over and over again.
}

/**
 * Find a pattern in a target pattern at a given step size.
 * @param {Pattern} pattern
 * @param {Pattern} target
 * @param {number} step_size
 * @return {{ x: number, y: number }} - -1 if not found
 */
function find_pattern_in_target(pattern, target, step_size) {
    for (let y = 0; y <= target.height - pattern.height; y += step_size) {
        for (let x = 0; x <= target.width - pattern.width; x += step_size) {
            if (is_pattern_match(pattern, target, x, y)) {
                return { x, y };
            }
        }
    }
    return { x: -1, y: -1 }; // no match found
}

/**
 * Check if a pattern matches a target pattern at a given x and y position.
 * @param {Pattern} pattern
 * @param {Pattern} target
 * @param {number} x
 * @param {number} y
 */
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

/**
 * Apply the matches found in the target pattern.
 * @param {{ part: Part, x: number, y: number }[]} part_matches - match coords per part
 * @param {Pattern} target
 * @return {boolean} - true if any replacements were made
 */
function apply_matches_in_target(part_matches, target) {
    let has_replaced = false;
    part_matches.forEach(({ part, x, y }) => {
        // no replace patterns
        if (part.patterns.length === 1) return;

        // random pattern except the first one, which is the before state
        const random_replace_index = 1 + Math.floor(Math.random() * (part.patterns.length - 1));
        const pattern = part.patterns[random_replace_index];
        for (let py = 0; py < pattern.height; py++) {
            for (let px = 0; px < pattern.width; px++) {
                const pattern_pixel = pattern.pixels[py][px];
                if (pattern_pixel === -1) continue; // skip empty pixels
                target.pixels[y + py][x + px] = pattern.pixels[py][px];
                has_replaced = true;
            }
        }
    });
    return has_replaced;
}