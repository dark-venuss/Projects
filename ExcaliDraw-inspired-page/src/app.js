function getUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
var WhiteboardApp = /** @class */ (function () {
    function WhiteboardApp() {
        this.currentSelectionRect = null;
        this.elements = [];
        this.history = [];
        this.historyIndex = -1;
        this.isDrawing = false;
        this.currentTool = "scribble";
        this.currentElement = null;
        this.selectedElement = null;
        this.dragOffset = null;
        this.currentColor = "#1e1e1e";
        this.currentStrokeWidth = 3;
        this.loadedImages = {};
        this.renderScheduled = false;
        this.snapshotPending = false;
        this.textInputDebounceTimer = 0;
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.textEditor = document.getElementById("text-editor");
        this.undoButton = document.getElementById("btn-undo");
        this.redoButton = document.getElementById("btn-redo");
        this.colorInput = document.getElementById("inp-color");
        this.strokeWidthInput = document.getElementById("inp-stroke-width");
        this.resize();
        this.setupEventListeners();
        this.loadFromStorage();
    }
    WhiteboardApp.prototype.setupEventListeners = function () {
        var _this = this;
        window.addEventListener("resize", function () {
            _this.resize();
            _this.render();
            _this.hideTextEditor();
            _this.updateSelectionRect();
        });
        this.canvas.addEventListener("pointerdown", this.handlePointerDown.bind(this));
        this.canvas.addEventListener("pointermove", this.handlePointerMove.bind(this));
        this.canvas.addEventListener("pointerup", this.handlePointerUp.bind(this));
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
        document
            .getElementById("btn-select")
            .addEventListener("click", function () { return _this.setTool("select"); });
        document
            .getElementById("btn-scribble")
            .addEventListener("click", function () { return _this.setTool("scribble"); });
        document
            .getElementById("btn-arrow")
            .addEventListener("click", function () { return _this.setTool("arrow"); });
        document
            .getElementById("btn-rectangle")
            .addEventListener("click", function () { return _this.setTool("rectangle"); });
        document
            .getElementById("btn-ellipse")
            .addEventListener("click", function () { return _this.setTool("ellipse"); });
        document
            .getElementById("btn-text")
            .addEventListener("click", function () { return _this.setTool("text"); });
        this.undoButton.addEventListener("click", this.undo.bind(this));
        this.redoButton.addEventListener("click", this.redo.bind(this));
        document
            .getElementById("btn-clear")
            .addEventListener("click", this.clearBoard.bind(this));
        this.colorInput.addEventListener("input", function (e) {
            return _this.updateColor(e.target.value);
        });
        this.strokeWidthInput.addEventListener("input", function (e) {
            return _this.updateStrokeWidth(parseInt(e.target.value));
        });
        var imgInput = document.getElementById("inp-image");
        imgInput.addEventListener("change", function (e) { return _this.handleImageUpload(e); });
        document
            .getElementById("btn-export-png")
            .addEventListener("click", this.exportAsPNG.bind(this));
        document
            .getElementById("btn-export-svg")
            .addEventListener("click", this.exportAsSVG.bind(this));
        this.textEditor.addEventListener("input", this.handleTextEditorInput.bind(this));
        this.textEditor.addEventListener("blur", this.handleTextEditorBlur.bind(this));
        this.textEditor.addEventListener("focus", function () {
            _this.canvas.style.pointerEvents = "none";
        });
        this.textEditor.addEventListener("blur", function () {
            _this.canvas.style.pointerEvents = "auto";
        });
        this.textEditor.addEventListener("mouseup", this.handleTextEditorResize.bind(this));
    };
    WhiteboardApp.prototype.handleKeyDown = function (e) {
        if (document.activeElement === this.textEditor) {
            return;
        }
        var isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        var ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
        if (ctrlOrCmd) {
            if (e.key === "z") {
                e.preventDefault();
                this.undo();
            }
            else if (e.key === "y" || (e.shiftKey && e.key === "Z")) {
                e.preventDefault();
                this.redo();
            }
        }
        switch (e.key.toLowerCase()) {
            case "v":
                this.setTool("select");
                break;
            case "p":
                this.setTool("scribble");
                break;
            case "a":
                this.setTool("arrow");
                break;
            case "r":
                this.setTool("rectangle");
                break;
            case "o":
                this.setTool("ellipse");
                break;
            case "t":
                this.setTool("text");
                break;
        }
    };
    WhiteboardApp.prototype.resize = function () {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    };
    WhiteboardApp.prototype.setTool = function (tool) {
        this.currentTool = tool;
        this.hideTextEditor();
        this.clearSelection();
        this.render();
        document
            .querySelectorAll(".tool-group button")
            .forEach(function (b) { return b.classList.remove("active"); });
        var toolBtn = document.getElementById("btn-".concat(tool));
        if (toolBtn)
            toolBtn.classList.add("active");
        this.canvas.style.cursor = tool === "select" ? "default" : "crosshair";
    };
    WhiteboardApp.prototype.updateColor = function (color) {
        this.currentColor = color;
        if (this.selectedElement) {
            this.selectedElement.color = color;
            this.saveSnapshot();
            this.render();
        }
        if (this.currentElement) {
            this.currentElement.color = color;
            this.render();
        }
    };
    WhiteboardApp.prototype.updateStrokeWidth = function (width) {
        this.currentStrokeWidth = width;
        if (this.selectedElement) {
            this.selectedElement.strokeWidth = width;
            this.saveSnapshot();
            this.render();
        }
        if (this.currentElement) {
            this.currentElement.strokeWidth = width;
            this.render();
        }
    };
    WhiteboardApp.prototype.handlePointerDown = function (e) {
        if (document.activeElement === this.textEditor) {
            return;
        }
        this.isDrawing = true;
        var _a = this.getCoords(e), x = _a.x, y = _a.y;
        this.hideTextEditor();
        if (this.currentTool === "select") {
            this.clearSelection();
            var hitElement = this.findElementAt(x, y);
            if (hitElement) {
                this.selectedElement = hitElement;
                this.dragOffset = {
                    x: x - hitElement.start.x,
                    y: y - hitElement.start.y,
                };
                this.updateSelectionRect();
            }
        }
        else if (this.currentTool === "text") {
            this.currentElement = {
                id: getUUID(),
                type: "text",
                start: { x: x, y: y },
                end: { x: x + 100, y: y + 30 },
                color: this.currentColor,
                strokeWidth: this.currentStrokeWidth,
                text: "",
            };
            this.elements.push(this.currentElement);
            this.showTextEditor(this.currentElement);
            this.saveSnapshot();
        }
        else {
            this.currentElement = {
                id: getUUID(),
                type: this.currentTool,
                start: { x: x, y: y },
                end: { x: x, y: y },
                color: this.currentColor,
                strokeWidth: this.currentStrokeWidth,
            };
            if (this.currentTool === "scribble") {
                this.currentElement.points = [{ x: x, y: y }];
            }
        }
        this.render();
    };
    WhiteboardApp.prototype.handlePointerMove = function (e) {
        var _a;
        if (document.activeElement === this.textEditor) {
            return;
        }
        var _b = this.getCoords(e), x = _b.x, y = _b.y;
        if (this.isDrawing) {
            if (this.currentTool === "select" &&
                this.selectedElement &&
                this.dragOffset) {
                var newX = x - this.dragOffset.x;
                var newY = y - this.dragOffset.y;
                var dx_1 = newX - this.selectedElement.start.x;
                var dy_1 = newY - this.selectedElement.start.y;
                this.selectedElement.start.x = newX;
                this.selectedElement.start.y = newY;
                this.selectedElement.end.x += dx_1;
                this.selectedElement.end.y += dy_1;
                if (this.selectedElement.type === "scribble" &&
                    this.selectedElement.points) {
                    this.selectedElement.points = this.selectedElement.points.map(function (p) { return ({
                        x: p.x + dx_1,
                        y: p.y + dy_1,
                    }); });
                }
                this.updateSelectionRect();
            }
            else if (this.currentElement && this.currentTool !== "text") {
                this.currentElement.end.x = x;
                this.currentElement.end.y = y;
                if (this.currentTool === "scribble") {
                    (_a = this.currentElement.points) === null || _a === void 0 ? void 0 : _a.push({ x: x, y: y });
                }
            }
        }
        this.render();
    };
    WhiteboardApp.prototype.handlePointerUp = function () {
        var _this = this;
        if (!this.isDrawing)
            return;
        this.isDrawing = false;
        this.dragOffset = null;
        if (this.currentElement && this.currentTool !== "text") {
            if (this.currentTool !== "image") {
                var minSize = 5;
                var width = Math.abs(this.currentElement.end.x - this.currentElement.start.x);
                var height = Math.abs(this.currentElement.end.y - this.currentElement.start.y);
                if (this.currentTool !== "scribble" &&
                    (width < minSize || height < minSize)) {
                    this.elements = this.elements.filter(function (el) { var _a; return el.id !== ((_a = _this.currentElement) === null || _a === void 0 ? void 0 : _a.id); });
                }
                else {
                    this.elements.push(this.currentElement);
                }
            }
            this.currentElement = null;
            this.saveSnapshot();
            this.saveToStorage();
        }
        else if (this.currentTool === "select" && this.selectedElement) {
            this.saveSnapshot();
            this.saveToStorage();
        }
        this.render();
    };
    WhiteboardApp.prototype.getCoords = function (e) {
        var rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };
    WhiteboardApp.prototype.findElementAt = function (x, y) {
        for (var i = this.elements.length - 1; i >= 0; i--) {
            var el = this.elements[i];
            if (!el)
                continue;
            var bbox = this.getElementBounds(el);
            if (x >= bbox.x &&
                x <= bbox.x + bbox.width &&
                y >= bbox.y &&
                y <= bbox.y + bbox.height) {
                return el;
            }
        }
        return null;
    };
    WhiteboardApp.prototype.getElementBounds = function (el) {
        var minX = el.start.x;
        var minY = el.start.y;
        var maxX = el.end.x;
        var maxY = el.end.y;
        if (el.type === "scribble" && el.points) {
            el.points.forEach(function (p) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        }
        var x = Math.min(minX, maxX);
        var y = Math.min(minY, maxY);
        var width = Math.abs(maxX - minX);
        var height = Math.abs(maxY - minY);
        var padding = el.type === "scribble" ? 10 : 5;
        return {
            x: x - padding,
            y: y - padding,
            width: width + padding * 2,
            height: height + padding * 2,
        };
    };
    WhiteboardApp.prototype.clearSelection = function () {
        this.selectedElement = null;
        if (this.currentSelectionRect) {
            this.currentSelectionRect.remove();
            this.currentSelectionRect = null;
        }
        this.render();
    };
    WhiteboardApp.prototype.updateSelectionRect = function () {
        if (!this.selectedElement) {
            this.clearSelection();
            return;
        }
        if (!this.currentSelectionRect) {
            this.currentSelectionRect = document.createElement("div");
            this.currentSelectionRect.classList.add("selection-rect");
            document.body.appendChild(this.currentSelectionRect);
        }
        var bbox = this.getElementBounds(this.selectedElement);
        this.currentSelectionRect.style.left = "".concat(bbox.x, "px");
        this.currentSelectionRect.style.top = "".concat(bbox.y, "px");
        this.currentSelectionRect.style.width = "".concat(bbox.width, "px");
        this.currentSelectionRect.style.height = "".concat(bbox.height, "px");
    };
    WhiteboardApp.prototype.saveSnapshot = function () {
        var _this = this;
        if (this.snapshotPending)
            return;
        this.snapshotPending = true;
        setTimeout(function () {
            if (_this.historyIndex < _this.history.length - 1) {
                _this.history = _this.history.slice(0, _this.historyIndex + 1);
            }
            _this.history.push(JSON.parse(JSON.stringify(_this.elements)));
            _this.historyIndex = _this.history.length - 1;
            if (_this.history.length > 100) {
                _this.history.shift();
                _this.historyIndex--;
            }
            _this.updateUndoRedoButtons();
            _this.snapshotPending = false;
        }, 0);
    };
    WhiteboardApp.prototype.undo = function () {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.clearSelection();
            this.render();
            this.updateUndoRedoButtons();
            this.saveToStorage();
        }
    };
    WhiteboardApp.prototype.redo = function () {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.clearSelection();
            this.render();
            this.updateUndoRedoButtons();
            this.saveToStorage();
        }
    };
    WhiteboardApp.prototype.updateUndoRedoButtons = function () {
        this.undoButton.disabled = this.historyIndex <= 0;
        this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
    };
    WhiteboardApp.prototype.handleImageUpload = function (e) {
        var _this = this;
        var target = e.target;
        if (target.files && target.files[0]) {
            var reader = new FileReader();
            reader.onload = function (event) {
                var _a;
                var base64 = (_a = event.target) === null || _a === void 0 ? void 0 : _a.result;
                _this.addImageToBoard(base64);
            };
            reader.readAsDataURL(target.files[0]);
        }
    };
    WhiteboardApp.prototype.addImageToBoard = function (base64) {
        var _this = this;
        var imgObj = new Image();
        imgObj.src = base64;
        imgObj.onload = function () {
            _this.loadedImages[base64] = imgObj;
            var maxWidth = 200;
            var maxHeight = 200;
            var width = imgObj.width;
            var height = imgObj.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            var start = {
                x: window.innerWidth / 2 - width / 2,
                y: window.innerHeight / 2 - height / 2,
            };
            var end = { x: start.x + width, y: start.y + height };
            _this.elements.push({
                id: getUUID(),
                type: "image",
                imgData: base64,
                start: start,
                end: end,
                color: _this.currentColor,
                strokeWidth: _this.currentStrokeWidth,
            });
            _this.saveSnapshot();
            _this.saveToStorage();
            _this.render();
        };
    };
    WhiteboardApp.prototype.showTextEditor = function (element) {
        var _this = this;
        if (element.type !== "text") {
            return;
        }
        this.selectedElement = element;
        this.textEditor.classList.remove("text-editor-hidden");
        this.textEditor.style.display = "block";
        this.textEditor.style.position = "absolute";
        this.textEditor.style.left = "".concat(element.start.x, "px");
        this.textEditor.style.top = "".concat(element.start.y, "px");
        this.textEditor.style.width = "".concat(Math.max(100, element.end.x - element.start.x), "px");
        this.textEditor.style.height = "".concat(Math.max(30, element.end.y - element.start.y), "px");
        this.textEditor.style.color = element.color;
        this.textEditor.style.fontSize = "".concat(element.strokeWidth * 5, "px");
        this.textEditor.value = element.text || "";
        this.textEditor.readOnly = false;
        setTimeout(function () {
            _this.textEditor.focus();
            _this.textEditor.select();
        }, 10);
        this.updateSelectionRect();
    };
    WhiteboardApp.prototype.hideTextEditor = function () {
        if (this.selectedElement &&
            this.selectedElement.type === "text" &&
            !this.textEditor.classList.contains("text-editor-hidden")) {
            this.selectedElement.text = this.textEditor.value;
            this.selectedElement.end.x =
                this.textEditor.offsetLeft + this.textEditor.offsetWidth;
            this.selectedElement.end.y =
                this.textEditor.offsetTop + this.textEditor.offsetHeight;
            this.saveSnapshot();
            this.saveToStorage();
            this.render();
        }
        this.textEditor.classList.add("text-editor-hidden");
        this.textEditor.style.display = "none";
    };
    WhiteboardApp.prototype.handleTextEditorInput = function () {
        var _this = this;
        if (this.selectedElement && this.selectedElement.type === "text") {
            this.selectedElement.text = this.textEditor.value;
            this.textEditor.style.height = "auto";
            var newHeight = Math.max(30, this.textEditor.scrollHeight);
            this.textEditor.style.height = "".concat(newHeight, "px");
            this.selectedElement.end.y = this.textEditor.offsetTop + newHeight;
            this.updateSelectionRect();
            clearTimeout(this.textInputDebounceTimer);
            this.textInputDebounceTimer = window.setTimeout(function () {
                _this.render();
            }, 100);
        }
    };
    WhiteboardApp.prototype.handleTextEditorBlur = function () {
        this.hideTextEditor();
        this.clearSelection();
    };
    WhiteboardApp.prototype.handleTextEditorResize = function () {
        var _this = this;
        if (this.selectedElement && this.selectedElement.type === "text") {
            this.selectedElement.end.x =
                this.textEditor.offsetLeft + this.textEditor.offsetWidth;
            this.selectedElement.end.y =
                this.textEditor.offsetTop + this.textEditor.offsetHeight;
            this.updateSelectionRect();
            clearTimeout(this.textInputDebounceTimer);
            this.textInputDebounceTimer = window.setTimeout(function () {
                _this.render();
            }, 50);
        }
    };
    //RENDERING LOGIC ETC
    WhiteboardApp.prototype.render = function () {
        var _this = this;
        if (this.renderScheduled)
            return;
        this.renderScheduled = true;
        requestAnimationFrame(function () {
            _this.renderScheduled = false;
            _this.ctx.clearRect(0, 0, _this.canvas.width, _this.canvas.height);
            _this.elements.forEach(function (el) { return _this.drawElement(el); });
            if (_this.isDrawing &&
                _this.currentElement &&
                _this.currentTool !== "select" &&
                _this.currentTool !== "text") {
                _this.drawElement(_this.currentElement);
            }
            _this.updateSelectionRect();
        });
    };
    WhiteboardApp.prototype.drawElement = function (el) {
        this.ctx.strokeStyle = el.color;
        this.ctx.fillStyle = el.color;
        this.ctx.lineWidth = el.strokeWidth;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        switch (el.type) {
            case "scribble":
                this.drawScribble(el);
                break;
            case "arrow":
                this.drawArrow(el);
                break;
            case "rectangle":
                this.drawRectangle(el);
                break;
            case "ellipse":
                this.drawEllipse(el);
                break;
            case "image":
                this.drawImage(el);
                break;
            case "text":
                if (el !== this.selectedElement ||
                    this.textEditor.classList.contains("text-editor-hidden")) {
                    this.drawText(el);
                }
                break;
        }
    };
    WhiteboardApp.prototype.drawScribble = function (el) {
        if (!el.points || el.points.length < 1)
            return;
        this.ctx.beginPath();
        this.ctx.moveTo(el.points[0].x, el.points[0].y);
        for (var i = 1; i < el.points.length; i++) {
            this.ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        this.ctx.stroke();
    };
    WhiteboardApp.prototype.drawArrow = function (el) {
        var start = el.start, end = el.end;
        var headlen = 15;
        var angle = Math.atan2(end.y - start.y, end.x - start.x);
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.closePath();
        this.ctx.fill();
    };
    WhiteboardApp.prototype.drawRectangle = function (el) {
        var x = Math.min(el.start.x, el.end.x);
        var y = Math.min(el.start.y, el.end.y);
        var w = Math.abs(el.start.x - el.end.x);
        var h = Math.abs(el.start.y - el.end.y);
        this.ctx.beginPath();
        this.ctx.strokeRect(x, y, w, h);
    };
    WhiteboardApp.prototype.drawEllipse = function (el) {
        var center_x = (el.start.x + el.end.x) / 2;
        var center_y = (el.start.y + el.end.y) / 2;
        var radius_x = Math.abs(el.start.x - el.end.x) / 2;
        var radius_y = Math.abs(el.start.y - el.end.y) / 2;
        this.ctx.beginPath();
        this.ctx.ellipse(center_x, center_y, radius_x, radius_y, 0, 0, 2 * Math.PI);
        this.ctx.stroke();
    };
    WhiteboardApp.prototype.drawImage = function (el) {
        if (!el.imgData || !this.loadedImages[el.imgData])
            return;
        var img = this.loadedImages[el.imgData];
        var x = el.start.x;
        var y = el.start.y;
        var w = el.end.x - el.start.x;
        var h = el.end.y - el.start.y;
        this.ctx.drawImage(img, x, y, w, h);
    };
    WhiteboardApp.prototype.drawText = function (el) {
        var _this = this;
        if (!el.text)
            return;
        this.ctx.font = "bold ".concat(el.strokeWidth * 5, "px Inter, sans-serif");
        this.ctx.fillStyle = el.color;
        this.ctx.textBaseline = "top";
        var lines = el.text.split("\n");
        var currentY = el.start.y;
        var lineHeight = el.strokeWidth * 5 * 1.2;
        lines.forEach(function (line) {
            _this.ctx.fillText(line, el.start.x, currentY);
            currentY += lineHeight;
        });
    };
    WhiteboardApp.prototype.saveToStorage = function () {
        try {
            localStorage.setItem("rawDrawElements", JSON.stringify(this.elements));
            localStorage.setItem("rawDrawHistoryIndex", this.historyIndex.toString());
            localStorage.setItem("rawDrawHistory", JSON.stringify(this.history.slice(0, this.historyIndex + 1)));
        }
        catch (error) {
            console.error("Failed to save to local storage:", error);
        }
    };
    WhiteboardApp.prototype.loadFromStorage = function () {
        var _this = this;
        try {
            var savedElements = localStorage.getItem("rawDrawElements");
            var savedHistory = localStorage.getItem("rawDrawHistory");
            var savedIndex = localStorage.getItem("rawDrawHistoryIndex");
            if (savedElements) {
                this.elements = JSON.parse(savedElements);
            }
            if (savedHistory) {
                this.history = JSON.parse(savedHistory);
            }
            if (savedIndex !== null) {
                this.historyIndex = parseInt(savedIndex, 10);
            }
            var imagesToLoad_1 = this.elements.filter(function (el) { return el.type === "image" && el.imgData; });
            var imagesLoaded_1 = 0;
            imagesToLoad_1.forEach(function (el) {
                var img = new Image();
                img.src = el.imgData;
                img.onload = function () {
                    _this.loadedImages[el.imgData] = img;
                    imagesLoaded_1++;
                    if (imagesLoaded_1 === imagesToLoad_1.length) {
                        _this.render();
                    }
                };
            });
            if (imagesToLoad_1.length === 0) {
                this.render();
            }
        }
        catch (error) {
            console.error("Failed to load from local storage:", error);
        }
        if (this.history.length === 0) {
            this.saveSnapshot();
        }
        this.updateUndoRedoButtons();
    };
    WhiteboardApp.prototype.clearBoard = function () {
        var isConfirmed = window.prompt('Type "CLEAR" to confirm clearing the entire board. This action cannot be undone.') === "CLEAR";
        if (!isConfirmed) {
            return;
        }
        this.elements = [];
        this.clearSelection();
        this.saveSnapshot();
        this.saveToStorage();
        this.render();
    };
    WhiteboardApp.prototype.exportAsPNG = function () {
        var tempCanvas = document.createElement("canvas");
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        var tempCtx = tempCanvas.getContext("2d");
        tempCtx.fillStyle = "#ffffff";
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(this.canvas, 0, 0);
        var link = document.createElement("a");
        link.href = tempCanvas.toDataURL("image/png");
        link.download = "raw-draw-diagram.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    WhiteboardApp.prototype.exportAsSVG = function () {
        var _this = this;
        var padding = 10;
        var minX = this.canvas.width;
        var minY = this.canvas.height;
        var maxX = 0;
        var maxY = 0;
        this.elements.forEach(function (el) {
            var bounds = _this.getElementBounds(el);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        if (this.elements.length === 0) {
            console.warn("Board is empty, generating minimal SVG.");
            minX = 0;
            minY = 0;
            maxX = 100;
            maxY = 100;
        }
        var width = maxX - minX + 2 * padding;
        var height = maxY - minY + 2 * padding;
        var offsetX = minX - padding;
        var offsetY = minY - padding;
        var svgContent = "<svg width=\"".concat(width, "\" height=\"").concat(height, "\" viewBox=\"0 0 ").concat(width, " ").concat(height, "\" xmlns=\"http://www.w3.org/2000/svg\">");
        this.elements.forEach(function (el) {
            var style = "stroke=\"".concat(el.color, "\" stroke-width=\"").concat(el.strokeWidth, "\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"");
            var startX = el.start.x - offsetX;
            var startY = el.start.y - offsetY;
            var endX = el.end.x - offsetX;
            var endY = el.end.y - offsetY;
            switch (el.type) {
                case "scribble":
                    if (el.points && el.points.length > 1) {
                        var pathData = el.points
                            .map(function (p, i) {
                            return "".concat(i === 0 ? "M" : "L", " ").concat(p.x - offsetX, " ").concat(p.y - offsetY);
                        })
                            .join(" ");
                        svgContent += "<path d=\"".concat(pathData, "\" ").concat(style, " />");
                    }
                    break;
                case "arrow":
                    svgContent += "<line x1=\"".concat(startX, "\" y1=\"").concat(startY, "\" x2=\"").concat(endX, "\" y2=\"").concat(endY, "\" ").concat(style, " />");
                    var headlen = 15;
                    var angle = Math.atan2(endY - startY, endX - startX);
                    var p1x = endX - headlen * Math.cos(angle - Math.PI / 6);
                    var p1y = endY - headlen * Math.sin(angle - Math.PI / 6);
                    var p2x = endX - headlen * Math.cos(angle + Math.PI / 6);
                    var p2y = endY - headlen * Math.sin(angle + Math.PI / 6);
                    svgContent += "<polygon points=\"".concat(endX, ",").concat(endY, " ").concat(p1x, ",").concat(p1y, " ").concat(p2x, ",").concat(p2y, "\" fill=\"").concat(el.color, "\" stroke=\"none\" />");
                    break;
                case "rectangle":
                    var rectX = Math.min(startX, endX);
                    var rectY = Math.min(startY, endY);
                    var rectW = Math.abs(endX - startX);
                    var rectH = Math.abs(endY - startY);
                    svgContent += "<rect x=\"".concat(rectX, "\" y=\"").concat(rectY, "\" width=\"").concat(rectW, "\" height=\"").concat(rectH, "\" ").concat(style, " />");
                    break;
                case "ellipse":
                    var cx = (startX + endX) / 2;
                    var cy = (startY + endY) / 2;
                    var rx = Math.abs(startX - endX) / 2;
                    var ry = Math.abs(startY - endY) / 2;
                    svgContent += "<ellipse cx=\"".concat(cx, "\" cy=\"").concat(cy, "\" rx=\"").concat(rx, "\" ry=\"").concat(ry, "\" ").concat(style, " />");
                    break;
                case "text":
                    if (el.text) {
                        var lines = el.text.split("\n");
                        var fontSize = el.strokeWidth * 5;
                        var lineHeight_1 = fontSize * 1.2;
                        svgContent += "<text x=\"".concat(startX, "\" y=\"").concat(startY, "\" font-family=\"Inter, sans-serif\" font-size=\"").concat(fontSize, "\" fill=\"").concat(el.color, "\" style=\"font-weight: bold;\">");
                        lines.forEach(function (line, index) {
                            var dy = index === 0 ? 0 : lineHeight_1;
                            svgContent += "<tspan x=\"".concat(startX, "\" dy=\"").concat(dy, "\">").concat(line, "</tspan>");
                        });
                        svgContent += "</text>";
                    }
                    break;
                case "image":
                    if (el.imgData) {
                        var imgW = endX - startX;
                        var imgH = endY - startY;
                        svgContent += "<image x=\"".concat(startX, "\" y=\"").concat(startY, "\" width=\"").concat(imgW, "\" height=\"").concat(imgH, "\" href=\"").concat(el.imgData, "\" />");
                    }
                    break;
            }
        });
        svgContent += "</svg>";
        var blob = new Blob([svgContent], {
            type: "image/svg+xml;charset=utf-8",
        });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "raw-draw-diagram.svg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    return WhiteboardApp;
}());
window.onload = function () {
    new WhiteboardApp();
};
