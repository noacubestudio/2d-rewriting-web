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
export function palette_value_to_color(value) { 
    if (value === -1) return "transparent"; // wildcard
    if (value === null || value >= PROJECT.palette.length) return "magenta"; // empty
    return PROJECT.palette[value];
}

/**
 * get the closest value for a color. interpret any transparent color as -1 (wildcard)
 * @param {number} r - red value (0-255)
 * @param {number} g - green value (0-255)
 * @param {number} b - blue value (0-255)
 * @param {number} a - alpha value (0-255)
 * @param {{ r: number, g: number, b: number }[]} rgb_palette_array - array of colors in hex format
 * @returns {number} - the value as a number
 */
export function get_closest_palette_index(r, g, b, a, rgb_palette_array) {
    if (a < 250) return -1; // count as wildcard
    // cheap distance measure
    const distance = (/** @type {{ r: any; g: any; b: any; }} */ c1, /** @type {{ r: any; g: any; b: any; }} */ c2) => {
        return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
    }

    let index = -1;
    let min_distance = Infinity;
    for (let i = 0; i < rgb_palette_array.length; i++) {
        const color = rgb_palette_array[i];
        const d = distance({ r, g, b }, color);
        if (d < min_distance) {
            min_distance = d;
            index = i;
        }
    }
    return index;
}

export function get_short_timestamp() {
    const now = new Date();
    const pad = (/** @type {number} */ n) => n.toString().padStart(2, "0");
    return `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
}