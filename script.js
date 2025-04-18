// constants
const TILE_SIZE = 8;
const PIXEL_SCALE = 8;
const rules_container = document.getElementById("rules-container");

// misc
let id_counter = 0;

// state to save/load
const rules = [];

const ui_state = {
  is_drawing: false,
  selected_palette_value: 1,
  draw_value: 1,
  clipboard: [], // TODO
  selected_path: null,
};

document.addEventListener("keydown", (e) => {
    if (e.key === "Delete") {
        delete_selection();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        reorder_selection(-1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        reorder_selection(1);
    } else if (e.key === "d") {
        duplicate_selection();
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
            ctx.fillStyle = value_to_color(pattern.pixels[y][x]);
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
    const scale = PIXEL_SCALE;
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${pattern.width}, 1fr)`;
    grid.style.width = `${pattern.width * scale}px`;
    grid.style.height = `${pattern.height * scale}px`;

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

function render_rules_selection(old_path, new_path) {
    // remove previous selection
    if (old_path) {
        if (paths_equal(old_path, new_path)) return;
        const old = document.querySelector(build_selector(old_path));
        if (old) old.classList.remove('selected');
    }
    // add new selection highlight
    if (new_path.length === 0) return;
    const new_selection = document.querySelector(build_selector(new_path));
    if (new_selection) new_selection.classList.add('selected');
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

function build_selector(path) {
    let sel = '';
    if (path.rule_id)    sel += `.rule[data-id="${path.rule_id}"]`;
    if (path.part_id)    sel += ` .rule-part[data-id="${path.part_id}"]`;
    if (path.pattern_id) sel += ` .pattern-wrap[data-id="${path.pattern_id}"]`;
    return sel;
}

function render_rule(rule) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.id = rule.id;

    // click event
    rules_container.addEventListener("click", (e) => {
        const new_path = build_path(e.target);
        console.log(new_path);
        const should_toggle = ui_state.selected_path && paths_equal(ui_state.selected_path, new_path) && new_path.length < 3
        render_rules_selection(ui_state.selected_path, new_path);
        ui_state.selected_path = should_toggle ? null : new_path;
    });

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

            let grid = null;
            let timeout = null;

            wrapEl.addEventListener("mouseenter", () => {
                document.querySelectorAll(".grid").forEach(g => g.remove());
                grid = create_editor_div(pattern, () => draw_pattern_to_canvas(canvas, pattern));
                wrapEl.appendChild(grid);
            });

            wrapEl.addEventListener("mouseleave", () => {
                timeout = setTimeout(() => {
                    if (grid) grid.remove(); 
                    grid = null;
                }, 200);
            });

            partEl.appendChild(wrapEl);
            console.log(ruleEl, partEl, wrapEl);
        });

        ruleEl.appendChild(partEl);
    });

    rules_container.appendChild(ruleEl);
}

function render_all_rules() {
    rules_container.innerHTML = "";
    rules.forEach(rule => render_rule(rule));
}

initial_rule();
render_all_rules();


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