import { PROJECT, OPTIONS, TEMP_OPTIONS, UI_STATE, UNDO_STACK } from "./state.js";
import { UNDO_STACK_LIMIT_PLAY, UNDO_STACK_LIMIT_RULES, RULE_APPLICATION_LIMIT, DEFAULT_ANIMATION_SPEED } from "./state.js";
import { clear_undo_stack, clear_project_obj } from "./state.js";

import { generate_id, get_blank_pattern, get_short_timestamp, selections_equal, get_closest_palette_index } from "./utils.js";

import { draw_in_pattern, rotate_pattern, flip_pattern, apply_rule } from "./edit-pattern.js";
import { get_selected_rule_patterns, get_selected_rule_objects, move_sel_to_dest } from "./edit-selection.js";
import { toggle_rule_flag, toggle_part_flag, duplicate_sel, delete_sel, clear_sel, reorder_sel, add_text_above_sel } from "./edit-selection.js";
import { resize_patterns_in_sel, rotate_patterns_in_sel, flip_patterns_in_sel, shift_patterns_in_sel } from "./edit-selection.js";

import { update_action_buttons_for_selection, update_tool_button_set, update_undo_button } from "./render_menus.js";
import { update_all_rule_els, update_all_rule_indices, update_play_pattern_el, update_rule_el_by_id, update_selected_els } from "./render_project.js";

/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').Selection} Selection */
/** @typedef {import('./state.js').Options} Options */
/** @typedef {import('./state.js').Tool} Tool */
/** @typedef {import('./state.js').Project} Project */

/** @typedef {import('./edit-selection.js').Selection_Edit_Output} Selection_Edit_Output */


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
    { id: "run"      , hint: "▶️ Run Selected", keys: ["Enter"                ], action: /** @param {Selection} s */ (s) => apply_rules(s, null) },
    { id: "run_all"  , hint: "▶️ Run All"     , keys: [" "                    ], action: () => apply_rules(null, null) },
    { id: "stop"     , hint: "⏸️ Stop"        , keys: ["Escape"               ], action: () => stop_rules() },

    // actions that are not undoable themselves. render callbacks for most other functions are in do_action()
    { id: "undo"     , hint: "♻️ Undo Action" , keys: ["z"                    ], action: () => undo_action() },
    { id: "undo"     , hint: null             , keys: ["u"                    ], action: () => undo_action() },
    { id: "load"     , hint: "📂 Load"        , keys: ["Shift", "o"           ], action: () => use_file_input_and_load(load_project, false) },
    { id: "loadpng"  , hint: "📷 Load PNG"    , keys: null                     , action: () => use_file_input_and_load(load_play_from_image, true) },
    { id: "save"     , hint: "💾 Save"        , keys: ["Shift", "s"           ], action: () => save_project() },
    { id: "savepng"  , hint: "📷 Save PNG"    , keys: null                     , action: () => save_play_png() },
    { id: "new"      , hint: "❇️ New"         , keys: ["Shift", "n"           ], action: () => new_project() },
    { id: "settings" , hint: "⚙️ Settings"    , keys: null                     , action: () => edit_project() },
    { id: "scale"    , hint: "➖ Px Scale"    , keys: ["-"                    ], action: () => zoom_pixel_grids(-1) },
    { id: "scale"    , hint: "➕ Px Scale"    , keys: ["="                    ], action: () => zoom_pixel_grids(1) },

    { id: "delete"   , hint: "❌ Delete"      , keys: ["Delete"               ], action: /** @param {Selection} s */ (s) => delete_sel(s) },
    { id: "clear"    , hint: "🧼 Clear"       , keys: ["w"                    ], action: /** @param {Selection} s */ (s) => clear_sel(s) },
    { id: "duplicate", hint: "📄 Duplicate"   , keys: ["d"                    ], action: /** @param {Selection} s */ (s) => duplicate_sel(s) },
    { id: "add_text" , hint: "📝 Add Text"    , keys: ["t"                    ], action: /** @param {Selection} s */ (s) => add_text_above_sel(s) },

    { id: "rule_flag", hint: "☑️ Rotations"   , keys: ["Alt", "r"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'rotate') },
    { id: "rule_flag", hint: "☑️ Mirrors"     , keys: ["Alt", "m"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'mirror') },
    { id: "rule_flag", hint: "☑️ Group"       , keys: ["Alt", "g"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'part_of_group') },
    { id: "rule_flag", hint: "☑️ Comment"     , keys: ["Alt", "c"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'show_comment') },
    { id: "rule_flag", hint: "☑️ Keybind"     , keys: ["Alt", "k"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'keybind') },
    { id: "rule_flag", hint: "☑️ Animation"   , keys: ["Alt", "a"             ], action: /** @param {Selection} s */ (s) => toggle_rule_flag(s, 'trigger_animation_loop') },
    { id: "part_flag", hint: "☑️ Link 'Any'"  , keys: ["Alt", "w"             ], action: /** @param {Selection} s */ (s) => toggle_part_flag(s, 'sync_wildcards') },

    { id: "input"    , hint: "⬅️ Left"        , keys: ["ArrowLeft"            ], action: () => apply_rules(null, "left") },
    { id: "input"    , hint: "➡️ Right"       , keys: ["ArrowRight"           ], action: () => apply_rules(null, "right") },
    { id: "input"    , hint: "⬆️ Up"          , keys: ["ArrowUp"              ], action: () => apply_rules(null, "up") },
    { id: "input"    , hint: "⬇️ Down"        , keys: ["ArrowDown"            ], action: () => apply_rules(null, "down") },
    { id: "input"    , hint: "❎ Action"      , keys: ["x"                    ], action: () => apply_rules(null, "x") },

    { id: "swap"     , hint: null             , keys: ["ArrowUp"    , "Shift" ], action: /** @param {Selection} s */ (s) => reorder_sel(s,-1) },
    { id: "swap"     , hint: null             , keys: ["ArrowDown"  , "Shift" ], action: /** @param {Selection} s */ (s) => reorder_sel(s,1) },
    { id: "swap"     , hint: "⬅️ Swap Back"   , keys: ["ArrowLeft"  , "Shift" ], action: /** @param {Selection} s */ (s) => reorder_sel(s,-1) },
    { id: "swap"     , hint: "➡️ Swap Next"   , keys: ["ArrowRight" , "Shift" ], action: /** @param {Selection} s */ (s) => reorder_sel(s,1) },
    { id: "resize"   , hint: "➖ Width"       , keys: ["ArrowLeft" , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_sel(s,-1,0) },
    { id: "resize"   , hint: "➕ Width"       , keys: ["ArrowRight", "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_sel(s,1,0) },
    { id: "resize"   , hint: "➖ Height"      , keys: ["ArrowUp"   , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_sel(s,0,-1) },
    { id: "resize"   , hint: "➕ Height"      , keys: ["ArrowDown" , "Control"], action: /** @param {Selection} s */ (s) => resize_patterns_in_sel(s,0,1) },
    { id: "rotate"   , hint: "🔃 Rotate"      , keys: ["r"                    ], action: /** @param {Selection} s */ (s) => rotate_patterns_in_sel(s) },
    { id: "flip"     , hint: "↔️ Flip Hor."   , keys: ["h"                    ], action: /** @param {Selection} s */ (s) => flip_patterns_in_sel(s, true, false) },
    { id: "flip"     , hint: "↕️ Flip Ver."   , keys: ["v"                    ], action: /** @param {Selection} s */ (s) => flip_patterns_in_sel(s, false, true) },
    { id: "shift"    , hint: "⬅️ Shift Left"  , keys: ["ArrowLeft" , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_sel(s,-1,0) },
    { id: "shift"    , hint: "➡️ Shift Right" , keys: ["ArrowRight", "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_sel(s,1,0) },
    { id: "shift"    , hint: "⬆️ Shift Up"    , keys: ["ArrowUp"   , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_sel(s,0,-1) },
    { id: "shift"    , hint: "⬇️ Shift Down"  , keys: ["ArrowDown" , "Alt"    ], action: /** @param {Selection} s */ (s) => shift_patterns_in_sel(s,0,1) },
];
export const ACTION_BUTTON_VISIBILITY = {
    nothing_selected:   ['save', 'load', 'new', 'scale', 'settings', 'input'],
    rules_selected:     ['run', 'delete', 'duplicate', 'swap', 'rule_flag', 'part_flag', 'add_text'],
    play_selected:      ['savepng', 'loadpng'],
    something_selected: ['resize', 'rotate', 'flip', 'shift', 'clear'],
};
const NOT_UNDOABLE_ACTIONS = ['save', 'savepng', 'load', 'loadpng', 'new', 'scale', 'settings', 'undo', 'stop'];


/** 
 * Tool settings are not part of the undo stack and are not saved to the project.
 * @typedef {Object} Tool_Setting
 * @property {string | null} label
 * @property {keyof Options} [temp_option_key] - change while held, reset to null on release
 * @property {{ value: string | boolean | number, label: string, keys: (string[] | null)}[]} options - array of options for the setting
*/

/**
 * @typedef {Object.<keyof Options, Tool_Setting>} Tool_Settings
 * @property {Tool_Setting} selected_palette_value - the palette to use for the tool
 * @property {Tool_Setting} selected_tool - the tool to use
 * @property {Tool_Setting} run_after_change - whether to run the rules after a change
*/

/** @type {Tool_Settings} */
export const TOOL_SETTINGS = {
    selected_palette_value: { label: "Palette", options: [ /* generated */ ]},
    selected_tool:          { label: "Tool"   , temp_option_key: "temp_selected_tool", options: [
        { value: 'brush'     , label: "✏️", keys: ["b"] },
        { value: 'line'      , label: "➖", keys: ["l"] },
        { value: 'rect'      , label: "🔳", keys: ["t"] },
        { value: 'fill'      , label: "🪣", keys: ["f"] },
        { value: 'eyedropper', label: "🔍", keys: ["i"] },
        { value: 'select'    , label: "✅", keys: ["Shift"] },
    ]},
    run_after_change:       { label: "Run after change", options: [ 
        { value: false, label: "Off", keys: null },
        { value: true , label: "On" , keys: null },
    ]},
};

/**
 * * Perform an action on the selected pattern or play pattern.
 * @param {function} action 
 * @param {string} id 
 */
export function do_action(action, id) {
    if (NOT_UNDOABLE_ACTIONS.includes(id)) {
        action();
        return;
    }

    if (id === 'run' || id === 'run_all' || id === 'run_after_change' || id === 'input') {

        // manually run rules.
        // if an animation is ongoing, should this work or not? TODO

        // change the play pattern.
        const previous_state = structuredClone(PROJECT.play_pattern);

        const run_again = run_rules_once(action, id);
        // set next timestamp - after this, it will be handled by the animation loop.
        const anim_speed = OPTIONS.animation_speed ?? DEFAULT_ANIMATION_SPEED;
        UI_STATE.next_timestamp = (run_again) ? performance.now() + anim_speed : null;

        // if ran manually, save the state for undo
        if (id === 'run_after_change') return;
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
            update_play_pattern_el();
        } else if (success.render_ids.size) {
            [...success.render_ids].forEach(update_rule_el_by_id); // re-render - or just remove if deleted
            if (success.reordered) update_all_rule_indices(); // make sure indices are correct
        } else {
            console.warn("Action occured, but no re-render specified");
        }

        push_to_undo_stack(play_selected, previous_state, previous_selection);

        // run after change
        if (OPTIONS.run_after_change && play_selected) {
            console.log("Running after an edit...");
            do_action(() => apply_rules(null, null), 'run_after_change');
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
    const undo_stack_limit = play_selected ? UNDO_STACK_LIMIT_PLAY : UNDO_STACK_LIMIT_RULES;
    // @ts-ignore
    undo_stack.push(state_to_push);
    UNDO_STACK.last_undo_stack_types.push(undo_stack_type);
    if (undo_stack.length > undo_stack_limit) undo_stack.shift();

    update_undo_button(); // show the last type of undoable action

    if (play_selected) return;
    // also push the selection to the undo stack
    UNDO_STACK.selected.push(selection_to_push || PROJECT.selected);
    if (UNDO_STACK.selected.length > undo_stack_limit) UNDO_STACK.selected.shift();
}

function undo_action() {
    const last_stack_type = UNDO_STACK.last_undo_stack_types.pop();

    if (PROJECT.selected.type === 'play' || (last_stack_type === 'play' && PROJECT.selected.type === null)) {
        const last_play_pattern = UNDO_STACK.play_pattern.pop();
        if (last_play_pattern) {
            PROJECT.play_pattern = last_play_pattern;
            update_play_pattern_el();
            update_undo_button();
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
        update_all_rule_els();
        update_undo_button();

        // undo selection to state before action
        const old_sel = structuredClone(PROJECT.selected);
        const same = selections_equal(old_sel, last_selection);
        if (!same) {
            PROJECT.selected = last_selection;
            update_selected_els(old_sel, last_selection);
        }
        console.log("undo rules");
        return;
    }
    console.log("Nothing to undo");
}

/**
 * Run the rules. This can trigger again in an animation loop.
 * @param {function} action 
 * @param {string} id 
 * @return {true | undefined} - true if an animation was triggered
 */
export function run_rules_once(action, id) {
    const timestamp = performance.now();
    const stats = action(PROJECT.selected); // actually run.
    if (!stats) {
        console.warn(`Action '${id}' probably failed, could not get stats.`);
        return;
    }
    const rules_took = performance.now() - timestamp;

    // log stats
    const { 
        application_count, failed_count, 
        groups_application_count, groups_failed_count, 
        groups_that_hit_limit 
    } = stats;

    if (groups_that_hit_limit.length > 0) {
        console.warn(`Rule groups ${groups_that_hit_limit.join(', ')} reached the application limit of ${RULE_APPLICATION_LIMIT}`);
    }

    if (id !== 'run_again') console.log(`Ran rules. (Mode: ${id}, ${groups_application_count} / ${groups_application_count + groups_failed_count} groups, ${stats.rules_count} rule(s))`);
    console.log(`${application_count} / ${application_count + failed_count} matched in ${rules_took.toFixed(2)}ms.`);

    // done
    if (stats.application_count > 0) {
        update_play_pattern_el();
        if (stats.triggered_animation) return true;
        // TODO - think about what to do with the stats when animated.
    }
}

function stop_rules() {
    // stop the animation loop and reset the next timestamp
    UI_STATE.next_timestamp = null;
    console.log("Stopping rules.");
}

/** 
 * Run the rules on the play pattern.
 * @param {Selection | null} sel
 * @param {"left" | "right" | "up" | "down" | "x" | null} input - key input that will trigger certain rules
 */
export function apply_rules(sel, input) {
    const group_loop_limit = RULE_APPLICATION_LIMIT;
    const step_size = PROJECT.tile_size; // the size of the step to take when applying rules
    const stats = {
        rules_count: 0,
        application_count: 0,
        failed_count: 0,
        groups_application_count: 0,
        groups_failed_count: 0,
        /** @type {string[]} */
        groups_that_hit_limit: [],
        triggered_animation: false,
    };

    // if there are certain rules selected, only apply those rules.
    // return groups of rules (id, rules) to be applied.
    const ruleset = process_rules(PROJECT.rules, sel, input);
    if (!ruleset) { 
        console.warn("No rules to apply.");
        return; // no rules to apply
    }

    // for each group of rules, loop through the rules and apply them.
    // the id is the rule id that expanded into a group of rules. (the first one)
    ruleset.forEach(({ id, rules }) => {
        let rule_index = 0;
        let max_index_reached = 0;
        let group_application_count = 0;
        let group_failed_count = 0;
        let search_from = { x: 0, y: 0 };

        // after a rule applies, go back to the start of the group.
        // if a rule fails, try the next one in the group.
        // rules that apply return the first changed tile position, so that further rules start searching from there.
        // whenever a new rule index is reached, reset the search position to the start of the play pattern.
        // this is because their patterns could still be anywhere.

        while (group_application_count < group_loop_limit && rule_index < rules.length) {
            const rule = rules[rule_index];
            const first_change = apply_rule(PROJECT.play_pattern, rule, step_size, search_from);
            if (first_change) {
                search_from = { x: first_change.x, y: first_change.y };
                group_application_count++;
                rule_index = 0; // reset to start of group
                if (rule.trigger_animation_loop) stats.triggered_animation = true;
            } else {
                group_failed_count++;
                rule_index++; // try the next rule in the group
                if (rule_index >= max_index_reached) {
                    max_index_reached = rule_index; // keep track of the highest index reached
                    search_from = { x: 0, y: 0 };
                }
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

        stats.rules_count += rules.length;
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
 * @param {Selection | null} sel
 * @param {"left" | "right" | "up" | "down" | "x" | null} input
 * @return {Processed_Rule_Group[]} - array of rule groups to be applied
 */
function process_rules(rules, sel, input) {
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

    rules.forEach((rule) => {
        // skip if the rule is not selected
        if (selected_rule_ids && !selected_rule_ids.has(rule.id)) return;

        // skip if the rule has no parts in it
        if (rule.parts.length === 0) return;

        // skip if rule is key controlled but no input was given
        const missing_x_input = (input !== 'x' && rule.keybind && !rule.rotate);
        const missing_dir_input = ((!input || input === 'x') && rule.keybind && rule.rotate);
        if (!selected_rule_ids && (missing_x_input || missing_dir_input)) return;

        // if part of a group, don't make a new one. this feature is deactivated when the rule is selected for simplicity.
        /** @type {Processed_Rule_Group} */
        const group = (rule.part_of_group && !sel) ? ruleset[ruleset.length - 1] : { id: rule.id, rules: [] };

        const filter_input = (rule.keybind && !selected_rule_ids) ? input : null;
        expand_rule_group(group, rule, filter_input);

        if (!rule.part_of_group || sel) ruleset.push(group); // add new group to the ruleset
    });
    return ruleset;
}

/**
 * push the right rotations/ mirrors of the rule to the group.
 * @param {Processed_Rule_Group} group 
 * @param {Rule} rule
 * @param {"left" | "right" | "up" | "down" | "x" | null} filter_input
 */
function expand_rule_group(group, rule, filter_input) {
    if (rule.rotate) {
        if (filter_input) {
            // if there is a key input, add only the specific rotation that matches
            const dir_to_index = { right: 0, down: 1, left: 2, up: 3 };
            const keep_index = (filter_input !== 'x') ? dir_to_index[filter_input] : null;
            if (keep_index === null) return;
            
            const correct_rule_version = structuredClone(rule);
            get_rule_patterns(correct_rule_version).forEach((p) => { rotate_pattern(p, keep_index); });
            group.rules.push(correct_rule_version);
            
            if (rule.mirror) {
                console.warn("Rule is mirrored, but not rotated in all directions at once. This is not supported yet.");
            }
        } else {
            // push and add other 3 rotated versions of the rule
            group.rules.push(rule);
            let next_rule_version = rule;
            for (let i = 0; i < 3; i++) {
                next_rule_version = structuredClone(next_rule_version);
                get_rule_patterns(next_rule_version).forEach((p) => { rotate_pattern(p); });
                group.rules.push(next_rule_version);
            }
            // push mirrored versions of each
            if (rule.mirror) {
                const start_index = group.rules.length - 4; // the last 4 rules are the rotated ones
                for (let i = 0; i < 4; i++) {
                    const rule_to_mirror = structuredClone(group.rules[start_index + i]);
                    get_rule_patterns(rule_to_mirror).forEach((p) => { flip_pattern(p); });
                    group.rules.push(rule_to_mirror);
                }
            }
        }
    } else if (rule.mirror) {
        if (filter_input) {
            if (filter_input === 'right') {
                group.rules.push(rule);
            } else if (filter_input === 'left') {
                const left_rule = structuredClone(rule);
                get_rule_patterns(left_rule).forEach((p) => { flip_pattern(p, true); });
                group.rules.push(left_rule);
            } else {
                console.log("A rule was ignored because mirrored rules currently only support left and right when keybound.");
            }
        } else {
            group.rules.push(rule);

            const v_version = structuredClone(rule);
            get_rule_patterns(v_version).forEach((p) => { flip_pattern(p); });
    
            const h_version = structuredClone(rule);
            get_rule_patterns(h_version).forEach((p) => { flip_pattern(p, true); });
    
            const vh_version = structuredClone(v_version);
            get_rule_patterns(vh_version).forEach((p) => { flip_pattern(p, true); });
    
            group.rules.push(v_version);
            group.rules.push(h_version);
            group.rules.push(vh_version);
        }
    } else {
        group.rules.push(rule);
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
}



/**
 * Change the value of a setting in the options object.
 * @template {keyof Options} K
 * @param {Options[K]} value
 * @param {K} option_key
 * @param {K} [temp_option_key]
 * @returns { { render_selected: boolean } | undefined }
 */
export function do_tool_setting(value, option_key, temp_option_key) {
    const previous_value = OPTIONS[option_key];

    if (temp_option_key) {
        console.log("Temporary option set:", temp_option_key, value);
        OPTIONS[temp_option_key] = value;
    } else if (option_key) {
        console.log("Option set:", option_key, value);
        OPTIONS[option_key] = value;
        save_options();
    }

    if (option_key === 'selected_tool' && (value === 'select' || previous_value === 'select')) {
        // from/ to a brush tool, so show/ hide the editor grid. requires a re-render.
        return { render_selected: true };
    }
}

/** @param {number} change */
function zoom_pixel_grids(change) {
    OPTIONS.pixel_scale += change;
    OPTIONS.pixel_scale = Math.max(2, Math.min(OPTIONS.pixel_scale, 100));
    save_options();
    update_css_vars();

    // render everything again
    update_play_pattern_el();
    update_all_rule_els();
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

export function set_default_project_and_render() {
    // setup rules and play pattern to the default state
    clear_project_obj();
    clear_undo_stack();

    set_default_project();
    palette_changed();
    update_css_vars();

    update_play_pattern_el();
    update_all_rule_els();
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
        current_index: -1
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
    a.download = `Project ${get_short_timestamp()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function save_play_png() {
    const a = document.createElement("a");
    const pixel_canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("screen-canvas"));
    if (!pixel_canvas) throw new Error("Main canvas element not found");
    a.href = pixel_canvas.toDataURL("image/png");
    a.download = `Pattern ${get_short_timestamp()} @x${OPTIONS.pixel_scale}.png`;
    a.click();

    URL.revokeObjectURL(a.href);
}

/**
 * Open a file input to load a project or play state.
 * @param {function} load_function - function to call when the file is loaded
 * @param {boolean} needs_image - whether the file is an image or a json file
 */
function use_file_input_and_load(load_function, needs_image) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = needs_image ? "image/png" : "application/json";
    input.style.display = "none";

    input.addEventListener("change", () => {
        const file = input.files ? input.files[0] : null;
        if (file) load_function(file, file.name.split(".")[0]);
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
    const palette_setting = TOOL_SETTINGS.selected_palette_value;

    // first, make an option for every color in the palette with ordered keys
    palette_setting.options = PROJECT.palette.map((_hex, i) => {
        const num = i + 1; // start from 1, not 0
        return { value: i, label: i.toString(), keys: [i.toString()] };
    });

    // add wildcard
    palette_setting.options.push({ value: -1, label: "Any", keys: [palette_setting.options.length.toString()] });
}

/** @param {Blob} file */
export function load_project(file) {
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
            update_play_pattern_el();
            update_all_rule_els();

            OPTIONS.selected_palette_value = 1; // color 1 is at index 0
            update_tool_button_set('selected_palette_value', OPTIONS.selected_palette_value);
            update_action_buttons_for_selection(); // nothing selected, undo reset
        } catch (err) {
            alert("Invalid project file.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

/** 
 * @param {Blob} file
 * @param {string} name
 */
export function load_play_from_image(file, name) {
    console.log("Loading play pattern from image:", name);
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            // if the image name ends in '@x{number}', use that as the zoom scale
            // also make sure that the zoom scale is increased if the image is too big, to only sample every nth pixel.
            const MAX_PLAY_PATTERN_SIZE = 128;
            const fit_scale = Math.floor(Math.max(img.width, img.height) / MAX_PLAY_PATTERN_SIZE);

            let zoom_scale = parseInt(name.match(/@x(\d+)/) ?.[1] || '1');
            zoom_scale = Math.max(1, Math.max(zoom_scale, fit_scale));
            const w = Math.floor(img.width / zoom_scale);
            const h = Math.floor(img.height / zoom_scale);

            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;

            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Could not get 2D context");
            ctx.scale(1 / zoom_scale, 1 / zoom_scale);
            ctx.drawImage(img, 0, 0);

            const image_data = ctx.getImageData(0, 0, w, h);
            const palette_as_rgb = PROJECT.palette.map((hex) => {
                // starts with #
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return {r, g, b};
            });

            // pad with 0 to right/ bottom to make it a multiple of the tile size
            const final_w = Math.ceil(w / PROJECT.tile_size) * PROJECT.tile_size;
            const final_h = Math.ceil(h / PROJECT.tile_size) * PROJECT.tile_size;
            const pixels = Array.from({ length: final_h }, () => Array(final_w).fill(0));
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const index = (y * w + x) * 4;
                    const r = image_data.data[index];
                    const g = image_data.data[index + 1];
                    const b = image_data.data[index + 2];
                    const a = image_data.data[index + 3];
                    pixels[y][x] = get_closest_palette_index(r, g, b, a, palette_as_rgb);
                }
            }
            PROJECT.play_pattern.width = final_w;
            PROJECT.play_pattern.height = final_h;
            PROJECT.play_pattern.pixels = pixels;
            update_play_pattern_el();
        };
        img.src = /** @type {string} */ (reader.result);
    };
    
    reader.readAsDataURL(file);
}

// drawing

/** 
 * @param {Pattern} pattern
 * @param {number} x
 * @param {number} y
 */
export function eyedrop(pattern, x, y) {
    const value_at_pixel = pattern.pixels[y][x];
    if (value_at_pixel === OPTIONS.selected_palette_value) return; // no change
    do_tool_setting(value_at_pixel, 'selected_palette_value');
    return true;
}

/** 
 * @param {number} value_at_pixel - the value at the pixel where the user started drawing 
 * @param {Tool} tool - the tool that is currently selected
 */
function pick_draw_value(value_at_pixel, tool) {
    if (tool !== 'brush') {
        // simply use the new value
        UI_STATE.draw_value = OPTIONS.selected_palette_value;
        return;
    }
    // when starting on the color itself, erase instead of draw
    UI_STATE.draw_value = (value_at_pixel === OPTIONS.selected_palette_value) ? 
      0 : OPTIONS.selected_palette_value;
}

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
    const current_tool = TEMP_OPTIONS.selected_tool || OPTIONS.selected_tool;
    pick_draw_value(pattern.pixels[y][x], current_tool); // based on previous value
    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, current_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

/**
 * @param {number} x - the next x coordinate to draw at
 * @param {number} y - the next y coordinate to draw at
 */
export function continue_drawing(x, y) {
    const current_tool = TEMP_OPTIONS.selected_tool || OPTIONS.selected_tool;
    if (current_tool !== 'brush') {
        // reset the pixels to the state at the start of drawing
        for (let i = 0; i < UI_STATE.draw_patterns.length; i++) {
            UI_STATE.draw_patterns[i].pixels = structuredClone(UI_STATE.draw_pixels_cloned[i]);
        }
    }

    UI_STATE.draw_patterns.forEach((p) => draw_in_pattern(p, x, y, current_tool, UI_STATE));
    return UI_STATE.draw_patterns; // render these
}

export function finish_drawing() {
    if (!UI_STATE.is_drawing) return;
    
    UI_STATE.is_drawing = false;
    UI_STATE.draw_start_x = null;
    UI_STATE.draw_start_y = null;
    UI_STATE.current_x = null;
    UI_STATE.current_y = null;
    if (UI_STATE.draw_patterns.length === 1 && 
        UI_STATE.draw_patterns[0].id === 'play' &&
        OPTIONS.run_after_change) {
        // run the action after drawing
        console.log("Running after drawing...");
        do_action(() => apply_rules(null, null), 'run_after_change');
    }
}

/**
 * @param {Selection} target_sel - the selection to move the current selection to
 */
export function drop_sel_into(target_sel) {
    if (target_sel.type === 'play') {
        // keep rules the same, only need to store undo for the play pattern
        const previous_state = structuredClone(PROJECT.play_pattern);
        const success = move_sel_to_dest(PROJECT.selected, target_sel);
        if (!success) return;
        // select, render, and push to undo stack
        PROJECT.selected = success.new_selected;
        update_play_pattern_el();
        push_to_undo_stack(true, previous_state, undefined);
        return;
    }

    // save state for undo
    const previous_state = structuredClone(PROJECT.rules);
    const previous_selection = structuredClone(PROJECT.selected);

    const success = move_sel_to_dest(PROJECT.selected, target_sel);
    if (!success) return;
    // select, render, and push to undo stack
    PROJECT.selected = success.new_selected;
    [...success.render_ids].forEach(update_rule_el_by_id);
    if (success.render_play) update_play_pattern_el();
    push_to_undo_stack(false, previous_state, previous_selection);
}