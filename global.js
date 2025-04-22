// constants
const RULE_APPLICATION_LIMIT = 10000;
const UNDO_STACK_LIMIT = 64;

// TODO: manually save and load.
const PROJECT = {
    tile_size: 5,
    rules: [],
    rule_id_counter: 0,
    play_pattern: {},
    selected_path: null,
}

// TODO: sync with localstorage.
const OPTIONS = {
    selected_palette_value: 1,
    selected_tool: 'brush',
    pixel_scale: 14,
}

// temporary state. 
// maybe TODO: either allow undo past project loading, or save the undo stack itself?
const UNDO_STACK = {
    rules: [],
    rule_selection: [],
    play_pattern: [],
};
const UI_STATE = {
    is_drawing: false,
    draw_value: 1,
    draw_start_x: 0,
    draw_start_y: 0,
    draw_pattern_before: null,
};