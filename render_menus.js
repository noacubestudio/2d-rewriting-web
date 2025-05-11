import { PROJECT, OPTIONS, UI_STATE, UNDO_STACK, INITIAL_DEFAULT_PALETTE } from "./state.js";
import { value_to_color } from "./utils.js";

import { ACTIONS, ACTION_BUTTON_VISIBILITY, TOOL_SETTINGS } from "./actions.js";
import { do_tool_setting, do_action, save_options, palette_changed, set_default_project_and_render } from "./actions.js";

import { update_selected_els, update_play_pattern_el, update_all_rule_els } from "./render_project.js";

const ACTIONS_CONTAINER_EL = document.getElementById("actions-container");
const TOOL_SETTINGS_CONTAINER_EL = document.getElementById("tool-settings-container");

/** @typedef {import('./state.js').Options} Options */


// init

export function render_menus() {
    if (!ACTIONS_CONTAINER_EL) throw new Error("No actions container found");
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");

    ACTIONS.forEach(({hint, action, id, keys}) => {
        if (!hint) return; // skip
        const btn = document.createElement("button");
        btn.textContent = hint;
        btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
        btn.className = "action-button";
        btn.classList.add(id ? "action-" + id : "action-button");
        btn.addEventListener("click", () => { do_action(action, id); });
        ACTIONS_CONTAINER_EL.appendChild(btn);
    });

    // make container for options and add label in front
    for (const [group_key, group] of Object.entries(TOOL_SETTINGS)) {
        const group_container = document.createElement("div");
        group_container.className = "options-container";
        group_container.dataset.group = group_key;
        if (group.label) {
            const group_label_el = document.createElement("label");
            group_label_el.textContent = group.label;
            group_label_el.className = "group-label";
            group_container.appendChild(group_label_el);
        }
        populate_with_options(group_container, /** @type {keyof Options} */ (group_key), group.options);
        TOOL_SETTINGS_CONTAINER_EL.appendChild(group_container);
    }

    // show the right buttons for the initial selection
    update_action_buttons_for_selection();
}

/** 
 * @param {HTMLDivElement} group_container 
 * @param {keyof Options} option_key
 * @param {{label: string, keys: string[] | null, value: any }[]} options - the options to add
 */
function populate_with_options(group_container, option_key, options) {
    // add options to container
    options.forEach(({label, keys, value}) => {
        const btn = document.createElement("button");
        btn.className = "tool-button";
        btn.dataset.group = option_key;
        btn.dataset.option_value = value.toString();
        if (value === OPTIONS[option_key]) btn.classList.add("active"); // initially active button
        if (option_key === "selected_palette_value") {
            btn.classList.add("color-button");
            if (value !== -1) {
                btn.style.backgroundColor = value_to_color(value);
                btn.style.backgroundImage = "none";
                btn.style.color = UI_STATE.text_contrast_palette[value] || "black"; // magenta is missing bg color
            }
        }
        btn.textContent = label;
        btn.title = (keys) ? "Hotkey: " + prettify_hotkey_names(keys) : "No hotkey"; // tooltip
        btn.addEventListener("click", () => { 
            const result = do_tool_setting(value, option_key); 
            if (result?.render_selected) update_selected_els(PROJECT.selected, null);

            const matching_buttons = group_container.querySelectorAll(`button[data-group="${option_key}"]`);
            matching_buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active")
        });
        group_container.appendChild(btn);
    });
}

export function update_action_buttons_for_selection() {
    if (!ACTIONS_CONTAINER_EL) throw new Error("No actions container found");

    const sel_type = PROJECT.selected.type;
    const vis = ACTION_BUTTON_VISIBILITY;
    const hide_id = /** @param {string} id */ (id) => ACTIONS_CONTAINER_EL.querySelectorAll(`.action-${id}`).forEach(b => b.classList.add("hidden"));

    // show by default
    ACTIONS_CONTAINER_EL.querySelectorAll(".action-button").forEach(b => b.classList.remove("hidden"));

    ACTIONS.forEach(({id}) => {
        // hide when the id matches a group, but that group is not selected
        if (vis.nothing_selected.includes(id)) {
            if (sel_type !== null) hide_id(id);

        } else if (vis.play_selected.includes(id)) {
            if (sel_type !== 'play') hide_id(id);

        } else if (vis.rules_selected.includes(id)) {
            if (sel_type === null || sel_type === "play") hide_id(id);

        } else if (vis.something_selected.includes(id)) {
            if (!sel_type) hide_id(id);
        }
    });

    // some actions change based on selection
    const undo_button = ACTIONS_CONTAINER_EL.querySelector(`.action-undo`);
    if (undo_button) {
        const last_sel_type = UNDO_STACK.last_undo_stack_types[UNDO_STACK.last_undo_stack_types.length - 1];
        const show_play = sel_type === 'play' || (sel_type === null && last_sel_type === "play");
        undo_button.textContent = "♻️ Undo " + (show_play ? "(Main Grid)" : "(Rule Editor)");
    }
}

/** 
 * @param {keyof Options} group_id
 * @param {any} selected_value - the value that needs to be highlighted
 */
export function update_tool_button_set(group_id, selected_value) {
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");
    const container_el = /** @type {HTMLDivElement} */ (TOOL_SETTINGS_CONTAINER_EL.querySelector(`.options-container[data-group="${group_id}"]`));
    if (!container_el) throw new Error(`Container for ${group_id} not found`);

    container_el.innerHTML = ""; // clear old buttons
    const group_object = TOOL_SETTINGS[group_id];
    if (!group_object) throw new Error(`Toolbar group object ${group_id} not found`);
    
    populate_with_options(container_el, group_id, group_object.options);
    select_tool_button(group_id, selected_value);
}

/**
 * @param {keyof Options} group_id - the group of buttons to update
 * @param {any} value - the value that needs to be highlighted
 * @param {boolean} [is_temp] - if true, the button will be highlighted as temporary
 */
export function select_tool_button(group_id, value, is_temp) {
    if (!TOOL_SETTINGS_CONTAINER_EL) throw new Error("No tool settings container found");

    /** @type {NodeListOf<HTMLElement>} */
    const btns_in_group = TOOL_SETTINGS_CONTAINER_EL.querySelectorAll(`button[data-group="${group_id}"]`);
    btns_in_group.forEach(b => {
        b.classList.remove("active");
        b.classList.remove("temp_active");

        if (b.dataset.option_value === value.toString()) {
            b.classList.add(is_temp ? "temp_active" : "active");
        }
    });
}

export function create_dialog_listeners() {
    const dialog_els = {
        new_project: /** @type {HTMLDialogElement} */(document.getElementById("new-project-dialog")),
        edit_project: /** @type {HTMLDialogElement} */(document.getElementById("edit-project-dialog")),
    }
    const input_els = {
        tile_size: /** @type {HTMLInputElement} */(document.getElementById("tile-size-input")),
        palette: /** @type {HTMLInputElement} */(document.getElementById("palette-input")),
        animation_speed: /** @type {HTMLInputElement} */(document.getElementById("animation-speed-input")),
    }

    // when opened, update
    openedDialog(dialog_els.new_project, () => {
        input_els.tile_size.value = OPTIONS.default_tile_size.toString();
    });
    openedDialog(dialog_els.edit_project, () => {
        input_els.palette.value = PROJECT.palette.join(" ");
        input_els.animation_speed.value = OPTIONS.animation_speed.toString();
    });
    
    // when closed, check if ok was pressed and save the values
    dialog_els.new_project.addEventListener("close", () => {
        if (dialog_els.new_project.returnValue === "ok") {
            const new_tile_size = +input_els.tile_size.value;
            if (isNaN(new_tile_size) || new_tile_size < 1) {
                alert("Invalid tile size. Please enter a positive number.");
                return;
            }
            OPTIONS.default_tile_size = new_tile_size;
            save_options();
    
            // reset the project
            set_default_project_and_render();
        }
    });
    dialog_els.edit_project.addEventListener("close", () => {
        if (dialog_els.edit_project.returnValue === "ok") {
            const new_palette = input_els.palette.value.split(" ").map(c => c.trim()).filter(c => c.length > 0);
            let new_palette_hex = [];

            if (new_palette.length === 0) {
                new_palette_hex = structuredClone(INITIAL_DEFAULT_PALETTE);
                
            } else if (new_palette.length < 2) {
                alert("Invalid palette. Please enter at least 2 colors.");
                return;

            } else {
                // remove # at the start. make sure all are 6 digit hex codes, if necessary cut or repeat.
                new_palette_hex = new_palette.map(c => {
                    if (c.startsWith("#")) c = c.slice(1);
                    if (c.length === 3) c = c.split("").map(d => d + d).join("");
                    if (c.length !== 6) return "#ff00ff"; // magenta
                    return "#" + c;
                });
            }

            // change palette for the project and remember as new default
            PROJECT.palette = new_palette_hex;
            OPTIONS.selected_palette_value = 1;
            OPTIONS.default_palette = structuredClone(new_palette_hex);

            OPTIONS.animation_speed = +input_els.animation_speed.value;

            save_options();
            palette_changed();

            // change in the UI
            update_tool_button_set('selected_palette_value', OPTIONS.selected_palette_value);
            update_play_pattern_el();
            update_all_rule_els();
        }
    });

    /**
     * hacky, because there is no open event for dialog elements.
     * @param {HTMLDialogElement} el 
     * @param {Function} fn 
     */
    function openedDialog(el, fn) {
        new MutationObserver(() => {
            if (el.open) fn();
        }).observe(el, { attributes: true, attributeFilter: ['open'] });
    }
}


// helpers

/** @param {string[]} keys */
function prettify_hotkey_names(keys) {
    return keys.map(key => {
        switch (key) {
            case "ArrowUp": return "↑";
            case "ArrowDown": return "↓";
            case "ArrowLeft": return "←";
            case "ArrowRight": return "→";
            case "Control": return "CTRL";
            case " ": return "SPACE";
            default: return key.toUpperCase();
        }
    }).join(" + ");
}