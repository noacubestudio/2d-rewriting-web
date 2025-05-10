import { PROJECT } from "./state.js";

/** @typedef {import('./state.js').Selection} Selection */
/** @typedef {import('./state.js').Pattern} Pattern */


// utility functions

/**
 * @param {Selection} a - first selection to compare
 * @param {Selection} b - second selection to compare
 * @returns {boolean} - true if the selections are equal, false otherwise
 */
export function selections_equal(a, b) {
    if (a.type !== b.type) return false;
    if (!a.paths.length && !b.paths.length) return true; // both empty
    if (a.paths.length !== b.paths.length) return false; // different length

    for (let i = 0; i < a.paths.length; i++) {
        const a_path = a.paths[i];
        const b_path = b.paths[i];
        if (a_path.rule_id !== b_path.rule_id) return false;
        if (a_path.part_id !== b_path.part_id) return false;
        if (a_path.pattern_id !== b_path.pattern_id) return false;
    }
    return true;
}

/**
 * Generate a unique id for the editor objects (rules, patterns, etc.)
 * @param {string} prefix - optional prefix for the id
 */
export function generate_id(prefix = "id") {
    // use the date and a counter (stored in PROJECT.rules) to generate a unique id
    return `${prefix}_${Date.now().toString(36)}_${(PROJECT.editor_obj_id_counter++).toString(36)}`;
}

/**
 * Make a new pattern with a given width and height, filled with 0s
 * @param {number} w - width of the pattern
 * @param {number} h - height of the pattern
 * @returns {Pattern} - the new pattern object
 */
export function get_blank_pattern(w = PROJECT.tile_size, h = PROJECT.tile_size) {
    return {
        id: generate_id('pat'),
        width: w, 
        height: h,
        pixels: Array.from({ length: h }, () => Array(w).fill(0))
    };
}

/**
 * get the palette color for a value - default to magenta if not found.
 * @param {number | null} value - the value to convert to a color
 * @returns {string} - the color as a css color string
 */
export function value_to_color(value) { 
    if (value === -1) return "transparent"; // wildcard
    if (value === null || value >= PROJECT.palette.length) return "magenta"; // empty
    return PROJECT.palette[value];
}