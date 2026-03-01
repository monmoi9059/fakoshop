import re
with open("fakoshop.html", "r") as f:
    content = f.read()

# Replace the startPosition logic for continuous tools
start_logic_repl = """
        const isContinuous = (isAirbrush && currentTool === 'brush') || currentTool === 'spray';

        if (isContinuous) {
            clearInterval(airbrushInterval);
            airbrushInterval = setInterval(() => {
                if (painting) {
                    if (currentTool === 'spray') {
                        draw(null, true); // Mock continuous spray
                    } else {
                        drawAirbrush();
                    }
                }
            }, 50); // 20 times a second

            if (currentTool === 'spray') {
                draw(e);
            } else {
                drawAirbrush();
            }
        } else {
            draw(e);
        }
"""
content = re.sub(
    r"        if \(isAirbrush && currentTool === 'brush'\) \{\n            // Start Airbrush\n            clearInterval\(airbrushInterval\);\n            airbrushInterval = setInterval\(\(\) => \{\n                if \(painting\) \{\n                    drawAirbrush\(\);\n                \}\n            \}, 50\); // 20 times a second\n            drawAirbrush\(\); // Draw immediately too\n        \} else \{\n            draw\(e\);\n        \}",
    start_logic_repl.strip(),
    content,
    flags=re.DOTALL
)

# Modify draw() definition and early return
draw_def_repl = """
function draw(e, isContinuousMock = false) {
    let x, y;
    if (isContinuousMock) {
        x = window.lastMouseX;
        y = window.lastMouseY;
        if (x === undefined || y === undefined) return;
    } else {
        const coords = getCanvasCoordinates(e);
        x = coords.x;
        y = coords.y;

        // Handle Panning
        if (isPanning) {
            const dx = coords.screenX - lastPanX;
            const dy = coords.screenY - lastPanY;
            panX += dx;
            panY += dy;
            lastPanX = coords.screenX;
            lastPanY = coords.screenY;
            renderCanvas();
            return;
        }

        // Update coordinates for preview
        window.lastMouseX = x;
        window.lastMouseY = y;
    }
"""

content = re.sub(
    r"function draw\(e\) \{\n    const coords = getCanvasCoordinates\(e\);\n    const x = coords.x;\n    const y = coords.y;\n\n    // Handle Panning\n    if \(isPanning\) \{\n        const dx = coords.screenX - lastPanX;\n        const dy = coords.screenY - lastPanY;\n        panX \+= dx;\n        panY \+= dy;\n        lastPanX = coords.screenX;\n        lastPanY = coords.screenY;\n        renderCanvas\(\);\n        return;\n    \}\n\n    // Update coordinates for preview\n    window.lastMouseX = x;\n    window.lastMouseY = y;",
    draw_def_repl.strip(),
    content,
    flags=re.DOTALL
)

# The early return in draw() should only apply to Airbrush, NOT Spray. Because Spray logic is INSIDE draw().
# Actually, the original code had:
# if (isAirbrush && currentTool === 'brush') { window.lastMouseX = x; window.lastMouseY = y; return; }
# This is perfect, because Airbrush has its own drawAirbrush() function. Spray uses draw()!
# Wait, if Spray uses draw() continuously, we don't want it to return early! So the existing check `if (isAirbrush && currentTool === 'brush')` is exactly right!
# We DO NOT need to add `|| currentTool === 'spray'` to the early return.

with open("fakoshop.html", "w") as f:
    f.write(content)

print("Patch applied.")
