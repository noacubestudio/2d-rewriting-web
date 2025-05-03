// constants

const RULE_APPLICATION_LIMIT = 10000;
const UNDO_STACK_LIMIT = 64;

const ACTIONS = [
    { id: "run"      , hint: "✅ Run Selected", keys: ["Enter"                ], action: (s) => apply_rules(s) },
    { id: "run_all"  , hint: "✅ Run All"     , keys: [" "                    ], action: () => apply_rules() },
    { id: "undo"     , hint: "♻️ Undo Action" , keys: ["z"                    ], action: () => undo_action() },
    { id: "undo"     , hint: null             , keys: ["u"                    ], action: () => undo_action() },
    // no selection only
    { id: "load"     , hint: "📂 Load"        , keys: ["o"                    ], action: () => use_file_input_and_load() },
    { id: "save"     , hint: "💾 Save"        , keys: ["s"                    ], action: () => save_project() },
    { id: "new"      , hint: "❇️ New"         , keys: ["m"                    ], action: () => new_project() },
    { id: "scale"    , hint: "➖ Px Scale"    , keys: null                     , action: () => zoom_pixel_grids(-1) },
    { id: "scale"    , hint: "➕ Px Scale"    , keys: null                     , action: () => zoom_pixel_grids(1) },
    // selection only
    { id: "delete"   , hint: "❌ Delete"      , keys: ["Delete"               ], action: (s) => delete_selection(s) },
    { id: "clear"    , hint: "🧼 Clear"       , keys: ["w"                    ], action: (s) => clear_selection(s) },
    { id: "duplicate", hint: "📄 Duplicate"   , keys: ["d"                    ], action: (s) => duplicate_selection(s) },

    { id: "rule_flag", hint: "☑️ Rotations"   , keys: ["f"                    ], action: (s) => toggle_rule_flag(s, 'rotate') },
    { id: "rule_flag", hint: "☑️ Group"       , keys: ["g"                    ], action: (s) => toggle_rule_flag(s, 'part_of_group') },
    { id: "rule_flag", hint: "☑️ Comment"     , keys: ["t"                    ], action: (s) => toggle_rule_flag(s, 'show_comment') },

    { id: "swap"     , hint: null             , keys: ["ArrowUp"              ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: null             , keys: ["ArrowDown"            ], action: (s) => reorder_selection(s,1) },
    { id: "swap"     , hint: "⬅️ Swap Back"   , keys: ["ArrowLeft"            ], action: (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: "➡️ Swap Next"   , keys: ["ArrowRight"           ], action: (s) => reorder_selection(s,1) },
    { id: "resize"   , hint: "➖ Width"       , keys: ["ArrowLeft" , "Control"], action: (s) => resize_patterns_in_selection(s,-1,0) },
    { id: "resize"   , hint: "➕ Width"       , keys: ["ArrowRight", "Control"], action: (s) => resize_patterns_in_selection(s,1,0) },
    { id: "resize"   , hint: "➖ Height"      , keys: ["ArrowUp"   , "Control"], action: (s) => resize_patterns_in_selection(s,0,-1) },
    { id: "resize"   , hint: "➕ Height"      , keys: ["ArrowDown" , "Control"], action: (s) => resize_patterns_in_selection(s,0,1) },
    { id: "rotate"   , hint: "🔃 Rotate"      , keys: ["r"                    ], action: (s) => rotate_patterns_in_selection(s) },
    { id: "flip"     , hint: "↔️ Flip Hor."   , keys: ["h"                    ], action: (s) => flip_patterns_in_selection(s, true, false) },
    { id: "flip"     , hint: "↕️ Flip Ver."   , keys: ["v"                    ], action: (s) => flip_patterns_in_selection(s, false, true) },
    { id: "shift"    , hint: "⬅️ Shift Left"  , keys: ["ArrowLeft" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,-1,0) },
    { id: "shift"    , hint: "➡️ Shift Right" , keys: ["ArrowRight", "Alt"    ], action: (s) => shift_patterns_in_selection(s,1,0) },
    { id: "shift"    , hint: "⬆️ Shift Up"    , keys: ["ArrowUp"   , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,-1) },
    { id: "shift"    , hint: "⬇️ Shift Down"  , keys: ["ArrowDown" , "Alt"    ], action: (s) => shift_patterns_in_selection(s,0,1) },
];
const ACTIONS_SHOWN_WHEN_NOTHING_SELECTED = ['run_all', 'save', 'load', 'new', 'undo', 'scale'];
const ACTIONS_HIDDEN_WHEN_RULE_SELECTED   = ['run_all', 'save', 'load', 'new', 'scale'];
const ACTIONS_HIDDEN_WHEN_PLAY_SELECTED   = ['run', 'delete', 'duplicate', 'swap', 'save', 'load', 'new', 'scale', 'rule_flag'];
const NOT_UNDOABLE_ACTIONS = ['save', 'load', 'new', 'scale', 'undo'];

const TOOL_SETTINGS = [
    { group: "colors", hint: null, option_key: 'selected_palette_value', options: [
        { value: 1, label: "1"  , keys: ["1"] },
        { value: 2, label: "2"  , keys: ["2"] },
        { value: 3, label: "3"  , keys: ["3"] },
        { value: 0, label: "4"  , keys: ["4"] },
        { value:-1, label: "Any", keys: ["5"] },

    ]},
    { group: "tools", hint: "Tool", option_key: 'selected_tool', options: [
        { value: 'brush', label: "✏️", keys: ["b"] },
        { value: 'line' , label: "➖", keys: ["l"] },
        { value: 'rect' , label: "🔳", keys: ["n"] },
        { value: 'fill' , label: "🪣", keys: ["f"] },
    ]},
    { group: "toggle_autorun", hint: "Run after change", option_key: 'run_after_change', options: [
        { value: false, label: "Off", keys: null },
        { value: true , label: "On" , keys: null },
    ]},
];

// mutable state

// load options from localStorage if available, not project specific
const OPTIONS = {
    default_palette: ["#131916", "#ffffff", "#6cd9b5", "#036965"], // hexacdecimal colors, 6 digits
    selected_palette_value: 1,
    selected_tool: 'brush',
    run_after_change: false,
    pixel_scale: 14,
    default_tile_size: 5,
}
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


// the project object is manually saved and loaded.
// importantly, it includes the rules and play pattern.

/** @typedef {Object} Rule 
 * @property {string} id - unique identifier for the rule
 * @property {number} label - generated label for the rule
 * @property {boolean} part_of_group
 * @property {boolean} rotate - whether to expand to all 4 rotations
 * @property {boolean} show_comment
 * @property {string} comment
 * @property {object[]} parts
*/

/** @type {{
 *   tile_size: number,
 *   palette: string[],
 *   rules: Rule[],
 *   editor_obj_id_counter: number,
 *   play_pattern: object,
 *   selected: { paths: object[], type: string | null }
 * }}
*/
const PROJECT = {};

function clear_project_obj(tile_size = OPTIONS.default_tile_size, palette = OPTIONS.default_palette) {
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

// temporary
const UNDO_STACK = {
    last_undo_stack_types: [], // can be used for a single global undo
    rules: [],
    selected: [], // store selection alongside undo stack for rules
    play_pattern: [],
};
function clear_undo_stack() {
    UNDO_STACK.last_undo_stack_types = [];
    UNDO_STACK.rules = [];
    UNDO_STACK.selected = [];
    UNDO_STACK.play_pattern = [];
}
const UI_STATE = {
    is_drawing: false,
    draw_value: 1,
    draw_start_x: null,
    draw_start_y: null,
    draw_x: null,
    draw_y: null,
    draw_patterns: [],      // set at start of drawing
    draw_pixels_cloned: [], // set at start of drawing
    text_contrast_palette: [], // generated from project palette
};