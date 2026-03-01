import re

with open("fakoshop.html", "r") as f:
    content = f.read()

# Replace the airbrush interval logic in startPosition
new_start_logic = """
    const advancedBrushes = ['smudge', 'blur-brush', 'sharpen-brush', 'dodge', 'burn', 'spray', 'watercolor', 'marker', 'pencil'];
    if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'clone' || advancedBrushes.includes(currentTool)) {

        // Define which tools trigger the continuous drawing interval loop
        const isContinuous = (isAirbrush && currentTool === 'brush') || currentTool === 'spray';

        if (isContinuous) {
            clearInterval(airbrushInterval);
            airbrushInterval = setInterval(() => {
                if (painting) {
                    if (currentTool === 'spray') {
                        // For spray, just run standard draw logic with current coords to scatter more
                        // The draw function needs an event object or we can mock it
                        // We will mock e to pass to draw()
                        drawContinuousMock();
                    } else {
                        drawAirbrush();
                    }
                }
            }, 50); // 20 times a second

            if (currentTool === 'spray') {
                drawContinuousMock();
            } else {
                drawAirbrush();
            }
        } else {
            draw(e);
        }
    }
"""

content = re.sub(
    r"    const advancedBrushes = \['smudge', 'blur-brush', 'sharpen-brush', 'dodge', 'burn', 'spray', 'watercolor', 'marker', 'pencil'\];\n    if \(currentTool === 'brush'.*?draw\(e\);\n        }\n    }",
    new_start_logic.strip(),
    content,
    flags=re.DOTALL
)

# Add drawContinuousMock right before drawAirbrush
mock_func = """
function drawContinuousMock() {
    if (!painting) return;
    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) return;

    // We need to bypass the LERP smoothing in draw() when continuously spraying in place,
    // or we can just call draw() with a mocked event object containing the window's last screen coordinates.
    // However, draw() uses screen coordinates from the event.
    // Let's just create a mock event.

    // Actually, draw() handles spray directly.
    // But since draw() expects an event to get screen coords, and we only have `window.lastMouseX` (global canvas coords),
    // we must do reverse transform to get screen coords, or just modify draw() to accept null event and use lastMouseX/Y.

    // Let's pass a special flag to draw
    draw(null, true);
}
"""

content = content.replace(
    "function drawAirbrush() {",
    mock_func + "\nfunction drawAirbrush() {"
)

# Modify draw() to handle continuous mock
draw_modification = """
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
    draw_modification.strip(),
    content
)

# Also update the early return in draw() for Airbrush/Spray
content = content.replace(
    "if (isAirbrush && currentTool === 'brush') {",
    "if ((isAirbrush && currentTool === 'brush') || currentTool === 'spray') {"
)

# But wait, if `currentTool === 'spray'`, and it returns early from `draw()`, it won't actually draw anything when we call `draw()`!
# Ah! The previous logic was:
# if (isAirbrush && currentTool === 'brush') { ... return; }
# And `drawAirbrush` had its own drawing code.
# For Spray, the drawing code is inside `draw()`. If we `return` early, we skip the drawing code!

# Let's see how the spray drawing code is placed. It's inside `} else if (advancedBrushes.includes(currentTool)) {`
# And inside that, we have `if (currentTool === 'smudge'...) ... else if (currentTool === 'spray') { ... }`.
