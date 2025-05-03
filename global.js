export const RULE_APPLICATION_LIMIT = 10000;
export const UNDO_STACK_LIMIT = 64;

export const OPTIONS = {
    default_palette: ["#131916", "#ffffff", "#6cd9b5", "#036965"], // hexacdecimal colors, 6 digits
    selected_palette_value: 1,
    selected_tool: 'brush',
    run_after_change: false,
    pixel_scale: 14,
    default_tile_size: 5,
}

// load options from localstorage if possible
function load_options() {
    const saved_options = localStorage.getItem('options');
    if (saved_options) {
        try {
            const parsed_options = JSON.parse(saved_options);
            // if a saved option is not in the default options, ignore it and mention it in the console
            for (const key in parsed_options) {
                if (!(key in OPTIONS)) {
                    console.warn(`Ignoring unknown option "${key}" from localStorage`);
                    delete parsed_options[key];
                }
            }
            Object.assign(OPTIONS, parsed_options);
            console.log("Loaded options from localStorage:", OPTIONS);
        } catch (err) {
            console.error("Invalid options in localStorage:", err);
        }
    }
}
load_options();



// the project object is manually saved and loaded. importantly, it includes the rules and play pattern.

/** @typedef {Object} Pattern
 * @property {string} id - unique identifier for the pattern
 * @property {number} width - width of the pattern in pixels
 * @property {number} height - height of the pattern in pixels
 * @property {number[][]} pixels - 2D array of pixel values (colors) in the pattern
*/

/** @typedef {Object} Part
 * @property {string} id - unique identifier for the part
 * @property {Pattern[]} patterns - array of patterns that are part of this part
*/

/** @typedef {Object} Rule 
 * @property {string} id - unique identifier for the rule
 * @property {number} label - generated label for the rule
 * @property {boolean} part_of_group
 * @property {boolean} rotate - whether to expand to all 4 rotations
 * @property {boolean} show_comment
 * @property {string} comment
 * @property {Part[]} parts
*/

/** @typedef {Object} Selection
 * @property {"play" | "rule" | "part" | "pattern" | null} type - type of selection that all selections are of
 * @property {{ rule_id: string, path_id?: string, pattern_id?: string }[]} paths - arrays selection IDs
*/

/** @type {{ rules: Rule[], play_pattern: Pattern, selected: Selection, tile_size: number, palette: string[],  editor_obj_id_counter: number }} */
export const PROJECT = {};

export function clear_project_obj(tile_size = OPTIONS.default_tile_size, palette = OPTIONS.default_palette) {
    PROJECT.tile_size = tile_size;
    PROJECT.palette = palette;
    PROJECT.rules = [];
    PROJECT.editor_obj_id_counter = 0;
    PROJECT.play_pattern = {};
    PROJECT.selected = {
        paths: [],
        type: null
    };
}
clear_project_obj();

/**
 * Generate a unique id for the editor objects (rules, patterns, etc.)
 * @param {string} prefix - optional prefix for the id
 */
export function generate_id(prefix = "id") {
    // use the date and a counter (stored in PROJECT.rules) to generate a unique id
    return `${prefix}_${Date.now().toString(36)}_${(PROJECT.editor_obj_id_counter++).toString(36)}`;
}

/**
 * @typedef {Object} UndoStack
 * @property {("play" | "rules")[]} last_undo_stack_types - for combined undo
 * @property {Rule[]} rules - previous versions of the rules
 * @property {Selection[]} selected - previous selections to match the rules
 * @property {Pattern[]} play_pattern - previous versions of the play pattern
*/

/** @type {UndoStack} */
export const UNDO_STACK = {};
export function clear_undo_stack() {
    UNDO_STACK.last_undo_stack_types = [];
    UNDO_STACK.rules = [];
    UNDO_STACK.selected = [];
    UNDO_STACK.play_pattern = [];
}
clear_undo_stack();

/** 
 * @typedef {Object} UI_State
 * @property {boolean} is_drawing - whether the user is currently drawing a pattern
 * @property {number} draw_value - the value of the pixel being drawn
 * @property {number} draw_start_x - the x coordinate of the first pixel in the brushstroke
 * @property {number} draw_start_y - the y coordinate of the first pixel in the brushstroke
 * @property {number} draw_x - the x coordinate of the last pixel in the brushstroke
 * @property {number} draw_y - the y coordinate of the last pixel in the brushstroke
 * @property {Pattern[]} draw_patterns - patterns that are being drawn to, chosen at the start of drawing
 * @property {number[][][]} draw_pixels_cloned - their pixels before drawing
 * @property {string[]} text_contrast_palette - generated palette used for text contrast
*/

/** @type {UI_State} */
export const UI_STATE = {
    is_drawing: false,
    draw_value: 1,
    draw_start_x: null,
    draw_start_y: null,
    draw_x: null,
    draw_y: null,
    draw_patterns: [],     
    draw_pixels_cloned: [],
    text_contrast_palette: [],
};