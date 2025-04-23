// constants
const RULE_APPLICATION_LIMIT = 10000;
const UNDO_STACK_LIMIT = 64;

// manually saved and loaded
const PROJECT = {
    tile_size: 5,
    rules: [],
    editor_obj_id_counter: 0,
    play_pattern: {},
    selected: {
        paths: [],
        type: null
    }
}

// TODO: sync with localstorage.
const OPTIONS = {
    selected_palette_value: 1,
    selected_tool: 'brush',
    run_after_change: false,
    pixel_scale: 14,
}

// temporary state.
const UNDO_STACK = {
    rules: [],
    selected: [], // store selection alongside undo stack for rules
    play_pattern: [],
};
const UI_STATE = {
    is_drawing: false,
    draw_value: 1,
    draw_start_x: 0,
    draw_start_y: 0,
    draw_pattern_before: null,
};