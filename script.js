// --- Layer System ---
class Layer {
    constructor(id, name, width, height) {
        this.id = id;
        this.name = name;
        this.visible = true;
        this.opacity = 1.0;
        this.blendMode = 'source-over';
        this.x = 0;
        this.y = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.rotation = 0; // in radians

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
        // Ensure unique name if auto-generated
        let newName = name || `Layer ${this.layerCounter}`;

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

        // Prevent deleting if it's the only layer (redundant check but safe)
        if (index === -1) return;

        this.layers.splice(index, 1);

        // Set new active layer to the one below, or above if it was the bottom
        const newIndex = Math.max(0, index - 1);
        this.activeLayerId = this.layers[newIndex].id;

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

    duplicateActiveLayer() {
        const layer = this.getActiveLayer();
        if (!layer) return;

        const newLayer = this.addLayer(layer.name + " Copy");
        // Copy properties
        newLayer.x = layer.x;
        newLayer.y = layer.y;
        newLayer.scaleX = layer.scaleX;
        newLayer.scaleY = layer.scaleY;
        newLayer.rotation = layer.rotation;
        newLayer.opacity = layer.opacity;
        newLayer.blendMode = layer.blendMode;

        // Copy content
        newLayer.ctx.drawImage(layer.canvas, 0, 0);

        renderCanvas();
        historyManager.saveState();
    }

    mergeDown() {
        const index = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (index <= 0) {
            alert("No layer below to merge into.");
            return;
        }

        const topLayer = this.layers[index];
        const bottomLayer = this.layers[index - 1];

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const ctx = tempCanvas.getContext('2d');

        // Draw Bottom
        if(bottomLayer.visible) {
            ctx.save();
            ctx.globalAlpha = bottomLayer.opacity;
            // No blend mode for bottom, it's the base of the merge

            const cx1 = (bottomLayer.x || 0) + bottomLayer.canvas.width / 2;
            const cy1 = (bottomLayer.y || 0) + bottomLayer.canvas.height / 2;
            ctx.translate(cx1, cy1);
            ctx.rotate(bottomLayer.rotation || 0);
            ctx.scale(bottomLayer.scaleX || 1, bottomLayer.scaleY || 1);
            ctx.translate(-cx1, -cy1);
            ctx.drawImage(bottomLayer.canvas, bottomLayer.x || 0, bottomLayer.y || 0);
            ctx.restore();
        }

        // Draw Top
        if(topLayer.visible) {
            ctx.save();
            ctx.globalAlpha = topLayer.opacity;
            ctx.globalCompositeOperation = topLayer.blendMode;

            const cx2 = (topLayer.x || 0) + topLayer.canvas.width / 2;
            const cy2 = (topLayer.y || 0) + topLayer.canvas.height / 2;
            ctx.translate(cx2, cy2);
            ctx.rotate(topLayer.rotation || 0);
            ctx.scale(topLayer.scaleX || 1, topLayer.scaleY || 1);
            ctx.translate(-cx2, -cy2);
            ctx.drawImage(topLayer.canvas, topLayer.x || 0, topLayer.y || 0);
            ctx.restore();
        }

        // Update Bottom Layer
        bottomLayer.ctx.clearRect(0,0, bottomLayer.canvas.width, bottomLayer.canvas.height);
        bottomLayer.ctx.drawImage(tempCanvas, 0, 0); // Copy merged result

        // Reset Bottom Layer Properties (it is now a rasterized composition)
        bottomLayer.x = 0;
        bottomLayer.y = 0;
        bottomLayer.rotation = 0;
        bottomLayer.scaleX = 1;
        bottomLayer.scaleY = 1;
        bottomLayer.opacity = 1;
        bottomLayer.blendMode = 'source-over';

        // Remove Top Layer
        this.layers.splice(index, 1);
        this.activeLayerId = bottomLayer.id;

        renderLayerList();
        renderCanvas();
        historyManager.saveState();
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
                x: layer.x,
                y: layer.y,
                scaleX: layer.scaleX || 1,
                scaleY: layer.scaleY || 1,
                rotation: layer.rotation || 0,
                canvas: newCanvas
            };
        });

        const fullState = {
            layers: state,
            activeLayerId: layerManager.activeLayerId,
            layerCounter: layerManager.layerCounter,
            // Also save canvas dimensions for crop undo
            width: layerManager.width,
            height: layerManager.height
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
        // Restore dimensions if changed (e.g. crop)
        if (state.width !== layerManager.width || state.height !== layerManager.height) {
            mainCanvas.width = state.width;
            mainCanvas.height = state.height;
            layerManager.width = state.width;
            layerManager.height = state.height;
            selectionManager.width = state.width;
            selectionManager.height = state.height;
            selectionManager.maskCanvas.width = state.width;
            selectionManager.maskCanvas.height = state.height;
        }

        // Restore LayerManager state
        layerManager.activeLayerId = state.activeLayerId;
        layerManager.layerCounter = state.layerCounter;

        // Reconstruct layers
        layerManager.layers = state.layers.map(lData => {
            const layer = new Layer(lData.id, lData.name, lData.canvas.width, lData.canvas.height);
            layer.visible = lData.visible;
            layer.opacity = lData.opacity;
            layer.blendMode = lData.blendMode;
            layer.x = lData.x || 0;
            layer.y = lData.y || 0;
            layer.scaleX = lData.scaleX || 1;
            layer.scaleY = lData.scaleY || 1;
            layer.rotation = lData.rotation || 0;
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

        if (currentTool === 'marquee' || currentTool === 'crop') {
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
let secondaryColor = '#ffffff';
let brushOpacity = 1;
let startX, startY; // For shape tools

// Zoom & Pan Variables
let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let isSpacePressed = false;
let lastPanX, lastPanY;
let lastMoveX, lastMoveY; // For move tool

// Clone Stamp
let cloneSourceX = null;
let cloneSourceY = null;

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

    mainCtx.save(); // Save context state before applying transforms

    // Apply Pan and Zoom
    mainCtx.translate(panX, panY);
    mainCtx.scale(zoomLevel, zoomLevel);

    // Draw pattern background (checkerboard for transparency)
    drawCheckerboard(mainCtx, mainCanvas.width, mainCanvas.height);

    // Composite layers
    layerManager.layers.forEach(layer => {
        if (!layer.visible) return;

        mainCtx.save();
        mainCtx.globalAlpha = layer.opacity;
        mainCtx.globalCompositeOperation = layer.blendMode;

        // Apply layer transformations (Translate -> Rotate -> Scale)

        // Translate to layer position
        const centerX = (layer.x || 0) + layer.canvas.width / 2;
        const centerY = (layer.y || 0) + layer.canvas.height / 2;

        mainCtx.translate(centerX, centerY);
        mainCtx.rotate(layer.rotation || 0);
        mainCtx.scale(layer.scaleX || 1, layer.scaleY || 1);
        mainCtx.translate(-centerX, -centerY);

        mainCtx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
        mainCtx.restore();
    });

    // Reset context state for overlay drawing (Selection/Crop)
    mainCtx.globalAlpha = 1.0;
    mainCtx.globalCompositeOperation = 'source-over';

    // Draw Selection Outline
    if (selectionManager.hasSelection) {
        mainCtx.save();
        mainCtx.lineWidth = 1 / zoomLevel;
        mainCtx.setLineDash([4 / zoomLevel, 4 / zoomLevel]);

        if (currentTool === 'crop') {
            // Darken area outside crop
            mainCtx.fillStyle = 'rgba(0,0,0,0.5)';
            mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

            // Clear the selection part to reveal image (or just draw selection border)
            // Composite destination-out to clear hole?
            mainCtx.globalCompositeOperation = 'destination-out';
            mainCtx.drawImage(selectionManager.maskCanvas, 0, 0);

            // Draw crop border
            mainCtx.globalCompositeOperation = 'source-over';
            mainCtx.strokeStyle = '#fff';
            mainCtx.strokeRect(selectionManager.startX, selectionManager.startY,
                              (window.lastMouseX || selectionManager.startX) - selectionManager.startX,
                              (window.lastMouseY || selectionManager.startY) - selectionManager.startY); // Approximation, relies on updateSelection

            // Since `maskCanvas` contains the rect, we can just outline it if simple
            // But for live drag, updateSelection logic handles rendering to maskCanvas
            // We need to outline the non-transparent part of maskCanvas?

            // Better: updateSelection already fills maskCanvas.
            // We just need to visualize it nicely for Crop.
        } else {
            mainCtx.strokeStyle = '#000';
            mainCtx.globalAlpha = 0.2;
            mainCtx.fillStyle = '#00f';
            mainCtx.drawImage(selectionManager.maskCanvas, 0, 0);
        }

        mainCtx.restore();
    }

    // Draw Preview for shapes (if painting)
    if (painting && ['rect', 'circle', 'line', 'gradient'].includes(currentTool)) {
        drawShapePreview();
    }

    // Draw Clone Source preview
    if (currentTool === 'clone' && cloneSourceX !== null) {
        mainCtx.save();
        mainCtx.strokeStyle = '#000';
        mainCtx.lineWidth = 1 / zoomLevel;
        mainCtx.beginPath();
        // Just a crosshair at source
        // Since sourceX/Y are global, we transform them to view
        const screenX = (cloneSourceX * zoomLevel) + panX;
        const screenY = (cloneSourceY * zoomLevel) + panY;

        // Wait, renderCanvas applies transforms. We should draw at cloneSourceX directly.
        mainCtx.lineWidth = 2 / zoomLevel;
        mainCtx.strokeStyle = 'rgba(0,0,0,0.5)';
        const size = 10 / zoomLevel;
        mainCtx.moveTo(cloneSourceX - size, cloneSourceY);
        mainCtx.lineTo(cloneSourceX + size, cloneSourceY);
        mainCtx.moveTo(cloneSourceX, cloneSourceY - size);
        mainCtx.lineTo(cloneSourceX, cloneSourceY + size);
        mainCtx.stroke();
        mainCtx.restore();
    }

    mainCtx.restore(); // Restore context to default state (no transform)

    updateHistogram(); // Update histogram after rendering
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
mainCanvas.addEventListener('click', handleCanvasClick);
mainCanvas.addEventListener('wheel', handleWheel); // Zoom support
mainCanvas.addEventListener('dblclick', handleDoubleClick); // Crop confirmation

// Touch Support
mainCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
    });
    startPosition(mouseEvent);
}, { passive: false });

mainCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    draw(mouseEvent);
}, { passive: false });

mainCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // Touchend doesn't have coordinates in touches list if it was the last finger.
    // However, endPosition usually doesn't strictly rely on exact last coordinates
    // for simple brush strokes (it relies on `painting = false`).
    // But for shape tools we used `getCanvasCoordinates(e)`.
    // We can rely on changedTouches.
    const touch = e.changedTouches[0];
    const mouseEvent = new MouseEvent('mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    endPosition(mouseEvent);
}, { passive: false });

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
document.getElementById('secondary-color').addEventListener('input', (e) => {
    secondaryColor = e.target.value;
});

// --- Coordinate Helper ---
function getCanvasCoordinates(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Inverse transform
    const canvasX = (screenX - panX) / zoomLevel;
    const canvasY = (screenY - panY) / zoomLevel;

    return { x: canvasX, y: canvasY, screenX, screenY };
}


// --- Drawing Engine ---
function startPosition(e) {
    // Handle Pan Tool (Spacebar held or middle click)
    if (isSpacePressed || e.button === 1) {
        isPanning = true;
        const coords = getCanvasCoordinates(e);
        lastPanX = coords.screenX;
        lastPanY = coords.screenY;
        mainCanvas.style.cursor = 'grabbing';
        return;
    }

    const coords = getCanvasCoordinates(e);
    startX = coords.x;
    startY = coords.y;

    if (currentTool === 'move') {
        const layer = layerManager.getActiveLayer();
        if (layer) {
            painting = true;
            lastMoveX = coords.x;
            lastMoveY = coords.y;
        }
        return;
    }

    // Clone Stamp Source Set (Alt + Click)
    if (currentTool === 'clone' && e.altKey) {
        cloneSourceX = startX;
        cloneSourceY = startY;
        console.log("Clone Source Set:", cloneSourceX, cloneSourceY);
        renderCanvas();
        return;
    }

    if (['fill', 'picker', 'text', 'wand'].includes(currentTool)) return; // These are handled by click

    // Refresh Clone Source Snapshot
    if (currentTool === 'clone' && !e.altKey) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layerManager.width;
        tempCanvas.height = layerManager.height;
        const tCtx = tempCanvas.getContext('2d');

        // Draw background checkerboard? No, just layers.
        // Actually, we usually clone what is visible.
        // Replicate render logic (without zoom/pan)
        layerManager.layers.forEach(layer => {
            if (!layer.visible) return;
            tCtx.save();
            tCtx.globalAlpha = layer.opacity;
            tCtx.globalCompositeOperation = layer.blendMode;

            const centerX = (layer.x || 0) + layer.canvas.width / 2;
            const centerY = (layer.y || 0) + layer.canvas.height / 2;

            tCtx.translate(centerX, centerY);
            tCtx.rotate(layer.rotation || 0);
            tCtx.scale(layer.scaleX || 1, layer.scaleY || 1);
            tCtx.translate(-centerX, -centerY);

            tCtx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
            tCtx.restore();
        });
        window.cloneSourceImage = tempCanvas;
    }

    painting = true;

    if (currentTool === 'marquee' || currentTool === 'lasso' || currentTool === 'crop') {
        selectionManager.startSelection(startX, startY);
        return;
    }

    if (selectionManager.hasSelection && (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'clone')) {
        const layer = layerManager.getActiveLayer();
        if(layer) {
            layer.ctx.save();
            layer.ctx.beginPath();
        }
    }

    if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'clone') {
        draw(e);
    }
}

function endPosition(e) {
    if (isPanning) {
        isPanning = false;
        mainCanvas.style.cursor = isSpacePressed ? 'grab' : getCursorForTool(currentTool);
        return;
    }

    if (painting) {
        const coords = getCanvasCoordinates(e);
        const endX = coords.x;
        const endY = coords.y;

        painting = false;

        if (currentTool === 'move') {
            historyManager.saveState();
            return;
        }

        if (currentTool === 'marquee' || currentTool === 'lasso' || currentTool === 'crop') {
            selectionManager.endSelection(endX, endY);
            if (currentTool === 'crop') {
                 // Don't crop immediately, wait for double click or enter?
                 // For now, let user see the selection.
                 // We will add a hint "Double click to Crop"
            }
            return;
        }

        const layer = layerManager.getActiveLayer();
        if(layer) {
            if (selectionManager.hasSelection) {
                 // Selection handling placeholder
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
            } else if (currentTool === 'gradient') {
                // Apply Gradient
                const grad = layer.ctx.createLinearGradient(startX, startY, endX, endY);
                grad.addColorStop(0, brushColor);
                grad.addColorStop(1, secondaryColor);

                layer.ctx.fillStyle = grad;

                // If selection exists, clip to it
                if (selectionManager.hasSelection) {
                    layer.ctx.save();
                    // How to clip with the global selection mask?
                    // We need to draw the mask to context with 'destination-in' logic
                    // But we want to fill the area.
                    // Correct approach:
                    // 1. Fill a temp canvas/rect with gradient.
                    // 2. Composite that onto layer using selection mask.
                    // Or simpler: set clip if we had a path.
                    // With raster mask:
                    // Draw selection mask to layer with 'destination-in' to isolate gradient?
                    // No, that erases existing content.

                    // We need: (Layer Content) + (Gradient masked by Selection)
                    // So:
                    // 1. Draw gradient to layer (fills everything)
                    // 2. Wait, that overwrites.

                    // Correct:
                    // 1. Draw gradient on temp canvas.
                    // 2. Apply selection mask to temp canvas (make outside transparent).
                    // 3. Draw temp canvas to layer.

                    const temp = document.createElement('canvas');
                    temp.width = layer.canvas.width;
                    temp.height = layer.canvas.height;
                    const tCtx = temp.getContext('2d');

                    tCtx.fillStyle = grad;
                    tCtx.fillRect(0,0, temp.width, temp.height);

                    tCtx.globalCompositeOperation = 'destination-in';
                    tCtx.drawImage(selectionManager.maskCanvas, -layer.x, -layer.y); // Transform mask to local space

                    layer.ctx.drawImage(temp, 0, 0);
                    layer.ctx.restore();
                } else {
                    layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
                }
            }

            layer.ctx.beginPath();
        }

        historyManager.saveState();
        renderCanvas();
    }
}

function draw(e) {
    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

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

    if (!painting) return;

    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) return;

    if (currentTool === 'move') {
        const dx = x - lastMoveX;
        const dy = y - lastMoveY;
        layer.x += dx;
        layer.y += dy;
        lastMoveX = x;
        lastMoveY = y;
        renderCanvas();
        return;
    }

    // Handle Selection Tools
    if (currentTool === 'marquee' || currentTool === 'lasso' || currentTool === 'crop') {
        selectionManager.updateSelection(x, y);
        return;
    }

    // Handle Brush/Eraser/Clone (Real-time)
    if (currentTool === 'brush' || currentTool === 'clone') {
        const ctx = layer.ctx;
        ctx.save();

        const localX = (x - layer.x);
        const localY = (y - layer.y);

        if (currentTool === 'clone') {
            if (cloneSourceX === null) return; // No source

            // Clone logic:
            // Calculate offset from start position to current position
            // But wait, standard clone stamp works by fixed offset.
            // Offset = (currentX - startX) + (cloneSourceX - startX_of_stroke?) NO
            // Standard: Offset between source and destination is constant during stroke.
            // Offset = (x - cloneSourceX) - wait.
            // When we start stroke at startX, startY... we sample from cloneSourceX, cloneSourceY.
            // diffX = cloneSourceX - startX
            // diffY = cloneSourceY - startY
            // sourceForPixel(x,y) = (x + diffX, y + diffY)

            // However, implementing that with `ctx.lineTo` path stroke is hard because we need to texture map.
            // Canvas Pattern?
            // Yes, we can create a pattern from the visible canvas (or specific layer?) usually visible canvas.
            // And offset the pattern matrix.

            // For simplicity in this engine: Point-based drawing (stamps) for clone tool?
            // Or efficient way:
            // Draw using the image as a pattern.

            // Let's assume we clone from the "Composite Image" (what you see).
            // We need a snapshot of the canvas before the stroke started? Ideally yes.
            // For now, let's grab the composite from mainCanvas? But mainCanvas has zoom.
            // We need a flat composite.

            // Doing it properly:
            // 1. On `startPosition`, grab composite of all layers (flattened).
            // 2. Create Pattern from it.
            // 3. Set ctx.strokeStyle = pattern.
            // 4. Translate pattern to match offset.

            // Let's implement simplified "Stamp" drawing for clone to avoid complex pattern matrix updates per frame if we used lineTo.
            // Actually, we can just stroke.

            // We need a cached source image.
            if (!window.cloneSourceImage) return;

            const diffX = cloneSourceX - startX;
            const diffY = cloneSourceY - startY;

            // We need to set the pattern transform.
            const pattern = ctx.createPattern(window.cloneSourceImage, 'no-repeat');
            // The pattern needs to be shifted so that at (x,y) we see pixel at (x+diffX, y+diffY).
            // Default pattern starts at 0,0 of destination.
            // We want pixel at 0,0 of dest to correspond to diffX, diffY of source.
            // So translate pattern by (diffX - layer.x, diffY - layer.y) because we draw in local layer space.

            // Wait, logic:
            // Source pixel (sx, sy) = (x + diffX, y + diffY)
            // Pattern draws image at 0,0.
            // We want image to be shifted so that the part at sx,sy appears at x,y.
            // If we translate pattern by (dx, dy), then pixel at 0,0 takes value from image at -dx, -dy?
            // Canvas pattern matrix logic is tricky.

            // Alternative: clip to a small circle at x,y, draw image shifted.
            ctx.save();
            ctx.beginPath();
            ctx.arc(localX, localY, brushSize/2, 0, Math.PI*2);
            ctx.clip();
            // Draw image shifted
            // We want to draw the source image such that (sourceX) ends up at (startX)
            // Shift = startX - cloneSourceX
            // Local shift = (startX - layer.x) - cloneSourceX ??

            // Let's simply draw the image:
            // dest point: localX, localY
            // source point: x + diffX, y + diffY  (Global coords)
            // source point: (localX + layer.x) + diffX...

            // We draw the full image at offset:
            // offsetX = localX - (x + diffX) = -diffX - layer.x
            // offsetY = -diffY - layer.y

            // Actually, just:
            // sourceX should correspond to startX.
            // So if we draw image at (startX - cloneSourceX) relative to global?
            // Draw image at (diffX, diffY)? No.

            // Fixed offset logic:
            // diffX = cloneSourceX - startX.
            // When we are at startX, we want cloneSourceX.
            // If we draw image at (startX - cloneSourceX, startY - cloneSourceY)...
            // image pixel at (cloneSourceX) will be at (startX - cloneSourceX + cloneSourceX) = startX. Correct.

            // Convert to local layer space:
            // drawImage(img, (startX - cloneSourceX) - layer.x, (startY - cloneSourceY) - layer.y);

            // But this draws the whole image every mouse move. Performance heavy?
            // Yes. But clipping restricts it.

            ctx.translate(startX - cloneSourceX - layer.x, startY - cloneSourceY - layer.y);
            ctx.drawImage(window.cloneSourceImage, 0, 0);

            ctx.restore();
            // No stroke, we manually painted.

        } else {
            // Normal Brush
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = `rgba(${hexToRgb(brushColor)}, ${brushOpacity})`;

            ctx.lineTo(localX, localY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(localX, localY);
        }

        ctx.restore();
        renderCanvas();
    } else if (currentTool === 'eraser') {
        const ctx = layer.ctx;
        const localX = (x - layer.x);
        const localY = (y - layer.y);

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = `rgba(0,0,0,1)`;

        ctx.lineTo(localX, localY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(localX, localY);
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
    ctx.lineWidth = 1 / zoomLevel;
    ctx.setLineDash([5 / zoomLevel, 5 / zoomLevel]);

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
    } else if (currentTool === 'gradient') {
        // Draw gradient vector line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.setLineDash([]);
        ctx.stroke();

        // Draw arrow head?
        ctx.beginPath();
        ctx.arc(startX, startY, 3, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
}

function handleCanvasClick(e) {
    if (isPanning) return;

    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

    const layer = layerManager.getActiveLayer();
    if (!layer || !layer.visible) return;

    // Transform to local
    const localX = x - layer.x;
    const localY = y - layer.y;

    if (currentTool === 'fill') {
        if (selectionManager.hasSelection) {
            // Selection mask is global, so we use global x,y for mask check
            const maskPixel = selectionManager.ctx.getImageData(x, y, 1, 1).data;
            if (maskPixel[3] === 0) return;
        }

        floodFill(layer, Math.floor(localX), Math.floor(localY), hexToRgba(brushColor));
        historyManager.saveState();
        renderCanvas();
    } else if (currentTool === 'wand') {
        // Magic Wand Logic
        const tolerance = 30; // Hardcoded tolerance for now
        magicWandSelection(layer, Math.floor(localX), Math.floor(localY), tolerance);
    } else if (currentTool === 'picker') {
        const pixel = layer.ctx.getImageData(localX, localY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        brushColor = hex;
        document.getElementById('primary-color').value = hex;
    } else if (currentTool === 'text') {
        const text = prompt("Enter text:", "Text Layer");
        if (text) {
            layer.ctx.font = `${brushSize * 2}px Arial`;
            layer.ctx.fillStyle = brushColor;
            layer.ctx.fillText(text, localX, localY);
            historyManager.saveState();
            renderCanvas();
        }
    }
}

function handleDoubleClick(e) {
    if (currentTool === 'crop' && selectionManager.hasSelection) {
        // Find crop bounds from mask
        // Simple approach: using selectionManager startX, startY and current mouse (or last update)
        // But the user might have dragged in any direction.
        // We need the bounding box of the selection mask.
        // Since crop tool uses rect selection logic, we can track the rect coords.

        // Find bounds of non-transparent pixels in maskCanvas
        const w = selectionManager.width;
        const h = selectionManager.height;
        const imgData = selectionManager.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w, minY = h, maxX = 0, maxY = 0;
        let found = false;

        for(let y=0; y<h; y++) {
            for(let x=0; x<w; x++) {
                if(data[(y*w+x)*4 + 3] > 0) {
                    if(x < minX) minX = x;
                    if(x > maxX) maxX = x;
                    if(y < minY) minY = y;
                    if(y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        if(found) {
            performCrop(minX, minY, maxX - minX + 1, maxY - minY + 1);
        }
    }
}

function performCrop(x, y, w, h) {
    if (w <= 0 || h <= 0) return;

    // Resize main canvas
    mainCanvas.width = w;
    mainCanvas.height = h;
    layerManager.width = w;
    layerManager.height = h;
    selectionManager.width = w;
    selectionManager.height = h;

    // Resize mask canvas
    selectionManager.maskCanvas.width = w;
    selectionManager.maskCanvas.height = h;

    // Adjust Layers
    layerManager.layers.forEach(layer => {
        // Shift layer position
        layer.x -= x;
        layer.y -= y;

        // Note: We don't necessarily need to crop the layer internal canvas,
        // just moving it is enough to "crop" the view.
        // But if we want to save memory or fully commit, we could crop them.
        // For now, simple shift is sufficient and non-destructive to layer data (except for canvas bounds).
    });

    selectionManager.clearSelection();
    historyManager.saveState();
    renderCanvas();

    // Reset view
    panX = 0;
    panY = 0;
    zoomLevel = 1;
}

function handleWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(delta * zoomIntensity);

    const rect = mainCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newZoom = zoomLevel * zoomFactor;

    if (newZoom < 0.1 || newZoom > 10) return;

    const worldX = (mouseX - panX) / zoomLevel;
    const worldY = (mouseY - panY) / zoomLevel;

    panX = mouseX - worldX * newZoom;
    panY = mouseY - worldY * newZoom;
    zoomLevel = newZoom;

    renderCanvas();
}


// --- Algorithms ---

function magicWandSelection(layer, startX, startY, tolerance) {
    // Magic Wand behaves like flood fill but populates selection mask
    const w = layer.canvas.width;
    const h = layer.canvas.height;
    const ctx = layer.ctx;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const startPos = (startY * w + startX) * 4;
    const startColor = [data[startPos], data[startPos+1], data[startPos+2], data[startPos+3]];

    // Prepare selection mask context
    selectionManager.clearSelection();
    selectionManager.hasSelection = true;
    const maskImage = selectionManager.ctx.createImageData(w, h);
    const maskData = maskImage.data;

    const stack = [[startX, startY]];
    const visited = new Set(); // To avoid infinite loops or re-checking

    while(stack.length) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const pos = (y * w + x) * 4;

        if (x < 0 || x >= w || y < 0 || y >= h) continue;

        // Color Match with Tolerance
        if (colorMatchTolerance(data, pos, startColor, tolerance)) {
            // Set mask pixel to opaque (selected)
            // But wait, mask is global. `x` and `y` here are local to layer.
            // We need to map local (x, y) to global mask coordinates.
            const globalX = Math.round(x + layer.x);
            const globalY = Math.round(y + layer.y);

            if (globalX >= 0 && globalX < selectionManager.width && globalY >= 0 && globalY < selectionManager.height) {
                const maskPos = (globalY * selectionManager.width + globalX) * 4;
                // Set mask red (visual debugging) or black/white
                maskData[maskPos] = 0;   // R
                maskData[maskPos+1] = 0; // G
                maskData[maskPos+2] = 255; // B (Blue tint)
                maskData[maskPos+3] = 255; // Alpha
            }

            stack.push([x+1, y]);
            stack.push([x-1, y]);
            stack.push([x, y+1]);
            stack.push([x, y-1]);
        }
    }

    selectionManager.ctx.putImageData(maskImage, 0, 0);
    renderCanvas();
}

function colorMatchTolerance(data, pos, target, tolerance) {
    const r = data[pos];
    const g = data[pos+1];
    const b = data[pos+2];
    const a = data[pos+3];

    // Simple Euclidean distance or just abs diff sum
    const diff = Math.abs(r - target[0]) + Math.abs(g - target[1]) + Math.abs(b - target[2]) + Math.abs(a - target[3]);
    return diff <= tolerance * 4;
}

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
        // Note: Mask is global. StartX/Y are local to layer.
        // We need to check mask at (x + layer.x, y + layer.y)
        if (maskData) {
            const globalX = x + layer.x;
            const globalY = y + layer.y;
            // Check bounds of mask
            if(globalX >= 0 && globalX < selectionManager.width && globalY >= 0 && globalY < selectionManager.height) {
                 const maskPos = (globalY * selectionManager.width + globalX) * 4;
                 if (maskData[maskPos + 3] === 0) continue;
            } else {
                continue; // Outside global mask area implies outside selection usually? Or unselected?
            }
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
        'brush': 0, 'eraser': 1, 'clone': 2, 'move': 3, 'fill': 4, 'gradient': 5, 'wand': 6, 'picker': 7, 'crop': 8,
        'rect': 9, 'circle': 10, 'line': 11, 'text': 12, 'marquee': 13, 'lasso': 14
    };
    if (document.querySelectorAll('.tool')[map[tool]]) {
        document.querySelectorAll('.tool')[map[tool]].classList.add('active');
    }

    mainCanvas.style.cursor = getCursorForTool(tool);
}

function getCursorForTool(tool) {
    if(tool === 'brush' || tool === 'eraser' || tool === 'clone') return 'crosshair';
    else if(tool === 'move') return 'move';
    else if(tool === 'text') return 'text';
    else if(tool === 'picker') return 'cell';
    else if(tool === 'crop') return 'crosshair';
    else if(tool === 'wand' || tool === 'gradient') return 'crosshair';
    return 'default';
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
    // We need to render the final image without zoom/pan for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Replicate renderCanvas logic but flat
    drawCheckerboard(ctx, exportCanvas.width, exportCanvas.height);
    layerManager.layers.forEach(layer => {
        if (!layer.visible) return;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;

        const centerX = (layer.x || 0) + layer.canvas.width / 2;
        const centerY = (layer.y || 0) + layer.canvas.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(layer.rotation || 0);
        ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
        ctx.restore();
    });

    const link = document.createElement('a');
    link.download = 'webphoto-export.jpg';
    link.href = exportCanvas.toDataURL('image/jpeg', 0.8);
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

function saveProject() {
    const project = {
        width: layerManager.width,
        height: layerManager.height,
        layers: layerManager.layers.map(l => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode,
            x: l.x,
            y: l.y,
            scaleX: l.scaleX,
            scaleY: l.scaleY,
            rotation: l.rotation,
            data: l.canvas.toDataURL()
        }))
    };

    const json = JSON.stringify(project);
    const blob = new Blob([json], {type: "application/json"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "webphoto-project.json";
    link.click();
}

function loadProject(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const project = JSON.parse(e.target.result);
            if (!project.layers) throw new Error("Invalid project file");

            // Reset state
            layerManager.layers = [];
            layerManager.layerCounter = 0;

            // Resize canvas if needed
            if (project.width && project.height) {
                mainCanvas.width = project.width;
                mainCanvas.height = project.height;
                layerManager.width = project.width;
                layerManager.height = project.height;
                selectionManager.width = project.width;
                selectionManager.height = project.height;
                selectionManager.maskCanvas.width = project.width;
                selectionManager.maskCanvas.height = project.height;
            }

            // Load layers sequentially to maintain order
            let loaded = 0;

            project.layers.forEach((lData, index) => {
                const layer = new Layer(lData.id, lData.name, mainCanvas.width, mainCanvas.height);
                layer.visible = lData.visible;
                layer.opacity = lData.opacity;
                layer.blendMode = lData.blendMode;
                layer.x = lData.x;
                layer.y = lData.y;
                layer.scaleX = lData.scaleX;
                layer.scaleY = lData.scaleY;
                layer.rotation = lData.rotation;

                const img = new Image();
                img.onload = () => {
                    layer.ctx.drawImage(img, 0, 0);
                    loaded++;
                    if (loaded === project.layers.length) {
                        layerManager.activeLayerId = layerManager.layers[layerManager.layers.length-1].id;
                        renderLayerList();
                        renderCanvas();
                        historyManager.saveState();
                    }
                };
                img.src = lData.data;

                layerManager.layers.push(layer);
                // Update counter
                if (lData.id > layerManager.layerCounter) layerManager.layerCounter = lData.id;
            });

        } catch (err) {
            alert("Error loading project: " + err.message);
        }
    };
    reader.readAsText(file);
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

    // Parameters & Convolution Filters
    let val;
    if (type === 'brightness') {
        const input = prompt("Enter Brightness (-100 to 100):", "0");
        if (input === null) return;
        val = parseInt(input) || 0;
    } else if (type === 'blur') {
        const input = prompt("Enter Blur Radius (0-20):", "5");
        if (input === null) return;
        val = parseInt(input) || 0;
        // Blur handled via canvas filter
        ctx.save();
        if (selectionManager.hasSelection) selectionManager.clipContext(ctx);
        ctx.filter = `blur(${val}px)`;
        ctx.drawImage(layer.canvas, 0, 0);
        ctx.filter = 'none';
        ctx.restore();
        historyManager.saveState();
        renderCanvas();
        return;
    } else if (type === 'sharpen' || type === 'emboss') {
        // Convolution Matrix
        let kernel = [];
        if (type === 'sharpen') {
            kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        } else if (type === 'emboss') {
            kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
        }
        applyConvolution(ctx, w, h, kernel, maskData);
        historyManager.saveState();
        renderCanvas();
        return;
    } else if (type === 'pixelate') {
        const input = prompt("Enter Block Size (2-100):", "10");
        if (input === null) return;
        val = parseInt(input) || 10;
        if(val < 1) val = 1;

        // Pixelate logic: Downscale by factor, then upscale
        // But for selection support, we need to be careful.
        // Easiest per-pixel approach:

        const newImageData = ctx.createImageData(w, h);
        const newData = newImageData.data;

        for (let y = 0; y < h; y += val) {
            for (let x = 0; x < w; x += val) {
                // Get average or center pixel
                const pIndex = (y * w + x) * 4;
                const r = data[pIndex];
                const g = data[pIndex + 1];
                const b = data[pIndex + 2];
                const a = data[pIndex + 3];

                for (let py = 0; py < val; py++) {
                    for (let px = 0; px < val; px++) {
                         if (x + px >= w || y + py >= h) continue;
                         const idx = ((y + py) * w + (x + px)) * 4;

                         // Check selection
                         if (maskData && maskData[idx+3] === 0) {
                             newData[idx] = data[idx];
                             newData[idx+1] = data[idx+1];
                             newData[idx+2] = data[idx+2];
                             newData[idx+3] = data[idx+3];
                         } else {
                             newData[idx] = r;
                             newData[idx+1] = g;
                             newData[idx+2] = b;
                             newData[idx+3] = a;
                         }
                    }
                }
            }
        }
        ctx.putImageData(newImageData, 0, 0);
        historyManager.saveState();
        renderCanvas();
        return;

    } else if (type === 'hue') {
        const input = prompt("Enter Hue Shift in Degrees (0-360):", "180");
        if (input === null) return;
        val = parseInt(input) || 0;
    }

    // Process Pixels (Color Adjustments)
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

function applyConvolution(ctx, w, h, kernel, maskData) {
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);
    const srcData = ctx.getImageData(0, 0, w, h);
    const dstData = ctx.createImageData(w, h);
    const src = srcData.data;
    const dst = dstData.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dstOff = (y * w + x) * 4;

            // If masked out, copy original
            if (maskData && maskData[dstOff + 3] === 0) {
                dst[dstOff] = src[dstOff];
                dst[dstOff+1] = src[dstOff+1];
                dst[dstOff+2] = src[dstOff+2];
                dst[dstOff+3] = src[dstOff+3];
                continue;
            }

            let r = 0, g = 0, b = 0;
            for (let ky = 0; ky < side; ky++) {
                for (let kx = 0; kx < side; kx++) {
                    const scy = y + ky - halfSide;
                    const scx = x + kx - halfSide;
                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                        const srcOff = (scy * w + scx) * 4;
                        const wt = kernel[ky * side + kx];
                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                    }
                }
            }
            dst[dstOff] = r;
            dst[dstOff + 1] = g;
            dst[dstOff + 2] = b;
            dst[dstOff + 3] = src[dstOff + 3];
        }
    }
    ctx.putImageData(dstData, 0, 0);
}

// --- Histogram ---
function transformLayer(type) {
    const layer = layerManager.getActiveLayer();
    if (!layer) {
        alert("No active layer selected.");
        return;
    }

    if (type === 'scale') {
        const inputX = prompt("Enter Scale X (e.g., 1.0):", layer.scaleX || 1);
        if (inputX === null) return;
        const inputY = prompt("Enter Scale Y (e.g., 1.0):", layer.scaleY || (parseFloat(inputX) || 1)); // Default Y to X if not set
        if (inputY === null) return;

        const sx = parseFloat(inputX);
        const sy = parseFloat(inputY);

        if (!isNaN(sx) && !isNaN(sy)) {
            layer.scaleX = sx;
            layer.scaleY = sy;
            historyManager.saveState();
            renderCanvas();
        }
    } else if (type === 'rotate') {
        const currentDeg = (layer.rotation || 0) * (180 / Math.PI);
        const input = prompt("Enter Rotation (degrees):", Math.round(currentDeg));
        if (input !== null) {
            const deg = parseFloat(input);
            if (!isNaN(deg)) {
                layer.rotation = deg * (Math.PI / 180);
                historyManager.saveState();
                renderCanvas();
            }
        }
    }
}

function updateHistogram() {
    const canvas = document.getElementById('histogram-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear histogram
    ctx.clearRect(0, 0, w, h);

    // We want the histogram of the visible canvas.
    // However, mainCanvas is huge and might be transformed.
    // `renderCanvas` draws to `mainCtx`. But we might be mid-rendering.
    // To get accurate histogram of what user sees (the composition):
    // We need to access mainCtx pixel data.
    // But mainCtx has zoom/pan applied. `getImageData` is affected by backing store size, not transforms directly on returned array?
    // Actually getImageData gets pixels from the backing store.
    // Since we cleared and redrew everything on mainCanvas, its pixels are current composition.

    // Performance note: Reading 800x600 pixels every frame is heavy.
    // We should throttle this or do it only on idle/changes.
    // For this demo, we'll do it.

    // But `mainCanvas` might be huge if cropped larger?
    // And `getImageData` on hardware accel canvas can be slow.

    try {
        // Optimization: sample pixels? Or just do full.
        const imgData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
        const data = imgData.data;

        const rCounts = new Array(256).fill(0);
        const gCounts = new Array(256).fill(0);
        const bCounts = new Array(256).fill(0);

        let maxCount = 0;

        for (let i = 0; i < data.length; i += 4) {
            // Skip transparent pixels? Or count them? usually ignore alpha 0
            if (data[i+3] === 0) continue;

            rCounts[data[i]]++;
            gCounts[data[i+1]]++;
            bCounts[data[i+2]]++;
        }

        maxCount = Math.max(...rCounts, ...gCounts, ...bCounts);

        if (maxCount === 0) return;

        // Draw Histograms
        ctx.globalCompositeOperation = 'screen';

        // Draw Red
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        drawChannel(ctx, w, h, rCounts, maxCount);

        // Draw Green
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        drawChannel(ctx, w, h, gCounts, maxCount);

        // Draw Blue
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        drawChannel(ctx, w, h, bCounts, maxCount);

        ctx.globalCompositeOperation = 'source-over';

    } catch (e) {
        // CORS issues if image imported from other domain?
        // Usually fine with file upload.
        console.error("Histogram error", e);
    }
}

function drawChannel(ctx, w, h, counts, max) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const y = h - (counts[i] / max) * h;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
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
    if(e.code === 'Space') {
        isSpacePressed = true;
        mainCanvas.style.cursor = 'grab';
    }

    if(e.key === 'b') setTool('brush');
    if(e.key === 'e') setTool('eraser');
    if(e.key === 's') setTool('clone'); // S for Stamp
    if(e.key === 'g') {
        if(e.shiftKey) setTool('gradient');
        else setTool('fill');
    }
    if(e.key === 'i') setTool('picker');
    if(e.key === 'c') setTool('crop');
    if(e.key === 'r') setTool('rect');
    // if(e.key === 'c') setTool('circle'); // Conflict with crop
    if(e.key === 'l') setTool('lasso');
    if(e.key === 't') setTool('text');
    if(e.key === 'm') setTool('marquee');
    if(e.key === 'v') setTool('move');
    if(e.key === 'w') setTool('wand');
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

window.addEventListener('keyup', (e) => {
    if(e.code === 'Space') {
        isSpacePressed = false;
        mainCanvas.style.cursor = getCursorForTool(currentTool);
        isPanning = false; // Stop panning if space released during drag
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

function zoomIn() {
    zoomLevel *= 1.2;
    // Adjust pan to zoom towards center? Simple zoom center
    const cx = mainCanvas.width / 2;
    const cy = mainCanvas.height / 2;
    // panX = cx - (cx - panX) * 1.2;
    // panY = cy - (cy - panY) * 1.2;
    // Keeping it simple center zoom for menu click
    panX = panX * 1.2 - cx * 0.2;
    panY = panY * 1.2 - cy * 0.2;
    renderCanvas();
}

function zoomOut() {
    zoomLevel /= 1.2;
    const cx = mainCanvas.width / 2;
    const cy = mainCanvas.height / 2;
    panX = panX / 1.2 + cx * (1 - 1/1.2);
    panY = panY / 1.2 + cy * (1 - 1/1.2);
    renderCanvas();
}

function fitScreen() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    renderCanvas();
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
