import { PROJECT, OPTIONS, UI_STATE, DEFAULT_ANIMATION_SPEED, load_options_locally } from "./state.js";

// successful actions cause new rendering
import { ACTIONS, TOOL_SETTINGS, set_default_project_and_render, load_project, apply_rules } from "./actions.js";
import { do_action, do_tool_setting, finish_drawing, run_rules_once } from "./actions.js";

// for initial rendering and the window/document events below
import { render_menus, select_tool_button, create_dialog_listeners } from "./render_menus.js";
import { update_selected_els, create_selection_listeners } from "./render_project.js";

/** @typedef {import('./state.js').Options} Options */


// init

load_options_locally();
set_true_vh();

create_selection_listeners();
create_dialog_listeners();

set_default_project_and_render();
render_menus(); // requires basic project to be set up first


/** 
 * main loop. only has an effect currently if rules are queued to run again.
 * @param {DOMHighResTimeStamp} timestamp - the current timestamp from requestAnimationFrame 
 */
function animation_loop(timestamp) {
    requestAnimationFrame(animation_loop);
    if (UI_STATE.next_timestamp && timestamp >= UI_STATE.next_timestamp) {
        const run_again = run_rules_once(() => apply_rules(null, null), 'run_again');
        // set next timestamp
        const anim_speed = OPTIONS.animation_speed ?? DEFAULT_ANIMATION_SPEED;
        UI_STATE.next_timestamp = (run_again) ? timestamp + anim_speed : null;
    }
}
requestAnimationFrame(animation_loop); // start the loop


// keyboard shortcuts
const KEYS_DOWN = new Set();
const KEY_TIMESTAMPS = new Map(); // key -> timestamp
const TRIGGERED_SHORTCUTS = new Set();
const TEMP_TOOL_SETTINGS = new Set(); // if any active

document.addEventListener("keydown", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (UI_STATE.is_drawing) return; // ignore when drawing
    if (["INPUT", "TEXTAREA"].includes(target.tagName)) return; // ignore in inputs

    if (!KEYS_DOWN.has(e.key)) {
        KEYS_DOWN.add(e.key);
        KEY_TIMESTAMPS.set(e.key, performance.now());
    }

    // full key set
    const current_keys = new Set(KEYS_DOWN);
    if (e.ctrlKey) current_keys.add("Control");
    if (e.shiftKey) current_keys.add("Shift");
    if (e.altKey) current_keys.add("Alt");

    // Try ACTION shortcuts
    for (const binding of ACTIONS) {
        if (!binding.keys) continue;

        const match = binding.keys.every(k => current_keys.has(k)) && 
            binding.keys.length === current_keys.size;
        
        if (match && !TRIGGERED_SHORTCUTS.has(binding.id)) {
            TRIGGERED_SHORTCUTS.add(binding.id);
            e.preventDefault();
            do_action(binding.action, binding.id);
            break;
        }   
    }

    // Tool setting shortcurts (temporary on key down if possible)
    for (const [ group_key, group ] of Object.entries(TOOL_SETTINGS)) {
        for (const [_i, binding] of group.options.entries()) {
            if (!binding.keys) continue;

            const match = binding.keys.every((/** @type {any} */ k) => current_keys.has(k)) && 
                binding.keys.length === current_keys.size;
            
            if (match && !TRIGGERED_SHORTCUTS.has(binding.value)) {
                TRIGGERED_SHORTCUTS.add(binding.value);
                e.preventDefault();

                // set (temp or not)
                const result = do_tool_setting(binding.value, group_key, group.temp_option_key);
                if (group.temp_option_key) TEMP_TOOL_SETTINGS.add({ value: binding.value, group, option_key: group_key });

                // render
                if (result?.render_selected) update_selected_els(PROJECT.selected, null);
                select_tool_button(/** @type {keyof Options} */ (group_key), binding.value, (group.temp_option_key));
                break;
            }
        }
    }
});

document.addEventListener("keyup", (e) => {
    const duration = performance.now() - (KEY_TIMESTAMPS.get(e.key) ?? performance.now());
    const temp_only = (KEY_TIMESTAMPS.size === 1 && duration > 200);

    // temp settings now need to be fully applied or reset
    for (const { value, group, option_key } of TEMP_TOOL_SETTINGS) {
        // reset temp
        const result = do_tool_setting(undefined, undefined, group.temp_option_key);
        if (result?.render_selected) update_selected_els(PROJECT.selected, null);

        if (!temp_only) {
            // normal setting
            const result = do_tool_setting(value, option_key, null);
            if (result?.render_selected) update_selected_els(PROJECT.selected, null);
        }

        // for settings that can be temporary but were finally set
        select_tool_button(option_key, OPTIONS[/** @type {keyof Options} */ (option_key)]);
    }

    KEYS_DOWN.delete(e.key);
    KEY_TIMESTAMPS.delete(e.key);
    TRIGGERED_SHORTCUTS.clear(); // reset on first key up
    TEMP_TOOL_SETTINGS.clear(); // reset on first key up
});

// stop gestures when leaving
window.addEventListener("blur", () => finish_drawing());
window.addEventListener("pointercancel", () => finish_drawing());
window.addEventListener("pointerup", () => finish_drawing());

// drag files on window to load
window.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes("Files")) return; // ignore if not files
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
});
window.addEventListener("drop", (e) => {
    // if there's a file
    if (!e.dataTransfer || !e.dataTransfer.types.includes("Files")) return; // ignore if not files
    e.preventDefault();

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
        load_project(file);
    } else {
        alert("Please drop a valid JSON file.");
    }
});

// vh fix
window.addEventListener("resize", set_true_vh);
screen.orientation.addEventListener("change", set_true_vh); // mobile orientation change
function set_true_vh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--vh-100', `${vh * 100}px`);
}