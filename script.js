// constants
const TILE_SIZE = 8;
const PIXEL_SCALE = 8;
const PIXEL_PALLETTE = ["#222", "#fff"];
const rules_container = document.getElementById("rules-container");

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
    draw_value = (value === ui_state.selected_palette_value) ? 
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

function rules_ui_set_selection(new_path) {
    // remove previous selection
    if (ui_state.selected_path) {
        const old = document.querySelector(build_selector(ui_state.selected_path));
        if (old) old.classList.remove('selected');
        // toggle off
        if (arrays_equal(ui_state.selected_path, new_path) && new_path.length < 3) {
            ui_state.selected_path = null; 
            return;
        }
    }
    if (new_path.length === 0) {
        ui_state.selected_path = null; // no selection
        return;
    }
    // add new selection highlight
    const new_selected = document.querySelector(build_selector(new_path));
    if (new_selected) {
        new_selected.classList.add('selected');
        ui_state.selected_path = new_path;
    }
}

function build_selector(path) {
    let sel = '';
    if (path.length > 0) {
      sel += `.rule[data-index="${path[0]}"]`;
    }
    if (path.length > 1) {
      sel += ` .rule-part[data-index="${path[1]}"]`;
    }
    if (path.length > 2) {
      sel += ` .pattern-wrap[data-index="${path[2]}"]`;
    }
    return sel;
}

function build_path(selected_element) {
    const rule = selected_element.closest('.rule');
    const part = selected_element.closest('.rule-part');
    const wrap = selected_element.closest('.pattern-wrap');
    return [
        rule ? (+rule.dataset.index) : null,
        part ? (+part.dataset.index) : null,
        wrap ? (+wrap.dataset.index) : null
    ].filter(v => v !== null);
}

function render_rule(rule, rule_index) {
    const ruleEl = document.createElement("div");
    ruleEl.className = "rule";
    ruleEl.dataset.index = rule_index;

    // click event
    rules_container.addEventListener("click", (e) => {
        rules_ui_set_selection(build_path(e.target));
    });

    rule.forEach((part, part_index) => {
        const partEl = document.createElement("div");
        partEl.className = "rule-part";
        partEl.dataset.index = part_index;

        part.forEach((pattern, pattern_index) => {
            const wrap = document.createElement("div");
            wrap.className = "pattern-wrap";
            wrap.dataset.index = pattern_index;
            const canvas = document.createElement("canvas");
            canvas.style.width = `${pattern.width * PIXEL_SCALE}px`;
            canvas.style.height = `${pattern.height * PIXEL_SCALE}px`;
            draw_pattern_to_canvas(canvas, pattern);
            wrap.appendChild(canvas);

            let grid = null;
            let timeout = null;

            wrap.addEventListener("mouseenter", () => {
                // remove other active grids
                document.querySelectorAll(".grid").forEach(g => g.remove());

                grid = create_editor_div(pattern, () => {
                    draw_pattern_to_canvas(canvas, pattern); // on change
                });
                wrap.appendChild(grid);
            });

            wrap.addEventListener("mouseleave", () => {
                timeout = setTimeout(() => {
                    if (grid) grid.remove(); 
                    grid = null;
                }, 200); // let mouseout finish
            });

            partEl.appendChild(wrap);
        });
        ruleEl.appendChild(partEl);
    });
    rules_container.appendChild(ruleEl);
}

function render_all_rules() {
    rules_container.innerHTML = "";
    rules.forEach((rule, index) => render_rule(rule, index));
}

add_rule(); // initial
render_all_rules();


// helpers
function arrays_equal(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}