// constants
const TILE_SIZE = 8;
const PIXEL_SCALE = 8;
const BOARD_TILES_X = 8;
const BOARD_TILES_Y = 8;

const rules_container = document.getElementById("rules-container");
const screen_container = document.getElementById("screen-container");

const KEY_BINDINGS = [
    { keys: ["Enter"                ], action: () => apply_selected_rule() },
    { keys: ["Delete"               ], action: () => delete_selection() },
    { keys: ["w"                    ], action: () => clear_selection() },
    { keys: ["d"                    ], action: () => duplicate_selection() },
    { keys: ["r"                    ], action: () => rotate_patterns_in_selection() },
    { keys: ["h"                    ], action: () => flip_patterns_in_selection(true, false) },
    { keys: ["v"                    ], action: () => flip_patterns_in_selection(false, true) },
    { keys: ["ArrowUp"              ], action: () => reorder_selection(-1) },
    { keys: ["ArrowDown"            ], action: () => reorder_selection(1) },
    { keys: ["ArrowLeft"            ], action: () => reorder_selection(-1) },
    { keys: ["ArrowRight"           ], action: () => reorder_selection(1) },
    { keys: ["ArrowUp"   , "Control"], action: () => resize_patterns_in_selection(0,-1) },
    { keys: ["ArrowDown" , "Control"], action: () => resize_patterns_in_selection(0,1) },
    { keys: ["ArrowLeft" , "Control"], action: () => resize_patterns_in_selection(-1,0) },
    { keys: ["ArrowRight", "Control"], action: () => resize_patterns_in_selection(1,0) },
    { keys: ["ArrowUp"   , "Alt"    ], action: () => shift_patterns_in_selection(0,-1) },
    { keys: ["ArrowDown" , "Alt"    ], action: () => shift_patterns_in_selection(0,1) },
    { keys: ["ArrowLeft" , "Alt"    ], action: () => shift_patterns_in_selection(-1,0) },
    { keys: ["ArrowRight", "Alt"    ], action: () => shift_patterns_in_selection(1,0) },
];

// state to save/load
const rules = [];
let board = {};

// editor state
let id_counter = 0;
const ui_state = {
  is_drawing: false,
  selected_palette_value: 1,
  draw_value: 1,
  clipboard: [], // TODO
  selected_path: null,
};

document.addEventListener("keydown", (e) => {
    const pressed = new Set([
        e.key,
        ...(e.ctrlKey ? ["Control"] : []),
        ...(e.shiftKey ? ["Shift"] : []),
        ...(e.altKey ? ["Alt"] : []),
    ]);

    for (const binding of KEY_BINDINGS) {
        if (binding.keys.every(k => pressed.has(k)) && binding.keys.length === pressed.size) {
            e.preventDefault();
            binding.action();
            break;
        }
    }
});

function value_to_color(value) { 
    // TODO: think about how to add wildcard color
    const PIXEL_PALLETTE = ["#222", "#fff"];
    return PIXEL_PALLETTE[value] || "magenta";
}

function draw_pattern_to_canvas(canvas, pattern) {
    const scale = PIXEL_SCALE;
    canvas.width = pattern.width * scale;
    canvas.height = pattern.height * scale;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const value = (pattern.pixels[y] !== undefined) ? pattern.pixels[y][x] : null;
            ctx.fillStyle = value_to_color(value);
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

function pick_draw_value(value) {
    // when starting on the color itself, erase instead of draw
    ui_state.draw_value = (value === ui_state.selected_palette_value) ? 
      0 : ui_state.selected_palette_value;
}

function create_editor_div(pattern, on_change) {
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${pattern.width}, 1fr)`;
    grid.style.width = `${pattern.width * PIXEL_SCALE}px`;
    grid.style.height = `${pattern.height * PIXEL_SCALE}px`;
    grid.style.setProperty("--tile-size", TILE_SIZE);
    grid.style.setProperty("--pixel-scale", PIXEL_SCALE);

    // pixels
    for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
            const cell = document.createElement("div");
            cell.className = "pixel";
            // add data-x and data-y attributes
            cell.dataset.x = x;
            cell.dataset.y = y;
            grid.appendChild(cell);
        }
    }

    grid.addEventListener("mousedown", (e) => {
        ui_state.is_drawing = true;
        const cell = e.target;
        if (cell.classList.contains("pixel")) {
            const before = pattern.pixels[+cell.dataset.y][+cell.dataset.x];
            pick_draw_value(before);
            pattern.pixels[+cell.dataset.y][+cell.dataset.x] = ui_state.draw_value;
            on_change();
        }
    });

    grid.addEventListener("mouseup", () => ui_state.is_drawing = false);
    grid.addEventListener("mouseleave", () => ui_state.is_drawing = false);

    grid.addEventListener("mouseover", (e) => {
        if (!ui_state.is_drawing) return;
        const cell = e.target;
        if (cell.classList.contains("pixel")) {
            pattern.pixels[+cell.dataset.y][+cell.dataset.x] = ui_state.draw_value;
            on_change();
        }
    });

    return grid;
}

function build_path(el) {
    const rule = el.closest(".rule");
    const part = el.closest(".rule-part");
    const wrap = el.closest(".pattern-wrap");

    return {
        rule_id: rule?.dataset.id,
        part_id: part?.dataset.id,
        pattern_id: wrap?.dataset.id
    };
}

function render_rule(rule) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.id = rule.id;

    rule.parts.forEach(part => {
        const partEl = document.createElement("div");
        partEl.className = "rule-part";
        partEl.dataset.id = part.id;

        part.patterns.forEach(pattern => {
            const wrapEl = document.createElement("div");
            wrapEl.className = "pattern-wrap";
            wrapEl.dataset.id = pattern.id;

            const canvas = document.createElement("canvas");
            canvas.style.width = `${pattern.width * PIXEL_SCALE}px`;
            canvas.style.height = `${pattern.height * PIXEL_SCALE}px`;
            draw_pattern_to_canvas(canvas, pattern);
            wrapEl.appendChild(canvas);

            const is_selected = ui_state.selected_path?.pattern_id === pattern.id;
            if (is_selected) {
                const grid = create_editor_div(pattern, () => { 
                    draw_pattern_to_canvas(canvas, pattern);
                });
                wrapEl.appendChild(grid);
            }

            partEl.appendChild(wrapEl);
        });

        ruleEl.appendChild(partEl);
    });

    const path = ui_state.selected_path;
    if (path && path.rule_id === rule.id) select_in_rule(path, ruleEl)

    return ruleEl;
}

function select_in_rule(path, ruleEl) {
    if (path.part_id) {
        const partEl = ruleEl.querySelector(`.rule-part[data-id="${path.part_id}"]`);
        if (partEl && path.pattern_id) {
            const patternEl = partEl.querySelector(`.pattern-wrap[data-id="${path.pattern_id}"]`);
            if (patternEl) {
                patternEl.classList.add("selected");
            }
        } else if (partEl) {
            partEl.classList.add("selected");
        }
    } else {
        ruleEl.classList.add("selected");
    }
}

function render_all_rules() {
    rules_container.innerHTML = "";
    rules.forEach(rule => {
        const ruleEl = render_rule(rule);
        rules_container.appendChild(ruleEl);
    });
    console.log("render_all_rules", rules.length);
}

function render_rule_by_id(rule_id) {
    const index = rules.findIndex(r => r.id === rule_id);
    if (index === -1) return;

    // Remove existing DOM node
    const oldEl = document.querySelector(`.rule[data-id="${rule_id}"]`);
    if (oldEl) oldEl.remove();

    // Re-render and insert at the right position
    const newEl = render_rule(rules[index]);
    rules_container.insertBefore(newEl, rules_container.children[index]);

    console.log("render_rule_by_id", rule_id, index);
}

function render_play_pattern() {

    const canvas = document.getElementById("screen-canvas");
    const wrapEl = document.querySelector("#screen-container .screen-wrap");
    const pattern = board;

    canvas.style.width = `${pattern.width * PIXEL_SCALE}px`;
    canvas.style.height = `${pattern.height * PIXEL_SCALE}px`;
    draw_pattern_to_canvas(canvas, pattern);

    const path = ui_state.selected_path;
    wrapEl.querySelectorAll(".grid").forEach(grid => grid.remove());
    if (path?.pattern_id === 'play') {
        const grid = create_editor_div(pattern, () => { 
            draw_pattern_to_canvas(canvas, pattern);
        });
        wrapEl.appendChild(grid);
    }
}

function render_selection_change(old_path, new_path) {
    const old_id = old_path?.rule_id;
    const new_id = new_path?.rule_id;
    // render deselected and selected rule
    if (old_id && old_id !== new_id) render_rule_by_id(old_id);
    if (new_id) render_rule_by_id(new_id);
    // render deselected or selected play pattern
    if (old_path?.pattern_id === 'play' || new_path?.pattern_id === 'play') render_play_pattern();
}

function init() {
    // click event for selection
    rules_container.addEventListener("click", (e) => {
        const old_path = structuredClone(ui_state.selected_path);
        const new_path = build_path(e.target);
        const same = old_path && paths_equal(old_path, new_path);
        const should_toggle = same && new_path.length < 3
        
        ui_state.selected_path = should_toggle ? null : new_path;
        if (same && !should_toggle) return;
        render_selection_change(old_path, new_path);
    });

    screen_container.addEventListener("click", (e) => {
        const old_path = structuredClone(ui_state.selected_path);
        const new_path = { pattern_id: 'play' };
        const same = old_path && paths_equal(old_path, new_path);

        if (same) return;
        ui_state.selected_path = new_path;
        render_selection_change(old_path, new_path);
    });

    initial_rule();
    render_all_rules();

    // init screen
    const wrapEl = document.createElement("div");
    wrapEl.className = "screen-wrap";
    screen_container.appendChild(wrapEl);

    const screen_canvas = document.createElement("canvas");
    screen_canvas.id = "screen-canvas";
    wrapEl.appendChild(screen_canvas);

    initial_play_pattern();
    render_play_pattern();
}
init();


// helpers
function paths_equal(a, b) {
    return a.rule_id === b.rule_id && a.part_id === b.part_id && a.pattern_id === b.pattern_id;
}

function generate_id(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${(id_counter++).toString(36)}`;
}

// each rule, each part, each pattern gets a new id when cloned
function deep_clone_with_ids(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deep_clone_with_ids);
    } else if (obj && typeof obj === 'object') {
        const copy = {};
        for (const key in obj) {
            copy[key] = deep_clone_with_ids(obj[key]);
        }
        if ("pixels" in copy) {
            copy.id = generate_id("pat");
        } else if ("patterns" in copy) {
            copy.id = generate_id("part");
        } else if ("parts" in copy) {
            copy.id = generate_id("rule");
        }
        return copy;
    }
    return obj;
}