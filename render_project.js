import { PROJECT, OPTIONS, UI_STATE } from "./state.js";
import { palette_value_to_color, selections_equal } from "./utils.js";

import { drop_sel_into, eyedrop, start_drawing, continue_drawing, finish_drawing } from "./actions.js";

import { select_tool_button, update_action_buttons_for_selection } from "./render_menus.js";

/** @typedef {import('./state.js').Rule} Rule */
/** @typedef {import('./state.js').Pattern} Pattern */
/** @typedef {import('./state.js').Selection} Selection */

const RULES_CONTAINER_EL = document.getElementById("rules-container");
const SCREEN_CONTAINER_EL = document.getElementById("screen-container");


// rendering functions

/**
 * @param {Rule} rule - the rule to create the element for
 * @returns {HTMLDivElement} - the rule element
 */
function create_rule_el(rule) {
    const rule_el = document.createElement("div");
    rule_el.className = "rule";
    rule_el.dataset.id = rule.id;

    /** 
     * @param {HTMLDivElement} el 
     * @param {HTMLDivElement | null} outer_el - the outer element to check for hover
     * @param {HTMLDivElement | null} outmost_el - the outmost element to check for hover
     */
    function add_pointer_events_for_hover(el, outer_el, outmost_el) {
        el.addEventListener("pointerenter", () => {
            rule_el.classList.remove("hovered");
            rule_el.querySelectorAll(".hovered").forEach(el => el.classList.remove("hovered"));
            el.classList.add("hovered");
        });
        el.addEventListener("pointerleave", (e) => {
            el.classList.remove("hovered");
            const el_at_pointer = document.elementFromPoint(e.clientX, e.clientY);
            if (outmost_el && outmost_el === el_at_pointer) { 
                outmost_el.classList.add("hovered");
            } else if (outer_el && outer_el === el_at_pointer) { 
                outer_el.classList.add("hovered");
            }
        });
    }
    add_pointer_events_for_hover(rule_el, null, null);

    // rule labels
    const rule_label_div = document.createElement("div");
    rule_label_div.className = "rule-label-container";

    const rule_index_label = document.createElement("label");
    rule_index_label.className = "rule-label";
    rule_index_label.textContent = rule.current_index.toString() || "?";
    rule_label_div.appendChild(rule_index_label);

    // rule details
    const rule_expanded_count = (rule.rotate && rule.mirror) ? 8 : (rule.rotate || rule.mirror) ? 4 : 1;
    if (rule_expanded_count > 1) {
        const rule_details_label = document.createElement("label");
        rule_details_label.className = "rule-label";

        let rule_details_text = "";
        if (rule.rotate) {
            rule_details_text += "+";
            rule_el.classList.add("flag-rotate");
        }
        if (rule.mirror) {
            rule_details_text += "%";
            rule_el.classList.add("flag-mirror");
        }
        //rule_details_text += `${rule_expanded_count}`;
        rule_details_label.textContent = rule_details_text;

        rule_label_div.appendChild(rule_details_label);
    }
    rule_el.appendChild(rule_label_div);

    // group
    if (rule.part_of_group) rule_el.classList.add("flag-group");

    // rule content
    const rule_content = document.createElement("div");
    rule_content.className = "rule-content";
    rule_el.appendChild(rule_content);

    // comment
    if (rule.show_comment) {
        const is_area = rule.parts.length === 0;
        const rule_comment = document.createElement(is_area ? "textarea" : "input");
        rule_comment.className = "rule-comment";
        rule_comment.value = rule.comment || "";
        rule_comment.placeholder = "Add a comment...";
        if (is_area) {
            /** @type {HTMLTextAreaElement} */
            (rule_comment).rows = 1;
            rule_el.classList.add("comment-only");
        }
        rule_comment.addEventListener("input", (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            rule.comment = target.value;
            resize_input(rule_comment, is_area);
        });

        /** 
         * @param {HTMLInputElement | HTMLTextAreaElement} el
         * @param {boolean} is_area
         */
        function resize_input(el, is_area) {
            if (is_area) {
                // match width to fill rules container
                const container_width = /** @type {HTMLElement} */ ( RULES_CONTAINER_EL).clientWidth - 70; // generous padding
                el.style.width = Math.min(container_width, 600) + "px";
                // match height to content
                el.style.height = "";
                el.style.height = Math.max(el.scrollHeight + 2, 20) + "px";
                return;
            }

            const ghost = document.getElementById('input-ghost');
            if (!ghost) throw new Error("No ghost input found");
            ghost.textContent = el.value || el.placeholder || " ";
            ghost.style.font = window.getComputedStyle(el).font;
            el.style.width = (ghost.scrollWidth + 14) + "px"; // padding
        }

        rule_content.appendChild(rule_comment);
        requestAnimationFrame(() => resize_input(rule_comment, is_area)); // initial
    }

    // keypress label
    if (rule.keybind) {
        const rule_keybind = document.createElement("label");
        rule_keybind.className = "rule-io-label";
        rule_keybind.textContent = "on key: " + (rule.rotate ? '→ (↓, ←, ↑)' : 'X');
        rule_keybind.title = "This rule is triggered by key input";
        rule_content.appendChild(rule_keybind);
    }

    // parts
    const rule_parts = document.createElement("div");
    rule_parts.className = "rule-parts";
    rule_content.appendChild(rule_parts);
    rule.parts.forEach(part => {
        const part_el = document.createElement("div");
        part_el.className = "rule-part";
        part_el.dataset.id = part.id;
        add_pointer_events_for_hover(part_el, rule_el, null);

        part.patterns.forEach((pattern, pat_index) => {
            const pattern_el = document.createElement("div");
            pattern_el.className = "rule-pattern";
            pattern_el.dataset.id = pattern.id;
            add_pointer_events_for_hover(pattern_el, part_el, rule_el);

            pattern_el.addEventListener("dragstart", (e) => {
                e.dataTransfer?.setData("text/plain", ''); // neeeded on webkit to allow dragging pattern
            });

            const canvas = document.createElement("canvas");
            canvas.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
            canvas.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
            draw_pattern_to_canvas(pattern, canvas);
            pattern_el.appendChild(canvas);

            const is_selected = PROJECT.selected.type === 'pattern' && 
                PROJECT.selected.paths.find(p => p.pattern_id === pattern.id);

            if (is_selected && OPTIONS.selected_tool !== 'select') {
                const grid = create_pattern_editor_el(pattern, canvas);
                pattern_el.appendChild(grid);
            }

            part_el.appendChild(pattern_el);

            if (pat_index === 0) {
                const arrowEl = document.createElement("label");
                const between_text = part.sync_wildcards ? "🔗" : "→";
                arrowEl.textContent = part.patterns.length > 1 ? between_text : '?';
                arrowEl.style.fontSize = part.patterns.length > 1 ? "1.3em" : "1em";
                part_el.appendChild(arrowEl);
            }
        });

        part_el.addEventListener("dragstart", (e) => {
            e.dataTransfer?.setData("text/plain", ''); // neeeded on webkit to allow dragging part
        });

        part_el.addEventListener("dragover", (e) => {
            if (PROJECT.selected.type === 'part') return; // can drag patterns/play between parts
            e.preventDefault(); // allow drop
            part_el.classList.add("drop-target");
        });
        part_el.addEventListener("dragleave", () => {
            part_el.classList.remove("drop-target");
        });
        part_el.addEventListener("drop", (e) => {
            e.preventDefault();
            part_el.classList.remove("drop-target");
            
            if (PROJECT.selected.type === 'pattern' || PROJECT.selected.type === 'play') {
                console.log(`Dropped pattern(s) on part: ${part_el.dataset.id}`);
                drop_sel_into(get_new_sel(part_el));
            }
        });

        rule_parts.appendChild(part_el);
    });

    rule_el.addEventListener("dragover", (e) => {
        if (PROJECT.selected.type !== 'part') return; // can drag parts between rules
        e.preventDefault(); // allow drop
        rule_el.classList.add("drop-target");
    });
    rule_el.addEventListener("dragleave", () => {
        rule_el.classList.remove("drop-target");
    });
    rule_el.addEventListener("drop", (e) => {
        e.preventDefault();
        rule_el.classList.remove("drop-target");

        if (PROJECT.selected.type === 'part') {
            console.log(`Dropped part(s) on rule: ${rule_el.dataset.id}`);
            drop_sel_into(get_new_sel(rule_el));
        }
    });

    // indicate if the rule starts animation
    if (rule.trigger_animation_loop) {
        const start_animation_label = document.createElement("label");
        start_animation_label.className = "rule-io-label";
        start_animation_label.textContent = "→ Animation Loop";
        start_animation_label.title = "This rule triggers the rules to run again in an animation loop";
        // rule_el.classList.add("flag-trigger-animation-loop");
        rule_content.appendChild(start_animation_label);
    }

    // highlight selected elements in rule
    if (PROJECT.selected.type !== 'play') {
        PROJECT.selected.paths.forEach(sel_path => {
            if (sel_path.rule_id === rule.id) apply_selection(sel_path, rule_el)
        });
    }
    return rule_el;

    /**
     * Show the selection on the right elements in the rule.
     * Also make selected patterns and parts draggable.
     * @param {import("./state.js").Selection_Path} sel_path - the selection path to highlight
     * @param {HTMLDivElement} rule_el - the rule element to highlight in
     */
    function apply_selection(sel_path, rule_el) {
        if ('part_id' in sel_path) {
            /** @type {HTMLDivElement | null} */
            const part_el = rule_el.querySelector(`.rule-part[data-id="${sel_path.part_id}"]`);

            if (part_el && 'pattern_id' in sel_path) {
                /** @type {HTMLDivElement | null} */
                const pattern_el = part_el.querySelector(`.rule-pattern[data-id="${sel_path.pattern_id}"]`);

                if (pattern_el) {
                    pattern_el.classList.add("selected");
                    pattern_el.draggable = true;
                }
            } else if (part_el) {
                part_el.classList.add("selected");
                part_el.draggable = true;
            }
        } else {
            rule_el.classList.add("selected");
        }
    }
}

/**
 * @param {HTMLCanvasElement} el 
 * @param {PointerEvent} event 
 * @param {boolean} keep_in_bounds - if true, clamp the position to the canvas bounds
 * @returns {{ x: number, y: number } | null} - the pixel position in the canvas, or null if out of bounds
 */
function get_pixel_position(el, event, keep_in_bounds) {
    const rect = el.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / OPTIONS.pixel_scale);
    const y = Math.floor((event.clientY - rect.top) / OPTIONS.pixel_scale);
    const clamped_x = Math.max(0, Math.min(x, el.width / OPTIONS.pixel_scale - 1)); // clamp to width
    const clamped_y = Math.max(0, Math.min(y, el.height / OPTIONS.pixel_scale - 1)); // clamp to height
    if (!keep_in_bounds && (x !== clamped_x || y !== clamped_y)) return null;
    return { x: clamped_x, y: clamped_y };
}

/**
 * @param {number} x
 * @param {number} y
 */
function highlight_pixel_in_grid_els(x, y) {
    const grid_els = /** @type {NodeListOf<HTMLDivElement>} */ (document.querySelectorAll(".grid"));

    for (const el of grid_els) {
        const highlight_el = /** @type {HTMLDivElement | null} */ (el.querySelector(".pixel-highlight"));
        if (highlight_el) {
            highlight_el.style.left = `${x * OPTIONS.pixel_scale}px`;
            highlight_el.style.top = `${y * OPTIONS.pixel_scale}px`;
        } else {
            const new_highlight_el = document.createElement("div");
            new_highlight_el.className = "pixel-highlight";
            new_highlight_el.style.left = `${x * OPTIONS.pixel_scale}px`;
            new_highlight_el.style.top = `${y * OPTIONS.pixel_scale}px`;
            el.appendChild(new_highlight_el);
        }
    }
}

/**
 * Handle this globally since moving outside the pattern should not stop e.g. the line tool from working.
 * @param {PointerEvent} e
 */
function handle_pointermove_for_patterns(e) {
    // read xy and highlight pixel in grid
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return; // no element under pointer
    const pattern = /** @type {HTMLElement} */ (el.closest(".rule-pattern.selected"));
    const play_pattern = /** @type {HTMLElement} */ (el.closest(".screen-wrap.selected"));
    const canvas = (pattern || play_pattern)?.querySelector("canvas") || UI_STATE.current_pointer_canvas_el;
    if (!canvas) return;

    const pos = get_pixel_position(canvas, e, UI_STATE.is_drawing);
    if (!pos) {
        // out of bounds, so remove all highlight els
        const highlight_els = document.querySelectorAll(".pixel-highlight");
        highlight_els.forEach(el => el.remove());
        return;
    } 
    const { x, y } = pos;
    
    if (x === UI_STATE.current_x && y === UI_STATE.current_y) return; // no change
    UI_STATE.current_x = x;
    UI_STATE.current_y = y;
    highlight_pixel_in_grid_els(x, y);
    
    if (!UI_STATE.is_drawing || !UI_STATE.draw_pattern_active) return; // not drawing
    const current_tool = OPTIONS.temp_selected_tool || OPTIONS.selected_tool;

    if (current_tool === 'eyedropper') {
        const changed = eyedrop(UI_STATE.draw_pattern_active, x, y);
        if (!changed) return;
        select_tool_button('selected_palette_value', OPTIONS.selected_palette_value);
        return;
    }

    // draw and render
    const changed_patterns = continue_drawing(x, y);
    if (PROJECT.selected.type === 'play') { 
        draw_pattern_to_canvas(UI_STATE.draw_pattern_active, canvas); 
        return;
    }
    draw_patterns_to_canvases(changed_patterns);
}

/**
 * @param {Pattern} pattern - the pattern to create the editor for
 * @param {HTMLCanvasElement} canvas - the canvas to draw on
 * @returns {HTMLDivElement} - the grid element
 */
function create_pattern_editor_el(pattern, canvas) {
    const grid = document.createElement("div");
    grid.className = "grid";
    if (PROJECT.tile_size > 1) grid.classList.add("show-tiles");
    grid.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    grid.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;

    grid.addEventListener("pointerdown", (e) => {
        const current_tool = OPTIONS.temp_selected_tool || OPTIONS.selected_tool;
        if (current_tool === 'select') return; // not a drawing tool.
        e.preventDefault();

        UI_STATE.is_drawing = true;
        UI_STATE.draw_pattern_active = pattern;
        UI_STATE.current_pointer_canvas_el = canvas; // store the canvas for pointermove even when not on the canvas

        const { x, y } = /** @type {{x: Number, y: Number}} */ (get_pixel_position(canvas, e, true));
        UI_STATE.current_x = x;
        UI_STATE.current_y = y;
        highlight_pixel_in_grid_els(x, y);

        if (current_tool === 'eyedropper') {
            eyedrop(pattern, x, y);
            select_tool_button('selected_palette_value', OPTIONS.selected_palette_value);
            return;
        }

        // setup, draw, render. could be multiple patterns at once.
        const changed_patterns = start_drawing(pattern, x, y);
        if (pattern.id === PROJECT.play_pattern.id) { draw_pattern_to_canvas(pattern, canvas); return; }
        draw_patterns_to_canvases(changed_patterns);
    });

    return grid;
}

/**
 * @param {Pattern} pattern - the pattern to draw
 * @param {HTMLCanvasElement} canvas - the canvas to draw on
 * @returns {void}
 */
function draw_pattern_to_canvas(pattern, canvas) {
    const scale = OPTIONS.pixel_scale;
    canvas.width = pattern.width * scale;
    canvas.height = pattern.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context found for canvas");
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const value = (pattern.pixels[y] !== undefined) ? pattern.pixels[y][x] : null;
            ctx.fillStyle = palette_value_to_color(value);
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

/** @param {Pattern[]} patterns - the patterns to draw */
function draw_patterns_to_canvases(patterns) {
    patterns.forEach(p => {
        /** @type {HTMLCanvasElement | null} */
        const canvas = document.querySelector(`.rule-pattern[data-id="${p.id}"] canvas`);
        if (canvas) draw_pattern_to_canvas(p, canvas);
    });
}


export function update_all_rule_els() {
    if (!RULES_CONTAINER_EL) throw new Error("No rules container found");
    const was_scroll_position = RULES_CONTAINER_EL.scrollTop;

    RULES_CONTAINER_EL.innerHTML = "";
    PROJECT.rules.forEach((rule, index) => {
        rule.current_index = index + 1;
        const rule_el = create_rule_el(rule);
        RULES_CONTAINER_EL.appendChild(rule_el);
    });
    // console.log(`Rendered all ${PROJECT.rules.length} rules`);

    // scroll to the previous position
    RULES_CONTAINER_EL.scrollTop = Math.min(was_scroll_position, RULES_CONTAINER_EL.scrollHeight);
}

export function update_all_rule_indices() {
    if (!RULES_CONTAINER_EL) throw new Error("No rules container found");
    RULES_CONTAINER_EL.querySelectorAll(".rule").forEach((rule_el, index) => {
        const rule_label = rule_el.querySelector(".rule-label");
        if (rule_label) rule_label.textContent = (index + 1).toString() || "?";
    });
}

/** @param {string} rule_id */
export function update_rule_el_by_id(rule_id) {
    if (!RULES_CONTAINER_EL) throw new Error("No rules container found");
    const index = PROJECT.rules.findIndex(r => r.id === rule_id);

    // Remove existing DOM node
    const old_el = document.querySelector(`.rule[data-id="${rule_id}"]`);
    if (old_el) old_el.remove();

    // Re-render and insert at the right position
    if (index === -1) return; // only if it exists still
    PROJECT.rules[index].current_index = index + 1;
    const new_el = create_rule_el(PROJECT.rules[index]);
    RULES_CONTAINER_EL.insertBefore(new_el, RULES_CONTAINER_EL.children[index]);

    // console.log(`Rendered rule with id: ${rule_id}`);
}

export function update_play_pattern_el() {
    if (!SCREEN_CONTAINER_EL) throw new Error("No screen container found");

    /** @type {HTMLCanvasElement | null} */
    const canvas = /***/ (document.getElementById("screen-canvas"));
    /** @type {HTMLDivElement | null} */
    const wrap_el = SCREEN_CONTAINER_EL.querySelector("#screen-container .screen-wrap");
    if (!canvas || !wrap_el) throw new Error("No screen canvas or wrap element found");

    // draw pattern again
    const pattern = PROJECT.play_pattern;
    canvas.style.width = `${pattern.width * OPTIONS.pixel_scale}px`;
    canvas.style.height = `${pattern.height * OPTIONS.pixel_scale}px`;
    draw_pattern_to_canvas(pattern, canvas);

    // show selection and editor grid if selected, also make draggable
    wrap_el.querySelectorAll(".grid").forEach(grid => grid.remove());
    if (PROJECT.selected.type === 'play') {
        wrap_el.classList.add("selected");
        wrap_el.draggable = true;

        if (OPTIONS.selected_tool === 'select') return; // no grid for select tool
        const grid = create_pattern_editor_el(pattern, canvas);
        wrap_el.appendChild(grid);
    } else{
        wrap_el.classList.remove("selected");
        wrap_el.draggable = false;
    }
    // console.log("Rendered play pattern");
}

/**
 * Render elements again that lost or gained selection.
 * @param {Selection} old_sel - the existing selection to update
 * @param {Selection | null} new_sel - the new selection to update
 * @returns {void}
 */
export function update_selected_els(old_sel, new_sel) {
    // re-render play pattern
    if (old_sel.type === 'play' || new_sel?.type === 'play') update_play_pattern_el();

    // collect rule IDs to re-render
    const old_rule_ids = new Set(old_sel.paths.map(p => p.rule_id).filter(Boolean));
    const new_rule_ids = new_sel ? new Set(new_sel.paths.map(p => p.rule_id).filter(Boolean)) : new Set();
    const all_rule_ids = new Set([...old_rule_ids, ...new_rule_ids]);
    
    for (const rule_id of all_rule_ids) {
        update_rule_el_by_id(rule_id);
    }
}

export function create_selection_listeners() {
    window.addEventListener("pointermove", (e) => {
        handle_pointermove_for_patterns(e);
    });

    const project_container = document.getElementById("project-container");
    if (!project_container) throw new Error("No project container found");

    // select/ deselect patterns, parts and rules.
    // finish drawing.
    // highlight pixel in grid.
    project_container.addEventListener("pointerup", (e) => {
        if (UI_STATE.is_drawing) {
            finish_drawing();
            return;
        }
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target) return;
        if (["INPUT", "TEXTAREA"].includes(target.tagName)) return; // comment input does not change selection

        // select rules, parts or patterns.
        const old_sel = structuredClone(PROJECT.selected);
        const new_sel = get_new_sel(target);
        const is_pattern_ish = new_sel.type === 'pattern' || new_sel.type === 'play';

        const current_tool = OPTIONS.temp_selected_tool || OPTIONS.selected_tool;
        if (new_sel.type !== 'play' && current_tool === 'select') {
            if (PROJECT.selected.type !== new_sel.type) {
                // if the type is different, restart selection
                PROJECT.selected = new_sel;
            } else {
                // add or remove from selection
                PROJECT.selected = toggle_in_selection(PROJECT.selected, new_sel);
            }
        } else {
            // basic toggle
            const same = selections_equal(old_sel, new_sel);
            const should_toggle = same && !is_pattern_ish;
            PROJECT.selected = should_toggle ? { type: null, paths: [] } : new_sel;
            if (same && !should_toggle) return; // no change
        }
        update_selected_els(old_sel, new_sel);
        update_action_buttons_for_selection();

        // highlight pixel in grid

        /** @type {HTMLCanvasElement | null | undefined} */
        const canvas = (() => {
            if (new_sel.type === 'play') {
                return SCREEN_CONTAINER_EL?.querySelector(".screen-wrap canvas");
            } else if (new_sel.type === 'pattern') {
                const target_pattern_id = new_sel.paths[0].pattern_id;
                return RULES_CONTAINER_EL?.querySelector(`.rule-pattern[data-id="${target_pattern_id}"] canvas`);
            }
            return; // no canvas to highlight
        })();
        if (!canvas) return;
        UI_STATE.current_pointer_canvas_el = canvas; // store for pointermove

        const { x, y } = /** @type {{x: Number, y: Number}} */ (get_pixel_position(canvas, e, true));
        UI_STATE.current_x = x;
        UI_STATE.current_y = y;
        highlight_pixel_in_grid_els(x, y);
    });
}

export function create_play_pattern_listeners() {
    if (!SCREEN_CONTAINER_EL) throw new Error("No screen container found");
    /** @type {HTMLDivElement | null} */
    const main_el = SCREEN_CONTAINER_EL.querySelector("#screen-container .screen-wrap");
    if (!main_el) throw new Error("No screen wrap element found");

    main_el.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", ''); // neeeded on webkit
    });

    main_el.addEventListener("dragover", (e) => {
        if (PROJECT.selected.type !== 'pattern') return; // can drag patterns onto play pattern
        e.preventDefault(); // allow drop
        main_el.classList.add("drop-target");
    });
    main_el.addEventListener("dragleave", () => {
        main_el.classList.remove("drop-target");
    });
    main_el.addEventListener("drop", (e) => {
        e.preventDefault();
        main_el.classList.remove("drop-target");
        
        if (PROJECT.selected.type === 'pattern') {
            console.log(`Dropped pattern(s) on play pattern.`);
            /** @type {Selection} */
            const target_sel = { type: 'play', paths: [] };
            drop_sel_into(target_sel);
        }
    });
}


// helper

/**
 * @param {HTMLElement} el - element that was clicked
 * @returns {Selection}
 */
function get_new_sel(el) {
    const rule    = /** @type {HTMLElement} */ (el.closest(".rule"));
    const part    = /** @type {HTMLElement} */ (el.closest(".rule-part"));
    const pattern = /** @type {HTMLElement} */ (el.closest(".rule-pattern"));
    const play_pattern = /** @type {HTMLElement} */ (el.closest(".screen-wrap"));

    if (play_pattern) return { type: 'play', paths: [] }; // play pattern selected

    if (!rule || !rule.dataset.id) return { type: null, paths: [] }; // no rule selected

    if (!part || !part.dataset.id) return { type: 'rule', paths: [{ // no part selected, is rule
        rule_id: rule.dataset.id
    }]};

    if (!pattern || !pattern.dataset.id) return { type: 'part', paths: [{ // no pattern selected, is part
        rule_id: rule.dataset.id,
        part_id: part.dataset.id
    }]};

    return { type: 'pattern', paths: [{ // pattern selected
        rule_id: rule.dataset.id,
        part_id: part.dataset.id,
        pattern_id: pattern.dataset.id
    }]};
}

/**
 * @param {Selection} base_sel - the base selection to modify
 * @param {Selection} new_sel - the new selection to toggle
 * @returns {Selection} - the modified base selection
 */
function toggle_in_selection(base_sel, new_sel) {
    // go through base_sel and modify and return it.
    // assume that new_sel is a single path.
    const index = base_sel.paths.findIndex(p => {
        return p.rule_id === new_sel.paths[0].rule_id && 
               p.part_id === new_sel.paths[0].part_id && 
               p.pattern_id === new_sel.paths[0].pattern_id;
    });
    if (index >= 0) {
        base_sel.paths.splice(index, 1); // deselect
    } else {
        base_sel.paths.push(new_sel.paths[0]); // add
    }
    return base_sel;
}