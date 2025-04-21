const TILE_SIZE = 5;
const PIXEL_SCALE = 14;
const RULE_APPLICATION_LIMIT = 10000;
const UNDO_STACK_LIMIT = 64;

// state to save/load
let rules = [];
let play_pattern = {};

// editor state
const undos = {
    rules: [],
    rule_selection: [],
    play_pattern: [],
};

let id_counter = 0;

const ui_state = {
    selected_path: null,

    // drawing options
    selected_palette_value: 1,
    selected_tool: 'brush',

    // while drawing
    is_drawing: false,
    draw_value: 1,
    draw_start_x: 0,
    draw_start_y: 0,
    draw_pattern_before: null,
};