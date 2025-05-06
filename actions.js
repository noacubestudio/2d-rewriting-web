import { PROJECT, OPTIONS, UI_STATE, UNDO_STACK, UNDO_STACK_LIMIT, RULE_APPLICATION_LIMIT } from "./state.js";
import { clear_undo_stack, generate_id, get_blank_pattern, selections_equal } from "./state.js";

import { draw_in_pattern, rotate_pattern, apply_rule } from "./edit-pattern.js";

import { get_selected_rule_patterns, get_selected_rule_objects } from "./edit-selection.js";
import { toggle_rule_flag, duplicate_selection, delete_selection, clear_selection, reorder_selection, resize_patterns_in_selection, rotate_patterns_in_selection, flip_patterns_in_selection, shift_patterns_in_selection } from "./edit-selection.js";
import { move_selection_to_part } from "./edit-selection.js";

/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').Selection} Selection */
/** @typedef {import('./state.js').Options} Options */
/** @typedef {import('./state.js').Project} Project */

/** @typedef {import('./edit-selection.js').Selection_Edit_Output} Selection_Edit_Output */
/** @typedef {import('./ui.js').render_callback} render_callback */


/** 
 * Actions are functions that modify the state of the project, activated with button click or keypress.
 * The state before the action is usually saved for undo.
 * If an action is successful, the state is pushed to the undo stack and render updates are triggered.
 * @typedef {Object} Action 
 * @prop {string} id - the id of the action
 * @prop {string | null} hint - shown on the button, or null if not shown
 * @prop {string[] | null} keys - the keys that trigger the action, or null if no hotkey
 * @prop {function} action - the function that performs the action
*/

/** @type {Action[]} */
export const ACTIONS = [
    { id: "run"      , hint: "✅ Run Selected", keys: ["Enter"                ], action: /** @param {Selection} s */ (s) => apply_rules(s) },
    { id: "run_all"  , hint: "✅ Run All"     , keys: [" "                    ], action: () => apply_rules(undefined) },

    // actions that are not undoable themselves. render callbacks for most other functions are in do_action()
    { id: "undo"     , hint: "♻️ Undo Action" , keys: ["z"                    ], action: /** @param {render_callback} render_fn */ (render_fn) => undo_action(render_fn) },
    { id: "undo"     , hint: null             , keys: ["u"                    ], action: /** @param {render_callback} render_fn */ (render_fn) => undo_action(render_fn) },
    { id: "load"     , hint: "📂 Load"        , keys: ["Shift", "o"           ], action: /** @param {render_callback} render_fn */ (render_fn) => use_file_input_and_load(render_fn) },
    { id: "save"     , hint: "💾 Save"        , keys: ["Shift", "s"           ], action: () => save_project() },
    { id: "savepng"  , hint: "📷 Save PNG"    , keys: null                     , action: () => save_play_png() },
    { id: "new"      , hint: "❇️ New"         , keys: ["Shift", "n"           ], action: () => new_project() },
    { id: "settings" , hint: "⚙️ Settings"    , keys: null                     , action: () => edit_project() },
    { id: "scale"    , hint: "➖ Px Scale"    , keys: ["-"                    ], action: /** @param {render_callback} render_fn */ (render_fn) => zoom_pixel_grids(-1, render_fn) },
    { id: "scale"    , hint: "➕ Px Scale"    , keys: ["="                    ], action: /** @param {render_callback} render_fn */ (render_fn) => zoom_pixel_grids(1, render_fn) },

    { id: "delete"   , hint: "❌ Delete"      , keys: ["Delete"               ], action: /** @param {Selection} s */ (s) => delete_selection(s) },
    { id: "clear"    , hint: "🧼 Clear"       , keys: ["w"                    ], action: /** @param {Selection} s */ (s) => clear_selection(s) },
    { id: "duplicate", hint: "📄 Duplicate"   , keys: ["d"                    ], action: /** @param {Selection} s */ (s) => duplicate_selection(s) },

    { id: "rule_flag", hint: "☑️ Rotations"   , keys: ["Alt", "r"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'rotate') },
    { id: "rule_flag", hint: "☑️ Group"       , keys: ["Alt", "g"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'part_of_group') },
    { id: "rule_flag", hint: "☑️ Comment"     , keys: ["Alt", "c"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'show_comment') },

    { id: "swap"     , hint: null             , keys: ["ArrowUp"              ], action: /** @param {Selection} s */ (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: null             , keys: ["ArrowDown"            ], action: /** @param {Selection} s */ (s) => reorder_selection(s,1) },
    { id: "swap"     , hint: "⬅️ Swap Back"   , keys: ["ArrowLeft"            ], action: /** @param {Selection} s */ (s) => reorder_selection(s,-1) },
    { id: "swap"     , hint: "➡️ Swap Next"   , keys: ["ArrowRight"           ], action: /** @param {Selection} s */ (s) => reorder_selection(s,1) },
    { id: "resize"   , hint: "➖ Width"       , keys: ["ArrowLeft" , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_selection(s,-1,0) },
    { id: "resize"   , hint: "➕ Width"       , keys: ["ArrowRight", "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_selection(s,1,0) },
    { id: "resize"   , hint: "➖ Height"      , keys: ["ArrowUp"   , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_selection(s,0,-1) },
    { id: "resize"   , hint: "➕ Height"      , keys: ["ArrowDown" , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_selection(s,0,1) },
    { id: "rotate"   , hint: "🔃 Rotate"      , keys: ["r"                    ], action: /** @param {Selection} s */ (s) => rotate_patterns_in_selection(s) },
    { id: "flip"     , hint: "↔️ Flip Hor."   , keys: ["h"                    ], action: /** @param {Selection} s */ (s) => flip_patterns_in_selection(s, true, false) },
    { id: "flip"     , hint: "↕️ Flip Ver."   , keys: ["v"                    ], action: /** @param {Selection} s */ (s) => flip_patterns_in_selection(s, false, true) },
    { id: "shift"    , hint: "⬅️ Shift Left"  , keys: ["ArrowLeft" , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_selection(s,-1,0) },
    { id: "shift"    , hint: "➡️ Shift Right" , keys: ["ArrowRight", "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_selection(s,1,0) },
    { id: "shift"    , hint: "⬆️ Shift Up"    , keys: ["ArrowUp"   , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_selection(s,0,-1) },
    { id: "shift"    , hint: "⬇️ Shift Down"  , keys: ["ArrowDown" , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_selection(s,0,1) },
];
export const ACTION_BUTTON_VISIBILITY = {
    nothing_selected:   ['save', 'load', 'new', 'scale', 'settings'],
    rules_selected:     ['run', 'delete', 'duplicate', 'swap', 'rule_flag'],
    play_selected:      ['savepng'],
    something_selected: ['resize', 'rotate', 'flip', 'shift', 'clear'],
};
const NOT_UNDOABLE_ACTIONS = ['save', 'savepng', 'load', 'new', 'scale', 'settings', 'undo'];


/** @typedef {Object} Tool_Setting
 * @property {string | null} hint - label next to the buttons
 * @property {keyof Options} option_key - the key in the OPTIONS object to change
 * @property {{ value: any, label: string, keys: (string[] | null)}[]} options - array of options for the setting
*/

/** @type {Tool_Setting[]} */
export const TOOL_SETTINGS = [
    { hint: null, option_key: 'selected_palette_value', options: [
        { value: 1, label: "1"  , keys: ["1"] },
        { value: 2, label: "2"  , keys: ["2"] },
        { value: 3, label: "3"  , keys: ["3"] },
        { value: 0, label: "4"  , keys: ["4"] },
        { value:-1, label: "Any", keys: ["5"] },

    ]},
    { hint: "Tool", option_key: 'selected_tool', options: [
        { value: 'brush', label: "✏️", keys: ["b"] },
        { value: 'line' , label: "➖", keys: ["l"] },
        { value: 'rect' , label: "🔳", keys: ["t"] },
        { value: 'fill' , label: "🪣", keys: ["f"] },
        { value: 'drag' , label: "🫳", keys: ["m"] },
    ]},
    { hint: "Run after change", option_key: 'run_after_change', options: [
        { value: false, label: "Off", keys: null },
        { value: true , label: "On" , keys: null },
    ]},
];


/**
 * * Perform an action on the selected pattern or play pattern.
 * @param {function} action 
 * @param {string} id 
 * @param {render_callback} render_fn 
 */
export function do_action(action, id, render_fn) {
    if (NOT_UNDOABLE_ACTIONS.includes(id)) {
        action(render_fn);
        return;
    }
    
    if (id === 'run' || id === 'run_all') {
        // change the play pattern.
        const previous_state = structuredClone(PROJECT.play_pattern);
        const stats = action(PROJECT.selected);

        if (!stats) {
            console.warn(`Action '${id}' probably failed, could not get stats.`);
            return;
        }

        // log stats
        const { application_count, failed_count, groups_application_count, groups_failed_count, groups_that_hit_limit } = stats;
        if (groups_that_hit_limit.length > 0) {
            console.warn(`Rule groups ${groups_that_hit_limit.join(', ')} reached the application limit of ${RULE_APPLICATION_LIMIT}`);
        }
        console.log(`${groups_application_count} of ${groups_application_count + groups_failed_count} groups applied.\n` 
            + `In total, replaced ${application_count} time(s) and failed ${failed_count} time(s).`);
        
        // react to changes
        if (application_count < 1) return; // nothing changed
        render_fn("play", null);

        // add the state before the rules ran to the undo stack.
        // if rules only ran after another action, then don't push the state again.
        // this way a single undo will also undo the input action, such as drawing.
        const last_action_target = UNDO_STACK.last_undo_stack_types[UNDO_STACK.last_undo_stack_types.length - 1];
        if (OPTIONS.run_after_change && last_action_target === "play") return;
        push_to_undo_stack(true, previous_state, undefined);
        return;
    }
    
    // save state for undo
    const play_selected = PROJECT.selected.type === 'play';
    const previous_state = structuredClone(play_selected ? PROJECT.play_pattern : PROJECT.rules);
    const previous_selection = structuredClone(PROJECT.selected);

    // do action
    const success = action(PROJECT.selected);
    if (success) {
        // change selection
        PROJECT.selected = success.new_selected;

        // render changes 
        if (success.render_play) {
            render_fn("play", null);
        } else if (success.render_ids.size) {
            [...success.render_ids].forEach((id) => { render_fn("rules", { rule_id: id }); }); // re-render - or just remove if deleted
        } else {
            console.warn("Action occured, but no re-render specified");
        }

        push_to_undo_stack(play_selected, previous_state, previous_selection);

        // run after change
        if (OPTIONS.run_after_change && play_selected) {
            console.log("Running after change...");
            const action_fn = ACTIONS.find(a => a.id === 'run_all')?.action;
            if (action_fn) do_action(action_fn, 'run_all', render_fn);
        }
        return;
    } 

    console.log(`Action '${id}' failed.`);
}

/**
 * When an action/ drawing on a pattern takes place, save all rule patterns + selection or the play pattern to the right stack.
 * TODO: could only push changed patterns and also their IDs for partial redraws.
 * @param {boolean} play_selected 
 * @param {Pattern | Rule[]} state_to_push 
 * @param {Selection | undefined} selection_to_push 
 */
function push_to_undo_stack(play_selected, state_to_push, selection_to_push) {
    const undo_stack = play_selected ? UNDO_STACK.play_pattern : UNDO_STACK.rules;
    const undo_stack_type = play_selected ? 'play' : 'rules';
    // @ts-ignore
    undo_stack.push(state_to_push);
    UNDO_STACK.last_undo_stack_types.push(undo_stack_type);
    if (undo_stack.length > UNDO_STACK_LIMIT) undo_stack.shift();

    if (play_selected) return;
    // also push the selection to the undo stack
    UNDO_STACK.selected.push(selection_to_push || PROJECT.selected);
    if (UNDO_STACK.selected.length > UNDO_STACK_LIMIT) UNDO_STACK.selected.shift();
}



/** @param {render_callback} render_fn */
function undo_action(render_fn) {
    const last_stack_type = UNDO_STACK.last_undo_stack_types.pop();
    if (PROJECT.selected.type === 'play' || (last_stack_type === 'play' && PROJECT.selected.type === null)) {
        const last_play_pattern = UNDO_STACK.play_pattern.pop();
        if (last_play_pattern) {
            PROJECT.play_pattern = last_play_pattern;
            render_fn("play", null);
            console.log("undo play_pattern", PROJECT.play_pattern.id);
            return;
        }
        console.log("Nothing to undo");
        return;
    }

    // assume these are always the same length
    const last_rules = UNDO_STACK.rules.pop();
    const last_selection = UNDO_STACK.selected.pop();
    if (last_rules && last_selection) {
        // undo action on rules
        PROJECT.rules = last_rules;
        render_fn("rules", null);

        // undo selection to state before action
        const old_sel = structuredClone(PROJECT.selected);
        const same = selections_equal(old_sel, last_selection);
        if (!same) {
            PROJECT.selected = last_selection;
            render_fn("selection", { old_sel, new_sel: last_selection });
        }
        console.log("undo rules");
        return;
    }
    console.log("Nothing to undo");
}

/** 
 * Run the rules on the play pattern.
 * @param {Selection | undefined} sel
 */
export function apply_rules(sel) {
    const group_loop_limit = RULE_APPLICATION_LIMIT;
    const step_size = PROJECT.tile_size; // the size of the step to take when applying rules
    const stats = {
        application_count: 0,
        failed_count: 0,
        groups_application_count: 0,
        groups_failed_count: 0,
        /** @type {string[]} */
        groups_that_hit_limit: [],
    };

    // if there are certain rules selected, only apply those rules.
    // return groups of rules (id, rules) to be applied.
    const ruleset = process_rules(PROJECT.rules, sel);
    if (!ruleset) { 
        console.warn("No rules to apply.");
        return; // no rules to apply
    }

    ruleset.forEach(({ id, rules }) => {
        // the id is the rule id that expanded into a group of rules.

        // loop each group of rules before going to the next group.
        // currently, loops are only generated for rotated rules.

        let rule_index = 0;
        let group_application_count = 0;
        let group_failed_count = 0;
        while (group_application_count < group_loop_limit && rule_index < rules.length) {
            const rule = rules[rule_index];
            let rule_success = apply_rule(PROJECT.play_pattern, rule, step_size);
            if (rule_success) {
                group_application_count++;
                rule_index = 0; // reset to start of group
            } else {
                group_failed_count++;
                rule_index++; // try the next rule in the group
            }
        }
        // add to the total number of applications and misses.
        // add to the count of how many groups were applied and failed.
        stats.application_count += group_application_count;
        stats.failed_count += group_failed_count;
        if (group_application_count >= 1) {
            stats.groups_application_count++;
            if (group_application_count >= group_loop_limit) stats.groups_that_hit_limit.push(id);
        } else {
            stats.groups_failed_count++;
        }
    });

    return stats;
}

/**
 * @typedef {Object} Processed_Rule_Group
 * @property {string} id - id of the first rule in the group
 * @property {Rule[]} rules - the rules in the group
*/

/**
 * @param {Rule[]} rules 
 * @param {Selection | undefined} sel
 * @return {Processed_Rule_Group[]} - array of rule groups to be applied
 */
function process_rules(rules, sel) {
    /** @type {Processed_Rule_Group[]} */
    const ruleset = [];

    // get selected rule ids from the selection, otherwise use all rules
    let selected_rule_ids = null;
    if (sel) {
        if (sel.type === null || sel.type === 'play') return [];
        const object_groups = get_selected_rule_objects(sel);
        selected_rule_ids = new Set(object_groups.map((obj) => obj.rule.id));
        if (selected_rule_ids.size === 0) return [];
    }

    /** 
     * @param {Rule} rule
     */
    function get_rule_patterns(rule) {
        /** @type {Pattern[]} */
        const result = [];
        rule.parts.forEach(p => p.patterns.forEach(pat => result.push(pat)));
        return result;
    }

    rules.forEach((rule) => {
        // skip if the rule is not selected
        if (selected_rule_ids && !selected_rule_ids.has(rule.id)) return;

        // start a new group if the rule is not part of one already.
        // if it is part, keep adding to the last group.
        // ignore the bigger groups when only some rules are selected because it won't make sense
        /** @type {Processed_Rule_Group} */
        const group = (rule.part_of_group && !sel) ? ruleset[ruleset.length - 1] : { id: rule.id, rules: [] };
        group.rules.push(rule);

        // add other 3 rotated versions of the rule
        if (rule.rotate) {
            let next_rule_version = rule;
            for (let i = 0; i < 3; i++) {
                next_rule_version = structuredClone(next_rule_version);
                get_rule_patterns(next_rule_version).forEach((p) => { rotate_pattern(p); });
                group.rules.push(next_rule_version);
            }
        }
        if (!rule.part_of_group || sel) ruleset.push(group); // add new group to the ruleset
    });
    return ruleset;
}



/**
 * Change the value of a setting in the options object.
 * @template {keyof Options} K
 * @param {K} option_key
 * @param {Options[K]} value
 * @returns { { render_selected: boolean } | undefined }
 */
export function do_tool_setting(option_key, value) {
    const previous_value = OPTIONS[option_key];
    OPTIONS[option_key] = value;
    save_options();

    if (option_key === 'selected_tool' && (value === 'drag' || previous_value === 'drag')) {
        // drag tool does not show the grid, so update the selected rules.
        return { render_selected: true };
    }
}

/**
 * @param {number} change 
 * @param {render_callback} render_fn 
 */
function zoom_pixel_grids(change, render_fn) {
    OPTIONS.pixel_scale += change;
    OPTIONS.pixel_scale = Math.max(2, Math.min(OPTIONS.pixel_scale, 100));
    save_options();
    update_css_vars();

    // render everything again
    render_fn("play", null);
    render_fn("rules", null);
}

function update_css_vars() {
    document.documentElement.style.setProperty('--pixel-scale', `${OPTIONS.pixel_scale}`);
    document.documentElement.style.setProperty('--tile-size', `${PROJECT.tile_size}`);
}

export function save_options() {
    localStorage.setItem('options', JSON.stringify(OPTIONS));
}


// project functions

function new_project() {
    // open the dialog to create a new project
    const dialog_el = /** @type {HTMLDialogElement} */ (document.getElementById("new-project-dialog"));
    dialog_el.showModal();
}

function edit_project() {
    // open the dialog to edit the project settings
    const dialog_el = /** @type {HTMLDialogElement} */ (document.getElementById("edit-project-dialog"));
    dialog_el.showModal();
}

/** @param {render_callback} render_fn */
export function init_starter_project(render_fn) {
    // setup rules and play pattern to the default state
    set_default_project();
    palette_changed();
    update_css_vars();

    render_fn("play", null);
    render_fn("rules", null);
}

function set_default_project(play_w = 8, play_h = 8) {
    // rules

    /** @type {Rule} */
    const default_rule = {
        id: generate_id('rule'),
        parts: [
            {
                id: generate_id('part'),
                patterns: [get_blank_pattern(), get_blank_pattern()]
            },
        ],
        label: 0
    }

    PROJECT.rules.push(default_rule);
    // add dot to the second pattern
    const middle_coord = Math.floor(PROJECT.tile_size / 2);
    PROJECT.rules[0].parts[0].patterns[1].pixels[middle_coord][middle_coord] = 1;

    // play pattern
    const cells_width = play_w * PROJECT.tile_size;
    const cells_height = play_h * PROJECT.tile_size;

    PROJECT.play_pattern = {
        id: 'play',
        width: cells_width,
        height: cells_height,
        pixels: Array.from({ length: cells_height }, () => Array(cells_width).fill(0))
    };
}

function save_project() {
    const data = JSON.stringify(PROJECT);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.json";
    a.click();
    
    URL.revokeObjectURL(url);
}

function save_play_png() {
    const a = document.createElement("a");
    const pixel_canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("screen-canvas"));
    if (!pixel_canvas) throw new Error("Main canvas element not found");
    a.href = pixel_canvas.toDataURL("image/png");
    a.download = "play_pattern.png";
    a.click();

    URL.revokeObjectURL(a.href);
}

/** @param {render_callback} render_fn */
function use_file_input_and_load(render_fn) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";

    input.addEventListener("change", () => {
        const file = input.files ? input.files[0] : null;
        if (file) load_project(file, render_fn);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

export function palette_changed() {
    // make text colors that have contrast with the background
    PROJECT.palette.forEach((color, i) => {
        const rgb = color.match(/\w\w/g)?.map((c) => parseInt(c, 16));
        if (!rgb) return;
        const brightness = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
        const new_css_color = (brightness > 127) ? "black" : "white";
        UI_STATE.text_contrast_palette[i] = new_css_color;
    });

    // change the tool settings to the new palette
    const palette_setting = TOOL_SETTINGS.find(s => s.option_key === 'selected_palette_value');
    if (!palette_setting) throw new Error("Palette setting not found");

    // first, make an option for every color in the palette with ordered keys
    palette_setting.options = PROJECT.palette.map((_hex, i) => {
        const num = i + 1; // start from 1, not 0
        return { value: num, label: num.toString(), keys: [num.toString()] };
    });
    // the last color needs to be 0, so the values go 1, 2, 3... 0.
    palette_setting.options[palette_setting.options.length - 1].value = 0;

    // add wildcard
    palette_setting.options.push({ value: -1, label: "Any", keys: [palette_setting.options.length.toString()] });
}

/**
 * @param {Blob} file 
 * @param {render_callback} render_fn 
 */
export function load_project(file, render_fn) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const string = /** @type {string} */ (reader.result);
            const json = (JSON.parse(string));
            for (const key in json) {
                // @ts-ignore
                if (key in PROJECT) PROJECT[key] = json[key];
            }
            console.log("Loaded project:", PROJECT);          

            clear_undo_stack();
            palette_changed();
            update_css_vars();
            render_fn("play", null);
            render_fn("rules", null);

            OPTIONS.selected_palette_value = 1; // color 1 is at index 0
            render_fn("palette", null);
        } catch (err) {
            alert("Invalid project file.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// drawing

/** 
 * @param {Pattern} pattern - the primary pattern to draw in
 * @param {number} x - the x coordinate to draw at
 * @param {number} y - the y coordinate to draw at
 */
export function start_drawing(pattern, x, y) {
    const state_to_push = pattern.id === 'play' ? PROJECT.play_pattern : PROJECT.rules;
    push_to_undo_stack(pattern.id === 'play', structuredClone(state_to_push), undefined);

    // set at start of drawing
    UI_STATE.draw_start_x = x;
    UI_STATE.draw_start_y = y;
    UI_STATE.draw_x = x;
    UI_STATE.draw_y = y;

    // if multiselect, draw in all selected patterns
    if (PROJECT.selected.type === 'pattern' && PROJECT.selected.paths.length > 1) {
        UI_STATE.draw_patterns = get_selected_rule_patterns(PROJECT.selected);
    } else {
        UI_STATE.draw_patterns = [pattern];
    }

    // clone the pixels for each pattern that is being edited. 
    // this is so that lines and rectangles can be previewed before they are finished.
    UI_STATE.draw_pixels_cloned = UI_STATE.draw_patterns.map((p) => structuredClone(p.pixels));

    // draw
    pick_draw_value(pattern.pixels[y][x]); // based on previous value
    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, OPTIONS.selected_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

/**
 * @param {number} x - the next x coordinate to draw at
 * @param {number} y - the next y coordinate to draw at
 */
export function continue_drawing(x, y) {
    if (OPTIONS.selected_tool !== 'brush') {
        // reset the pixels to the state at the start of drawing
        for (let i = 0; i < UI_STATE.draw_patterns.length; i++) {
            UI_STATE.draw_patterns[i].pixels = structuredClone(UI_STATE.draw_pixels_cloned[i]);
        }
    }
    UI_STATE.draw_x = x;
    UI_STATE.draw_y = y;

    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, OPTIONS.selected_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

/** @param {render_callback} render_fn */
export function finish_drawing(render_fn) {
    if (!UI_STATE.is_drawing) return;
    
    UI_STATE.is_drawing = false;
    UI_STATE.draw_start_x = null;
    UI_STATE.draw_start_y = null;
    UI_STATE.draw_x = null;
    UI_STATE.draw_y = null;
    if (UI_STATE.draw_patterns.length === 1 && 
        UI_STATE.draw_patterns[0].id === 'play' &&
        OPTIONS.run_after_change) {
        // run the action after drawing
        console.log("Running after drawing...");
        const action_fn = ACTIONS.find(a => a.id === 'run_all')?.action;
        if (action_fn) do_action(action_fn, 'run_all', render_fn);
    }
}

/** @param {number} value_at_pixel - the value at the pixel where the user started drawing */
function pick_draw_value(value_at_pixel) {
    if (OPTIONS.selected_tool !== 'brush') {
        // simply use the new value
        UI_STATE.draw_value = OPTIONS.selected_palette_value;
        return;
    }
    // when starting on the color itself, erase instead of draw
    UI_STATE.draw_value = (value_at_pixel === OPTIONS.selected_palette_value) ? 
      0 : OPTIONS.selected_palette_value;
}

/**
 * @param {Selection} target_sel - the selection to move the current selection to
 * @param {render_callback} render_fn 
 */
export function do_drop_action(target_sel, render_fn) {
    // save state for undo
    const play_selected = PROJECT.selected.type === 'play';
    const previous_state = structuredClone(play_selected ? PROJECT.play_pattern : PROJECT.rules);
    const previous_selection = structuredClone(PROJECT.selected);

    const success = move_selection_to_part(PROJECT.selected, target_sel);
    if (success) {
        // change selection
        PROJECT.selected = success.new_selected;

        // render changes
        if (success.render_play) render_fn("play", null);

        if (success.render_ids.size) {
            [...success.render_ids].forEach(id => { render_fn("rules", { rule_id: id }); });
        }

        push_to_undo_stack(play_selected, previous_state, previous_selection);
    }
}