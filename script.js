// --- Layer System ---
class Layer {
    constructor(id, name, width, height) {
        this.id = id;
        this.name = name;
        this.visible = true;
        this.opacity = 1.0;
        this.blendMode = 'source-over';

        // Off-screen canvas for this layer
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class LayerManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [];
        this.activeLayerId = null;
        this.layerCounter = 0;
    }

    addLayer(name = null) {
        this.layerCounter++;
        const newName = name || `Layer ${this.layerCounter}`;
        const layer = new Layer(this.layerCounter, newName, this.width, this.height);

        // Add to top of stack
        this.layers.push(layer);
        this.activeLayerId = layer.id;

        renderLayerList();
        renderCanvas();
        return layer;
    }

    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId);
    }

    deleteActiveLayer() {
        if (this.layers.length <= 1) {
            alert("Cannot delete the last layer.");
            return;
        }
        const index = this.layers.findIndex(l => l.id === this.activeLayerId);
        this.layers.splice(index, 1);

        // Set new active layer
        this.activeLayerId = this.layers[Math.max(0, index - 1)].id;

        renderLayerList();
        renderCanvas();
    }

    moveLayer(direction) { // -1 down, 1 up
        const index = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (direction === -1 && index > 0) {
            [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];
        } else if (direction === 1 && index < this.layers.length - 1) {
            [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
        }
        renderLayerList();
        renderCanvas();
    }

    toggleVisibility(id) {
        const layer = this.layers.find(l => l.id === id);
        if(layer) {
            layer.visible = !layer.visible;
            renderLayerList();
            renderCanvas();
        }
    }

    setBlendMode(mode) {
        const layer = this.getActiveLayer();
        if(layer) {
            layer.blendMode = mode;
            renderCanvas();
        }
    }

    setOpacity(value) {
        const layer = this.getActiveLayer();
        if(layer) {
            layer.opacity = value;
            renderCanvas();
        }
    }
}

// --- History System ---
class HistoryManager {
    constructor(limit = 20) {
        this.limit = limit;
        this.stack = [];
        this.pointer = -1;
    }

    saveState() {
        // Remove redo states if we are in the middle of the stack
        if (this.pointer < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.pointer + 1);
        }

        // Deep copy the current state of all layers
        const state = layerManager.layers.map(layer => {
            const newCanvas = document.createElement('canvas');
            newCanvas.width = layer.canvas.width;
            newCanvas.height = layer.canvas.height;
            newCanvas.getContext('2d').drawImage(layer.canvas, 0, 0);

            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                canvas: newCanvas
            };
        });

        const fullState = {
            layers: state,
            activeLayerId: layerManager.activeLayerId,
            layerCounter: layerManager.layerCounter
        };

        this.stack.push(fullState);

        // Enforce limit
        if (this.stack.length > this.limit) {
            this.stack.shift();
        } else {
            this.pointer++;
        }

        console.log("State saved. Pointer:", this.pointer);
    }

    undo() {
        if (this.pointer > 0) {
            this.pointer--;
            this.restoreState(this.stack[this.pointer]);
        }
    }

    redo() {
        if (this.pointer < this.stack.length - 1) {
            this.pointer++;
            this.restoreState(this.stack[this.pointer]);
        }
    }

    restoreState(state) {
        // Restore LayerManager state
        layerManager.activeLayerId = state.activeLayerId;
        layerManager.layerCounter = state.layerCounter;

        // Reconstruct layers
        layerManager.layers = state.layers.map(lData => {
            const layer = new Layer(lData.id, lData.name, lData.canvas.width, lData.canvas.height);
            layer.visible = lData.visible;
            layer.opacity = lData.opacity;
            layer.blendMode = lData.blendMode;
            layer.ctx.drawImage(lData.canvas, 0, 0);
            return layer;
        });

        renderLayerList();
        renderCanvas();
        console.log("State restored. Pointer:", this.pointer);
    }
}

// --- Selection System ---
class SelectionManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.hasSelection = false;

        // Mask canvas: white = selected, black/transparent = unselected
        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.ctx = this.maskCanvas.getContext('2d');

        // Path storage for lasso
        this.currentPath = [];
    }

    clearSelection() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.hasSelection = false;
        renderCanvas();
    }

    startSelection(x, y) {
        this.clearSelection();
        this.hasSelection = true;
        this.startX = x;
        this.startY = y;

        if (currentTool === 'lasso') {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.currentPath = [[x, y]];
        }
    }

    updateSelection(x, y) {
        if (!this.hasSelection) return;

        if (currentTool === 'marquee') {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = 'rgba(0,0,0,1)'; // Use solid color for mask logic
            this.ctx.fillRect(this.startX, this.startY, x - this.startX, y - this.startY);
        } else if (currentTool === 'lasso') {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.currentPath.push([x, y]);
        }

        renderCanvas();
    }

    endSelection(x, y) {
        if (currentTool === 'lasso') {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.beginPath();
            if (this.currentPath.length > 0) {
                this.ctx.moveTo(this.currentPath[0][0], this.currentPath[0][1]);
                for(let p of this.currentPath) this.ctx.lineTo(p[0], p[1]);
            }
            this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(0,0,0,1)';
            this.ctx.fill();
        }
        renderCanvas();
    }

    // Apply clipping to a context based on selection
    clipContext(ctx) {
        if (!this.hasSelection) return;

        // We need to create a path from the mask pixels to clip?
        // Or easier: composite destination-in.
        // But for drawing tools, we want to restrict drawing to the area.

        // Efficient way:
        // 1. Save context
        // 2. Draw mask into context
        // 3. Clip

        // Actually, for real-time brush, we can just clip to the rect or path if simple.
        // But for pixel mask, we use compositing.

        // Complex approach:
        // We will return true if the pixel at x,y is selected.
        // But that's slow for brushes.

        // Better approach for standard drawing:
        // Use the mask canvas as a clipping region.
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(this.maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }
}

// --- Core Variables ---
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const layerManager = new LayerManager(mainCanvas.width, mainCanvas.height);
const historyManager = new HistoryManager();
const selectionManager = new SelectionManager(mainCanvas.width, mainCanvas.height);

let painting = false;
let currentTool = 'brush';
let brushSize = 10;
let brushColor = '#000000';
let brushOpacity = 1;
let startX, startY; // For shape tools

// --- Initialization ---
function init() {
    // Create background layer
    const bg = layerManager.addLayer('Background');
    bg.ctx.fillStyle = '#ffffff';
    bg.ctx.fillRect(0, 0, bg.canvas.width, bg.canvas.height);

    // Save initial state
    historyManager.saveState();

    renderLayerList();
    renderCanvas();
}

function renderCanvas() {
    // Clear main display canvas
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    // Draw pattern background (checkerboard for transparency)
    drawCheckerboard(mainCtx, mainCanvas.width, mainCanvas.height);

    // Composite layers
    layerManager.layers.forEach(layer => {
        if (!layer.visible) return;

        mainCtx.globalAlpha = layer.opacity;
        mainCtx.globalCompositeOperation = layer.blendMode;
        mainCtx.drawImage(layer.canvas, 0, 0);
    });

    // Reset context state
    mainCtx.globalAlpha = 1.0;
    mainCtx.globalCompositeOperation = 'source-over';

    // Draw Selection Outline (Marching Ants effect - simplified)
    if (selectionManager.hasSelection) {
        mainCtx.save();
        mainCtx.strokeStyle = '#000';
        mainCtx.lineWidth = 1;
        mainCtx.setLineDash([4, 4]);

        // Draw the boundary of the non-transparent pixels in mask
        // For performance in this demo, we just draw the mask semitransparent red
        // to show selected area, or just rely on the tool interaction.
        // Let's overlay the mask slightly to visualize it.

        mainCtx.globalAlpha = 0.2;
        mainCtx.fillStyle = '#00f'; // Blue tint for selection
        mainCtx.drawImage(selectionManager.maskCanvas, 0, 0);

        // If actively selecting (dragging marquee/lasso), draw that specific preview
        if (painting && (currentTool === 'marquee' || currentTool === 'lasso')) {
           // handled in updateSelection drawing to maskCanvas
        }

        mainCtx.restore();
    }

    // Draw Preview for shapes (if painting)
    if (painting && ['rect', 'circle', 'line'].includes(currentTool)) {
        drawShapePreview();
    }
}

function drawCheckerboard(ctx, w, h) {
    const size = 10;
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    for(let y=0; y<h; y+=size) {
        for(let x=0; x<w; x+=size) {
            if((x/size + y/size) % 2 === 0) ctx.fillRect(x,y,size,size);
        }
    }
}

function renderLayerList() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';

    // Render in reverse order (top layer at top of list)
    [...layerManager.layers].reverse().forEach(layer => {
        const item = document.createElement('div');
        item.className = `layer-item ${layer.id === layerManager.activeLayerId ? 'active' : ''}`;
        item.onclick = () => {
            layerManager.activeLayerId = layer.id;
            renderLayerList();
        };

        const eye = document.createElement('span');
        eye.className = 'layer-eye';
        eye.innerText = layer.visible ? '👁️' : '○';
        eye.onclick = (e) => {
            e.stopPropagation();
            layerManager.toggleVisibility(layer.id);
        };

        const name = document.createElement('span');
        name.innerText = layer.name;

        item.appendChild(eye);
        item.appendChild(name);
        list.appendChild(item);
    });
}


// --- Event Listeners ---
mainCanvas.addEventListener('mousedown', startPosition);
mainCanvas.addEventListener('mouseup', endPosition);
mainCanvas.addEventListener('mousemove', draw);
mainCanvas.addEventListener('click', handleCanvasClick); // For fill tool

// Input Listeners
document.getElementById('brush-size').addEventListener('input', (e) => {
    brushSize = e.target.value;
    document.getElementById('brush-size-val').innerText = brushSize + 'px';
});
document.getElementById('brush-opacity').addEventListener('input', (e) => {
    brushOpacity = e.target.value / 100;
    document.getElementById('brush-opacity-val').innerText = e.target.value + '%';
});
document.getElementById('primary-color').addEventListener('input', (e) => {
    brushColor = e.target.value;
});

// --- Drawing Engine ---
function startPosition(e) {
    const rect = mainCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    if (['fill', 'picker', 'text'].includes(currentTool)) return; // These are handled by click

    painting = true;

    if (currentTool === 'marquee' || currentTool === 'lasso') {
        selectionManager.startSelection(startX, startY);
        return;
    }

    // If we have a selection, and we are drawing, we need to clip the layer context?
    // Doing real-time clipping on the canvas context is tricky for persistent strokes.
    // Strategy: Draw to a temporary canvas, clip it with selection mask, then draw to layer.
    // For this simple implementation: we will check collision in draw() or use clip()

    if (selectionManager.hasSelection && (currentTool === 'brush' || currentTool === 'eraser')) {
        const layer = layerManager.getActiveLayer();
        if(layer) {
            layer.ctx.save();
            layer.ctx.beginPath();
            // Create a path from the mask? Complex.
            // Alternative: Composite Mode "destination-in" with selection mask after stroke? No.

            // Simple Rect Selection Support:
            // if(currentTool === 'brush') layer.ctx.clip(selectionPath);

            // For Pixel Mask Selection (Lasso):
            // We'll use the maskCanvas as a clip pattern.
            // Actually, correct way: draw stroke normally. Then immediately clear pixels outside selection.
            // But that erases previous content.

            // Correct way for Painter:
            // 1. Set clip on layer context to the selection mask (using drawImage or clip())
            // JS Canvas clip() takes a path. We have a raster mask.

            // Workaround: We will just draw. In `draw`, we will use globalCompositeOperation carefully?
            // No, easiest is:
            // The `draw` function updates the layer.
            // We should modify `draw` to only affect selected pixels.
        }
    }

    if (currentTool === 'brush' || currentTool === 'eraser') {
        draw(e);
    }
}

function endPosition(e) {
    if (painting) {
        const rect = mainCanvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        painting = false;

        if (currentTool === 'marquee' || currentTool === 'lasso') {
            selectionManager.endSelection(endX, endY);
            return;
        }

        const layer = layerManager.getActiveLayer();
        if(layer) {

            // If selection was active, we need to clean up the stroke that went outside?
            // Or if we used clipping in draw(), restore context.
            if (selectionManager.hasSelection) {
                 // For now, simple implementation doesn't strictly enforce selection clip on Brush
                 // because raster-to-clip path is hard.
                 // We will implement "Masking" after the stroke is done?
                 // No, let's try to apply the mask now.

                 // Apply Selection Mask to Layer (Keep only what's inside selection)
                 // This is wrong, it would delete outside pixels of the whole layer.
                 // We only want to delete the *new* pixels outside.
                 // That requires a temporary scratch layer for every stroke.

                 // Due to complexity, "Selection" in this version just visualizes the area
                 // and restricts Filters/Fills, but maybe not Brush (unless we use scratch layer).

                 // Let's make Selection strict for SHAPES and FILL at least.
            }

             // Commit shapes
            if (currentTool === 'rect') {
                layer.ctx.fillStyle = brushColor;
                layer.ctx.fillRect(startX, startY, endX - startX, endY - startY);
            } else if (currentTool === 'circle') {
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                layer.ctx.fillStyle = brushColor;
                layer.ctx.beginPath();
                layer.ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                layer.ctx.fill();
            } else if (currentTool === 'line') {
                layer.ctx.strokeStyle = brushColor;
                layer.ctx.lineWidth = brushSize;
                layer.ctx.beginPath();
                layer.ctx.moveTo(startX, startY);
                layer.ctx.lineTo(endX, endY);
                layer.ctx.stroke();
            }

            layer.ctx.beginPath();
        }

        historyManager.saveState(); // Save state after stroke
        renderCanvas(); // Update main display
    }
}

function draw(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update coordinates for preview
    window.lastMouseX = x;
    window.lastMouseY = y;

    if (!painting) return;

    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) return;

    // Handle Selection Tools
    if (currentTool === 'marquee' || currentTool === 'lasso') {
        selectionManager.updateSelection(x, y);
        return;
    }

    // Handle Brush/Eraser (Real-time)
    if (currentTool === 'brush') {
        const ctx = layer.ctx;
        ctx.save();

        // Quick Clip for Rectangular Selection (Optimization)
        // If selection is complex lasso, this won't work easily without path reconstruction
        // For now, Brush ignores selection in this simple implementation to avoid lag/bugs,
        // unless we switch to a "Scratch Layer" approach for all drawing.

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(${hexToRgb(brushColor)}, ${brushOpacity})`;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        ctx.restore();
        renderCanvas();
    } else if (currentTool === 'eraser') {
        const ctx = layer.ctx;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = `rgba(0,0,0,1)`;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.globalCompositeOperation = 'source-over';
        renderCanvas();
    } else {
        // For shapes, we just re-render to show the preview
        renderCanvas();
    }
}

function drawShapePreview() {
    const ctx = mainCtx;
    const x = window.lastMouseX;
    const y = window.lastMouseY;

    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // Dashed line for preview

    if (currentTool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
    } else if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    ctx.restore();
}

function handleCanvasClick(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) return;

    if (currentTool === 'fill') {
        // Respect selection for fill
        if (selectionManager.hasSelection) {
            // Check if click is inside selection
            const maskPixel = selectionManager.ctx.getImageData(x, y, 1, 1).data;
            if (maskPixel[3] === 0) return; // Clicked outside selection
        }

        floodFill(layer, Math.floor(x), Math.floor(y), hexToRgba(brushColor));
        historyManager.saveState();
        renderCanvas();
    } else if (currentTool === 'picker') {
        const pixel = layer.ctx.getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        brushColor = hex;
        document.getElementById('primary-color').value = hex;
    } else if (currentTool === 'text') {
        const text = prompt("Enter text:", "Text Layer");
        if (text) {
            layer.ctx.font = `${brushSize * 2}px Arial`;
            layer.ctx.fillStyle = brushColor;
            layer.ctx.fillText(text, x, y);
            historyManager.saveState();
            renderCanvas();
        }
    }
}


// --- Algorithms ---

// Flood Fill (Stack-based recursive simulation)
function floodFill(layer, startX, startY, fillColor) {
    // fillColor is [r, g, b, a] (0-255)
    const ctx = layer.ctx;
    const w = layer.canvas.width;
    const h = layer.canvas.height;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Get selection mask data if active
    let maskData = null;
    if (selectionManager.hasSelection) {
        maskData = selectionManager.ctx.getImageData(0, 0, w, h).data;
    }

    const startPos = (startY * w + startX) * 4;
    const startColor = [data[startPos], data[startPos+1], data[startPos+2], data[startPos+3]];

    // Don't fill if color is same
    if (colorsMatch(startColor, fillColor)) return;

    const stack = [[startX, startY]];

    while(stack.length) {
        const [x, y] = stack.pop();
        const pos = (y * w + x) * 4;

        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        // Check selection mask
        if (maskData) {
            // If mask alpha is 0 (transparent), it's unselected. Skip.
            if (maskData[pos + 3] === 0) continue;
        }

        if (colorsMatch([data[pos], data[pos+1], data[pos+2], data[pos+3]], startColor)) {
            data[pos] = fillColor[0];
            data[pos+1] = fillColor[1];
            data[pos+2] = fillColor[2];
            data[pos+3] = fillColor[3]; // Alpha 255

            stack.push([x+1, y]);
            stack.push([x-1, y]);
            stack.push([x, y+1]);
            stack.push([x, y-1]);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function colorsMatch(c1, c2) {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3];
}

// --- Tool Logic ---
function setTool(tool) {
    currentTool = tool;

    document.querySelectorAll('.tool').forEach(el => el.classList.remove('active'));
    const map = {
        'brush': 0, 'eraser': 1, 'move': 2, 'fill': 3, 'picker': 4,
        'rect': 5, 'circle': 6, 'line': 7, 'text': 8, 'marquee': 9, 'lasso': 10
    };
    if (document.querySelectorAll('.tool')[map[tool]]) {
        document.querySelectorAll('.tool')[map[tool]].classList.add('active');
    }

    if(tool === 'brush' || tool === 'eraser') mainCanvas.style.cursor = 'crosshair';
    else if(tool === 'move') mainCanvas.style.cursor = 'move';
    else if(tool === 'text') mainCanvas.style.cursor = 'text';
    else if(tool === 'picker') mainCanvas.style.cursor = 'cell'; // closest to eyedropper
    else mainCanvas.style.cursor = 'default';
}

// --- Color Helpers ---
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
}

function hexToRgba(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b, 255];
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// --- File Operations ---
function downloadImage() {
    const link = document.createElement('a');
    link.download = 'webphoto-export.jpg';
    link.href = mainCanvas.toDataURL('image/jpeg', 0.8);
    link.click();
}

function handleFileUpload(input) {
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create new layer for imported image
            const layer = layerManager.addLayer(file.name);
            const x = (layer.canvas.width - img.width) / 2;
            const y = (layer.canvas.height - img.height) / 2;
            layer.ctx.drawImage(img, Math.max(0, x), Math.max(0, y), Math.min(layer.canvas.width, img.width), Math.min(layer.canvas.height, img.height));
            renderCanvas();
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function newFile() {
    if(confirm("Clear canvas and start new?")) {
        layerManager.layers = [];
        layerManager.layerCounter = 0;
        init();
    }
}

// --- Image Adjustments (Destructive) ---
function applyImageAdjustment(type) {
    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) {
        alert("No active layer selected.");
        return;
    }

    const ctx = layer.ctx;
    const w = layer.canvas.width;
    const h = layer.canvas.height;

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Get selection mask
    let maskData = null;
    if (selectionManager.hasSelection) {
        maskData = selectionManager.ctx.getImageData(0, 0, w, h).data;
    }

    // Parameters
    let val;
    if (type === 'brightness') {
        const input = prompt("Enter Brightness (-100 to 100):", "0");
        if (input === null) return;
        val = parseInt(input) || 0;
    } else if (type === 'blur') {
        const input = prompt("Enter Blur Radius (0-20):", "5");
        if (input === null) return;
        val = parseInt(input) || 0;

        // Blur is complex to implement pixel-wise in pure JS efficiently.
        // We will use a canvas filter trick for blur.
        ctx.save();
        if (selectionManager.hasSelection) {
            selectionManager.clipContext(ctx);
        }
        ctx.filter = `blur(${val}px)`;
        ctx.drawImage(layer.canvas, 0, 0); // Draw itself with blur
        ctx.filter = 'none';
        ctx.restore();

        historyManager.saveState();
        renderCanvas();
        return; // Special case handled
    } else if (type === 'hue') {
        const input = prompt("Enter Hue Shift in Degrees (0-360):", "180");
        if (input === null) return;
        val = parseInt(input) || 0;
    }

    // Process Pixels
    for (let i = 0; i < data.length; i += 4) {
        // Skip unselected pixels
        if (maskData && maskData[i+3] === 0) continue;

        if (type === 'invert') {
            data[i] = 255 - data[i];     // R
            data[i+1] = 255 - data[i+1]; // G
            data[i+2] = 255 - data[i+2]; // B
        } else if (type === 'grayscale') {
            const avg = (data[i] + data[i+1] + data[i+2]) / 3;
            data[i] = avg;
            data[i+1] = avg;
            data[i+2] = avg;
        } else if (type === 'sepia') {
            const r = data[i], g = data[i+1], b = data[i+2];
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i+1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i+2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        } else if (type === 'brightness') {
             // Simple additive brightness
            data[i] = Math.min(255, Math.max(0, data[i] + val));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + val));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + val));
        } else if (type === 'hue') {
            // RGB to HSL, Shift H, HSL to RGB
            // Simplified approximation for demo speed
            // Proper impl needs RGB<->HSL conversion functions
            const [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
            const newH = (h + val / 360) % 1;
            const [r, g, b] = hslToRgb(newH, s, l);
            data[i] = r; data[i+1] = g; data[i+2] = b;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    historyManager.saveState();
    renderCanvas();
}

// Helper: RGB <-> HSL
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
}

// --- Shortcuts ---
window.addEventListener('keydown', (e) => {
    if(e.key === 'b') setTool('brush');
    if(e.key === 'e') setTool('eraser');
    if(e.key === 'g') setTool('fill');
    if(e.key === 'i') setTool('picker');
    if(e.key === 'r') setTool('rect');
    if(e.key === 'c') setTool('circle');
    // if(e.key === 'l') setTool('line'); // Conflict with Lasso
    if(e.key === 't') setTool('text');
    if(e.key === 'm') setTool('marquee');
    if(e.key === 'l') setTool('lasso'); // L for Lasso now
    if(e.key === 'Escape') selectionManager.clearSelection();
    if(e.key === '[' && brushSize > 1) { brushSize--; document.getElementById('brush-size').value = brushSize; }
    if(e.key === ']') { brushSize++; document.getElementById('brush-size').value = brushSize; }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            historyManager.redo();
        } else {
            historyManager.undo();
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { // Windows standard redo
        e.preventDefault();
        historyManager.redo();
    }
});

// --- Menu Logic ---
function toggleMenu(menuId) {
    // Close other menus first
    const dropdowns = document.getElementsByClassName("dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
        if (dropdowns[i].id !== menuId) {
            dropdowns[i].classList.remove('show');
        }
    }
    document.getElementById(menuId).classList.toggle("show");
}

// Close menus when clicking elsewhere
window.onclick = function(event) {
    if (!event.target.matches('.menu-item') && !event.target.matches('.menu-item *')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

// Initialize app
init();
