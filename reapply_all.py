import re

with open("fakoshop.html", "r") as f:
    content = f.read()

# 1. Patch Tools
tools_to_insert = """
            <div class="tool" title="Spray Can" onclick="setTool('spray')">💨</div>
            <div class="tool" title="Watercolor" onclick="setTool('watercolor')">🖌️</div>
            <div class="tool" title="Marker" onclick="setTool('marker')">🖍️</div>
            <div class="tool" title="Pencil" onclick="setTool('pencil')">✏️</div>
"""
content = re.sub(
    r'(<div class="tool active" title="Brush Tool \(B\)" onclick="setTool\(\'brush\'\)">🖌️</div>)',
    r'\1' + tools_to_insert,
    content
)
content = re.sub(
    r"const advancedBrushes = \[\'smudge\', \'blur-brush\', \'sharpen-brush\', \'dodge\', \'burn\'\];",
    r"const advancedBrushes = ['smudge', 'blur-brush', 'sharpen-brush', 'dodge', 'burn', 'spray', 'watercolor', 'marker', 'pencil'];",
    content
)

# 2. Patch Options
spray_options_html = """
                <div id="spray-options" style="display: none; margin-left: 10px; align-items: center; gap: 5px;">
                    <select id="spray-type" style="padding: 2px;">
                        <option value="scatter">Scattered Dots</option>
                        <option value="soft">Soft Radial</option>
                        <option value="wide">Wide Nozzle</option>
                        <option value="thin">Thin Nozzle</option>
                    </select>
                </div>
"""
content = content.replace(
    'id="wand-tolerance" value="30" min="0" max="255" style="width: 50px;">\n                </div>',
    'id="wand-tolerance" value="30" min="0" max="255" style="width: 50px;">\n                </div>\n' + spray_options_html
)

content = content.replace(
    "document.getElementById('wand-options').style.display = tool === 'wand' ? 'flex' : 'none';",
    "document.getElementById('wand-options').style.display = tool === 'wand' ? 'flex' : 'none';\n    document.getElementById('spray-options').style.display = tool === 'spray' ? 'flex' : 'none';"
)

content = content.replace(
    "let wandTolerance = 30;",
    "let wandTolerance = 30;\nlet sprayType = 'scatter';"
)

content = content.replace(
    "document.getElementById('wand-tolerance').addEventListener('change', (e) => {\n    wandTolerance = parseInt(e.target.value) || 30;\n});",
    "document.getElementById('wand-tolerance').addEventListener('change', (e) => {\n    wandTolerance = parseInt(e.target.value) || 30;\n});\n\ndocument.getElementById('spray-type').addEventListener('change', (e) => {\n    sprayType = e.target.value;\n});"
)

# 3. Patch Draw
draw_logic = """
        } else if (currentTool === 'spray') {
            const colorRgb = hexToRgb(activeColor);

            let radius = brushSize / 2;
            let density = brushSize; // amount of dots per tick

            if (sprayType === 'wide') {
                radius = brushSize;
                density = brushSize * 2;
            } else if (sprayType === 'thin') {
                radius = brushSize / 4;
                density = brushSize / 2;
            }

            if (sprayType === 'soft') {
                 // Soft radial burst instead of dots
                 const grad = ctx.createRadialGradient(localX, localY, 0, localX, localY, radius);
                 grad.addColorStop(0, `rgba(${colorRgb}, ${brushOpacity * 0.1})`);
                 grad.addColorStop(1, `rgba(${colorRgb}, 0)`);
                 ctx.fillStyle = grad;
                 ctx.beginPath();
                 ctx.arc(localX, localY, radius, 0, Math.PI * 2);
                 ctx.fill();
            } else {
                 // Scattered dots
                 ctx.fillStyle = `rgba(${colorRgb}, ${brushOpacity})`;
                 for (let i = 0; i < density; i++) {
                     const r = radius * Math.sqrt(Math.random());
                     const theta = Math.random() * 2 * Math.PI;
                     const dotX = localX + r * Math.cos(theta);
                     const dotY = localY + r * Math.sin(theta);
                     ctx.fillRect(dotX, dotY, 1, 1);
                 }
            }

        } else if (currentTool === 'watercolor') {
            const colorRgb = hexToRgb(activeColor);

            // Watercolor effect: overlapping semi-transparent circles with slight jitter
            const dist = Math.hypot(localX - (window.lastX || localX), localY - (window.lastY || localY));
            const steps = Math.ceil(dist / (brushSize * 0.25)); // High overlap

            ctx.globalCompositeOperation = 'multiply';

            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 1 : i / steps;
                let cx = (window.lastX || localX) + (localX - (window.lastX || localX)) * t;
                let cy = (window.lastY || localY) + (localY - (window.lastY || localY)) * t;

                // Add slight jitter for natural edge
                cx += (Math.random() - 0.5) * brushSize * 0.1;
                cy += (Math.random() - 0.5) * brushSize * 0.1;

                const grad = ctx.createRadialGradient(cx, cy, brushSize/4, cx, cy, brushSize/2);
                grad.addColorStop(0, `rgba(${colorRgb}, ${brushOpacity * 0.2})`); // Core is denser
                grad.addColorStop(1, `rgba(${colorRgb}, 0)`); // Edge fades out softly

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, brushSize/2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';

        } else if (currentTool === 'marker') {
            const colorRgb = hexToRgb(activeColor);

            // Marker effect: flat semi-transparent hard edge, overlapping darkens
            const dist = Math.hypot(localX - (window.lastX || localX), localY - (window.lastY || localY));
            const steps = Math.ceil(dist);

            // We use 'multiply' to simulate marker ink overlapping
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgba(${colorRgb}, ${brushOpacity * 0.5})`; // Always partly transparent

            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 1 : i / steps;
                const cx = (window.lastX || localX) + (localX - (window.lastX || localX)) * t;
                const cy = (window.lastY || localY) + (localY - (window.lastY || localY)) * t;

                ctx.beginPath();
                ctx.arc(cx, cy, brushSize/2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';

        } else if (currentTool === 'pencil') {
            const colorRgb = hexToRgb(activeColor);

            // Pencil effect: thin, hard edge with low opacity and jitter
            const dist = Math.hypot(localX - (window.lastX || localX), localY - (window.lastY || localY));
            const steps = Math.ceil(dist);

            ctx.fillStyle = `rgba(${colorRgb}, ${brushOpacity * 0.7})`;

            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 1 : i / steps;
                let cx = (window.lastX || localX) + (localX - (window.lastX || localX)) * t;
                let cy = (window.lastY || localY) + (localY - (window.lastY || localY)) * t;

                // Jitter to simulate paper texture
                cx += (Math.random() - 0.5) * 1;
                cy += (Math.random() - 0.5) * 1;

                // Draw small 1x1 or 2x2 blocks depending on brush size, but cap the actual drawn size
                const pencilSize = Math.max(1, Math.min(brushSize, 3));

                ctx.fillRect(cx - pencilSize/2, cy - pencilSize/2, pencilSize, pencilSize);
            }
"""
content = content.replace(
    "} else if (currentTool === 'eraser') {",
    draw_logic + "\n        } else if (currentTool === 'eraser') {"
)

# 4. Patch AI UI
ai_ui_html = """            <div id="ai-tools-bar" style="height: 35px; background-color: var(--bg-panel); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 15px; gap: 10px; font-size: 11px;">
                <span style="color: #a0a0ff; font-weight: bold; margin-right: 5px;">✨ AI Tools:</span>
                <button onclick="aiSimulate('fill')" style="width: auto; margin: 0; padding: 3px 8px;" title="Fills selection with AI generated content">Generative Fill</button>
                <button onclick="aiSimulate('bg-remove')" style="width: auto; margin: 0; padding: 3px 8px;" title="Removes background from current layer">Remove Background</button>
                <button onclick="aiSimulate('upscale')" style="width: auto; margin: 0; padding: 3px 8px;" title="Upscales canvas 2x">Upscale 2x</button>
                <button onclick="aiSimulate('style')" style="width: auto; margin: 0; padding: 3px 8px;" title="Applies a stylized artistic filter">Style Transfer</button>
                <button onclick="aiSimulate('txt2img')" style="width: auto; margin: 0; padding: 3px 8px;" title="Generates image from text">Text to Image</button>

                <div id="ai-loading" style="display: none; align-items: center; gap: 5px; margin-left: auto; color: #a0a0ff; font-weight: bold;">
                    <span class="spinner" style="display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(160,160,255,0.3); border-radius: 50%; border-top-color: #a0a0ff; animation: spin 1s ease-in-out infinite;"></span>
                    Processing AI...
                </div>
            </div>"""

css_spinner = """
@keyframes spin {
    to { transform: rotate(360deg); }
}
"""
content = content.replace(
    "</style>",
    css_spinner + "\n</style>"
)

# Insert after <div id="options-bar">...</div>
# We will find `<div id="canvas-area">` and insert before it
content = content.replace(
    '            <div id="canvas-area">',
    ai_ui_html + '\n\n            <div id="canvas-area">'
)

# 5. Patch AI Logic
ai_logic_js = """
// --- Simulated AI Features ---

function showAILoading(show) {
    document.getElementById('ai-loading').style.display = show ? 'flex' : 'none';
}

function aiSimulate(action) {
    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) {
        alert("No active layer selected.");
        return;
    }

    if (action === 'fill' && !selectionManager.hasSelection) {
        alert("Generative Fill requires a selection.");
        return;
    }

    let promptText = "";
    if (action === 'txt2img') {
        promptText = prompt("Describe the image to generate:", "A cute robot painting");
        if (!promptText) return;
    } else if (action === 'fill') {
        promptText = prompt("What should AI generate here? (Leave empty for contextual fill)", "Surrounding background");
        if (promptText === null) return;
    } else if (action === 'style') {
        promptText = prompt("Enter style (e.g. 'Cyberpunk', 'Watercolor', 'Sketch'):", "Cyberpunk");
        if (!promptText) return;
    }

    showAILoading(true);

    // Simulate API delay
    setTimeout(() => {
        showAILoading(false);
        applyAIFeature(action, layer, promptText);
    }, 2500); // 2.5 seconds wait
}

function applyAIFeature(action, layer, promptText) {
    const w = layer.canvas.width;
    const h = layer.canvas.height;
    const ctx = layer.ctx;

    ctx.save();

    if (action === 'fill') {
        // Simulating generative fill inside selection mask
        if (selectionManager.hasSelection) {
             selectionManager.clipContext(ctx);

             // Draw noise/pattern
             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = w;
             tempCanvas.height = h;
             const tCtx = tempCanvas.getContext('2d');

             const idata = tCtx.createImageData(w, h);
             const d = idata.data;
             for (let i = 0; i < d.length; i += 4) {
                 d[i] = Math.random() * 255;
                 d[i+1] = Math.random() * 255;
                 d[i+2] = Math.random() * 255;
                 d[i+3] = 255;
             }
             tCtx.putImageData(idata, 0, 0);

             // Blur to make it look like "content aware fill" blending
             tCtx.filter = 'blur(10px)';
             tCtx.drawImage(tempCanvas, 0, 0);

             ctx.drawImage(tempCanvas, 0, 0);

             // Optionally add text
             if (promptText) {
                 ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                 ctx.fillRect(0, 0, w, h);
                 ctx.fillStyle = '#000';
                 ctx.font = '20px Arial';
                 ctx.textAlign = 'center';
                 ctx.fillText("[AI: " + promptText + "]", w/2, h/2);
             }

             ctx.restore();
             selectionManager.clearSelection();
        }
    } else if (action === 'bg-remove') {
        // Simulating Background Removal
        // We do a very rough alpha threshold or inverted circle mask
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(layer.canvas, 0, 0);

        const idata = tCtx.getImageData(0, 0, w, h);
        const d = idata.data;

        // Let's pretend anything near the edges is background.
        // We'll mask out a soft vignette.
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const distFromCenter = Math.hypot(x - w/2, y - h/2);
                const maxDist = Math.hypot(w/2, h/2);

                if (distFromCenter > maxDist * 0.5) {
                    // Fade out
                    const fade = 1 - ((distFromCenter - maxDist * 0.5) / (maxDist * 0.5));
                    d[i+3] = Math.max(0, Math.min(255, d[i+3] * fade));
                }
            }
        }
        ctx.putImageData(idata, 0, 0);

    } else if (action === 'upscale') {
        // Actual 2x upscale using Native canvas scaling
        const newW = mainCanvas.width * 2;
        const newH = mainCanvas.height * 2;

        performCrop(0, 0, newW, newH); // This resizes managers and canvases

        // Now scale up all layers
        layerManager.layers.forEach(l => {
            const temp = document.createElement('canvas');
            temp.width = l.canvas.width;
            temp.height = l.canvas.height;
            temp.getContext('2d').drawImage(l.canvas, 0, 0);

            l.canvas.width = newW;
            l.canvas.height = newH;

            l.ctx.imageSmoothingEnabled = false; // Nearest neighbor for pixel art look? Or true for normal.
            l.ctx.imageSmoothingQuality = 'high';
            l.ctx.drawImage(temp, 0, 0, l.canvas.width/2, l.canvas.height/2, 0, 0, newW, newH);

            // Re-center
            l.x *= 2;
            l.y *= 2;
        });

        // Reset zoom to fit
        zoomLevel = 0.5;

    } else if (action === 'style') {
        // Simulate style transfer with simple convolution/color shift
        const idata = ctx.getImageData(0, 0, w, h);
        const d = idata.data;

        // Add extreme contrast and shift colors
        const styleHue = Math.random();

        for(let i=0; i<d.length; i+=4) {
            if (d[i+3] === 0) continue;

            let [h, s, l] = rgbToHsl(d[i], d[i+1], d[i+2]);

            s = Math.min(1, s * 1.5); // Boost saturation
            h = (h + styleHue) % 1; // Shift hue globally

            // Posterize
            l = Math.round(l * 5) / 5;

            let [r, g, b] = hslToRgb(h, s, l);
            d[i] = r; d[i+1] = g; d[i+2] = b;
        }
        ctx.putImageData(idata, 0, 0);

    } else if (action === 'txt2img') {
        // Generate a new layer with a placeholder image
        const newLayer = layerManager.addLayer("AI Image");
        const tCtx = newLayer.ctx;

        // Generate a funky gradient
        const grad = tCtx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, `hsl(${Math.random() * 360}, 100%, 50%)`);
        grad.addColorStop(1, `hsl(${Math.random() * 360}, 100%, 50%)`);
        tCtx.fillStyle = grad;
        tCtx.fillRect(w/4, h/4, w/2, h/2); // Draw smaller box in center

        tCtx.fillStyle = '#fff';
        tCtx.font = '24px sans-serif';
        tCtx.textAlign = 'center';
        tCtx.fillText(promptText, w/2, h/2);
    }

    ctx.restore();
    historyManager.saveState();
    renderCanvas();
}
"""

content = content.replace(
    "// --- Shortcuts ---",
    ai_logic_js + "\n// --- Shortcuts ---"
)

with open("fakoshop.html", "w") as f:
    f.write(content)

print("All patches cleanly applied.")
