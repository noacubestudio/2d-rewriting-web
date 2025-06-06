export const RULE_APPLICATION_LIMIT = 10000;
export const UNDO_STACK_LIMIT_RULES = 64;
export const UNDO_STACK_LIMIT_PLAY = 256;
export const INITIAL_DEFAULT_PALETTE = ["#131916", "#ffffff", "#6cd9b5", "#036965"];
export const DEFAULT_ANIMATION_SPEED = 100; // milliseconds

/** @typedef {"brush" | "rect" | "line" | "fill" | "eyedropper" | "select"} Tool */

/**
 * @typedef {Object} Options
 * @property {string[]} default_palette - hexadecimal colors, 6 digits
 * @property {number} selected_palette_value - used to index the project palette
 * @property {Tool} selected_tool
 * @property {boolean} run_after_change - whether to run rules after changing the play pattern
 * @property {number} pixel_scale - scale of the pixels in the editor
 * @property {number} default_tile_size - default size of the tile in pixels
 * @property {number} animation_speed - speed of the animation in milliseconds
*/

/** @typedef {Object} Temp_Options
 * @property {Tool | null} selected_tool
*/

/** @type {Options} */
export const OPTIONS = {
    default_palette: structuredClone(INITIAL_DEFAULT_PALETTE),
    selected_palette_value: 1,
    selected_tool: 'brush',
    run_after_change: false,
    pixel_scale: 14,
    default_tile_size: 5,
    animation_speed: DEFAULT_ANIMATION_SPEED,
}

/** @type {Temp_Options} */
export const TEMP_OPTIONS = {
    selected_tool: null
}

// load options from localstorage if possible
export function load_options_locally() {
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



// the project object is manually saved and loaded. importantly, it includes the rules and play pattern.

/** 
 * @typedef {Object} Pattern
 * @property {string} id - unique identifier for the pattern
 * @property {number} width - width of the pattern in pixels
 * @property {number} height - height of the pattern in pixels
 * @property {number[][]} pixels - 2D array of pixel values (colors) in the pattern
*/

/** 
 * @typedef {Object} Part
 * @property {string} id - unique identifier for the part
 * @property {Pattern[]} patterns - array of patterns that are part of this part
 * @property {boolean} [sync_wildcards] - whether to fill in wildcards when replacing based on their corresponding index in the initial pattern
*/

/** 
 * @typedef {Object} Rule 
 * @property {string} id - unique identifier for the rule
 * @property {number} current_index - generated for the rule to show as a label
 * @property {boolean} [part_of_group]
 * @property {boolean} [trigger_animation_loop] - run rules again after a delay (if this one runs)
 * @property {boolean} [rotate] - whether to expand to all 4 rotations
 * @property {boolean} [mirror] - whether to expand to all 4 flips (when combined with rotation, makes for 8 total patterns)
 * @property {boolean} [show_comment]
 * @property {boolean} [keybind] - rule is triggered by key input
 * @property {string} [comment]
 * @property {Part[]} parts
*/

/**
 * Boolean flags that can be toggled per rule.
 * @typedef {"part_of_group" | "rotate" | "show_comment" | "keybind" | "mirror" | "trigger_animation_loop"} Rule_Flag_Key
*/

/**
 * Boolean flags that can be toggled per part.
 * @typedef {"sync_wildcards"} Part_Flag_Key
*/

/**
 * @typedef {Object} Selection_Path
 * @property {string} rule_id
 * @property {string} [part_id]
 * @property {string} [pattern_id]
*/

/** 
 * @typedef {Object} Selection
 * @property {"play" | "rule" | "part" | "pattern" | null} type - type of selection that all selections are of
 * @property {Selection_Path[]} paths - arrays selection IDs
*/

/** 
 * @typedef {Object} Project
 * @property {Rule[]} rules
 * @property {Pattern} play_pattern - the main pattern that rules are applied to
 * @property {Selection} selected - the currently selected items in the editor
 * @property {number} tile_size
 * @property {string[]} palette - color palette for patterns
 * @property {number} editor_obj_id_counter - counter for generating unique IDs for editor objects
*/

/** @type {Project} */
export const PROJECT = /***/ ({});
export function clear_project_obj(tile_size = OPTIONS.default_tile_size, palette = OPTIONS.default_palette) {
    PROJECT.tile_size = tile_size;
    PROJECT.palette = palette;
    PROJECT.rules = [];
    PROJECT.editor_obj_id_counter = 0;
    PROJECT.play_pattern = {
        id: "play_pattern",
        width: 0,
        height: 0,
        pixels: [],
    };
    PROJECT.selected = {
        paths: [],
        type: null
    };
}

/**
 * @typedef {Object} Undo_Stack
 * @property {("play" | "rules")[]} last_undo_stack_types - for combined undo
 * @property {Rule[][]} rules - previous versions of the rules
 * @property {Selection[]} selected - previous selections to match the rules
 * @property {Pattern[]} play_pattern - previous versions of the play pattern
*/

/** @type {Undo_Stack} */
export const UNDO_STACK = /***/ ({});
export function clear_undo_stack() {
    UNDO_STACK.last_undo_stack_types = [];
    UNDO_STACK.rules = [];
    UNDO_STACK.selected = [];
    UNDO_STACK.play_pattern = [];
}

/** 
 * @typedef {Object} UI_State
 * @property {boolean} is_drawing - whether the user is currently drawing a pattern
 * @property {number} draw_value - the value of the pixel being drawn
 * @property {number | null} draw_start_x - the x coordinate of the first pixel in the brushstroke
 * @property {number | null} draw_start_y - the y coordinate of the first pixel in the brushstroke
 * @property {number | null} current_x - the x coordinate of the current position of the pointer
 * @property {number | null} current_y - the y coordinate of the current position of the pointer
 * 
 * @property {Pattern | null} draw_pattern_active - the pattern that is currently being drawn on
 * @property {HTMLCanvasElement | null} current_pointer_canvas_el - the div element that is being drawn on
 * 
 * @property {Pattern[]} draw_patterns - patterns that are being drawn to, chosen at the start of drawing
 * @property {number[][][]} draw_pixels_cloned - their pixels before drawing
 * 
 * @property {DOMHighResTimeStamp | null} next_timestamp - whether the animation is currently running
 * @property {string[]} text_contrast_palette - generated palette used for text contrast
*/

/** @type {UI_State} */
export const UI_STATE = {
    is_drawing: false,
    draw_value: 1,
    draw_start_x: null,
    draw_start_y: null,
    current_x: null,
    current_y: null,
    draw_patterns: [],     
    draw_pattern_active: null, // pattern the pointer is drawing on
    current_pointer_canvas_el: null, // the element that is being drawn on
    draw_pixels_cloned: [],

    next_timestamp: null,
    text_contrast_palette: [],
};