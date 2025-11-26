type ToolType =
  | "select"
  | "scribble"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "text"
  | "image";

interface Point {
  x: number;
  y: number;
}

interface DrawingElement {
  id: string;
  type: ToolType;
  start: Point;
  end: Point;
  color: string;
  strokeWidth: number;
  points?: Point[];
  imgData?: string;
  text?: string;
}

function getUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class WhiteboardApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textEditor: HTMLTextAreaElement;
  private currentSelectionRect: HTMLDivElement | null = null;
  private elements: DrawingElement[] = [];
  private history: DrawingElement[][] = [];
  private historyIndex: number = -1;
  private isDrawing: boolean = false;
  private currentTool: ToolType = "scribble";
  private currentElement: DrawingElement | null = null;
  private selectedElement: DrawingElement | null = null;
  private dragOffset: Point | null = null;
  private currentColor: string = "#1e1e1e";
  private currentStrokeWidth: number = 3;
  private loadedImages: { [key: string]: HTMLImageElement } = {};
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private colorInput: HTMLInputElement;
  private strokeWidthInput: HTMLInputElement;
  private renderScheduled: boolean = false;
  private snapshotPending: boolean = false;
  private textInputDebounceTimer: number = 0;

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.textEditor = document.getElementById(
      "text-editor"
    ) as HTMLTextAreaElement;

    this.undoButton = document.getElementById("btn-undo") as HTMLButtonElement;
    this.redoButton = document.getElementById("btn-redo") as HTMLButtonElement;
    this.colorInput = document.getElementById("inp-color") as HTMLInputElement;
    this.strokeWidthInput = document.getElementById(
      "inp-stroke-width"
    ) as HTMLInputElement;

    this.resize();
    this.setupEventListeners();
    this.loadFromStorage();
  }

  private setupEventListeners(): void {
    window.addEventListener("resize", () => {
      this.resize();
      this.render();
      this.hideTextEditor();
      this.updateSelectionRect();
    });
    this.canvas.addEventListener(
      "pointerdown",
      this.handlePointerDown.bind(this)
    );
    this.canvas.addEventListener(
      "pointermove",
      this.handlePointerMove.bind(this)
    );
    this.canvas.addEventListener("pointerup", this.handlePointerUp.bind(this));
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document
      .getElementById("btn-select")!
      .addEventListener("click", () => this.setTool("select"));
    document
      .getElementById("btn-scribble")!
      .addEventListener("click", () => this.setTool("scribble"));
    document
      .getElementById("btn-arrow")!
      .addEventListener("click", () => this.setTool("arrow"));
    document
      .getElementById("btn-rectangle")!
      .addEventListener("click", () => this.setTool("rectangle"));
    document
      .getElementById("btn-ellipse")!
      .addEventListener("click", () => this.setTool("ellipse"));
    document
      .getElementById("btn-text")!
      .addEventListener("click", () => this.setTool("text"));
    this.undoButton.addEventListener("click", this.undo.bind(this));
    this.redoButton.addEventListener("click", this.redo.bind(this));
    document
      .getElementById("btn-clear")!
      .addEventListener("click", this.clearBoard.bind(this));
    this.colorInput.addEventListener("input", (e) =>
      this.updateColor((e.target as HTMLInputElement).value)
    );
    this.strokeWidthInput.addEventListener("input", (e) =>
      this.updateStrokeWidth(parseInt((e.target as HTMLInputElement).value))
    );
    const imgInput = document.getElementById("inp-image") as HTMLInputElement;
    imgInput.addEventListener("change", (e) => this.handleImageUpload(e));
    document
      .getElementById("btn-export-png")!
      .addEventListener("click", this.exportAsPNG.bind(this));
    document
      .getElementById("btn-export-svg")!
      .addEventListener("click", this.exportAsSVG.bind(this));
    this.textEditor.addEventListener(
      "input",
      this.handleTextEditorInput.bind(this)
    );
    this.textEditor.addEventListener(
      "blur",
      this.handleTextEditorBlur.bind(this)
    );
    this.textEditor.addEventListener(
      "focus",
      () => {
        this.canvas.style.pointerEvents = "none";
      }
    );
    this.textEditor.addEventListener(
      "blur",
      () => {
        this.canvas.style.pointerEvents = "auto";
      }
    );
    this.textEditor.addEventListener(
      "mouseup",
      this.handleTextEditorResize.bind(this)
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (document.activeElement === this.textEditor) {
      return;
    }
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

    if (ctrlOrCmd) {
      if (e.key === "z") {
        e.preventDefault();
        this.undo();
      } else if (e.key === "y" || (e.shiftKey && e.key === "Z")) {
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
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private setTool(tool: ToolType): void {
    this.currentTool = tool;
    this.hideTextEditor();
    this.clearSelection();
    this.render();
    document
      .querySelectorAll(".tool-group button")
      .forEach((b) => b.classList.remove("active"));
    const toolBtn = document.getElementById(`btn-${tool}`);
    if (toolBtn) toolBtn.classList.add("active");
    this.canvas.style.cursor = tool === "select" ? "default" : "crosshair";
  }

  private updateColor(color: string): void {
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
  }

  private updateStrokeWidth(width: number): void {
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
  }

  private handlePointerDown(e: PointerEvent): void {
    if (document.activeElement === this.textEditor) {
      return;
    }
    
    this.isDrawing = true;
    const { x, y } = this.getCoords(e);
    this.hideTextEditor();
    if (this.currentTool === "select") {
      this.clearSelection();
      const hitElement = this.findElementAt(x, y);
      if (hitElement) {
        this.selectedElement = hitElement;
        this.dragOffset = {
          x: x - hitElement.start.x,
          y: y - hitElement.start.y,
        };
        this.updateSelectionRect();
      }
    } else if (this.currentTool === "text") {
      this.currentElement = {
        id: getUUID(),
        type: "text",
        start: { x, y },
        end: { x: x + 100, y: y + 30 },
        color: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
        text: "",
      };
      this.elements.push(this.currentElement);
      this.showTextEditor(this.currentElement);
      this.saveSnapshot();
    } else {
      this.currentElement = {
        id: getUUID(),
        type: this.currentTool,
        start: { x, y },
        end: { x, y },
        color: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
      };
      if (this.currentTool === "scribble") {
        this.currentElement.points = [{ x, y }];
      }
    }
    this.render();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (document.activeElement === this.textEditor) {
      return;
    }
    
    const { x, y } = this.getCoords(e);
    if (this.isDrawing) {
      if (
        this.currentTool === "select" &&
        this.selectedElement &&
        this.dragOffset
      ) {
        const newX = x - this.dragOffset.x;
        const newY = y - this.dragOffset.y;
        const dx = newX - this.selectedElement.start.x;
        const dy = newY - this.selectedElement.start.y;
        this.selectedElement.start.x = newX;
        this.selectedElement.start.y = newY;
        this.selectedElement.end.x += dx;
        this.selectedElement.end.y += dy;
        if (
          this.selectedElement.type === "scribble" &&
          this.selectedElement.points
        ) {
          this.selectedElement.points = this.selectedElement.points.map(
            (p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })
          );
        }
        this.updateSelectionRect();
      } else if (this.currentElement && this.currentTool !== "text") {
        this.currentElement.end.x = x;
        this.currentElement.end.y = y;
        if (this.currentTool === "scribble") {
          this.currentElement.points?.push({ x, y });
        }
      }
    }
    this.render();
  }

  private handlePointerUp(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.dragOffset = null;

    if (this.currentElement && this.currentTool !== "text") {
      if (this.currentTool !== "image") {
        const minSize = 5;
        const width = Math.abs(
          this.currentElement.end.x - this.currentElement.start.x
        );
        const height = Math.abs(
          this.currentElement.end.y - this.currentElement.start.y
        );
        if (
          this.currentTool !== "scribble" &&
          (width < minSize || height < minSize)
        ) {
          this.elements = this.elements.filter(
            (el) => el.id !== this.currentElement?.id
          );
        } else {
          this.elements.push(this.currentElement);
        }
      }
      this.currentElement = null;
      this.saveSnapshot();
      this.saveToStorage();
    } else if (this.currentTool === "select" && this.selectedElement) {
      this.saveSnapshot();
      this.saveToStorage();
    }
    this.render();
  }

  private getCoords(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private findElementAt(x: number, y: number): DrawingElement | null {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (!el) continue;
      const bbox = this.getElementBounds(el);
      if (
        x >= bbox.x &&
        x <= bbox.x + bbox.width &&
        y >= bbox.y &&
        y <= bbox.y + bbox.height
      ) {
        return el;
      }
    }
    return null;
  }

  private getElementBounds(el: DrawingElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    let minX = el.start.x;
    let minY = el.start.y;
    let maxX = el.end.x;
    let maxY = el.end.y;
    if (el.type === "scribble" && el.points) {
      el.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    }
    const x = Math.min(minX, maxX);
    const y = Math.min(minY, maxY);
    const width = Math.abs(maxX - minX);
    const height = Math.abs(maxY - minY);
    const padding = el.type === "scribble" ? 10 : 5;
    return {
      x: x - padding,
      y: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
    };
  }

  private clearSelection(): void {
    this.selectedElement = null;
    if (this.currentSelectionRect) {
      this.currentSelectionRect.remove();
      this.currentSelectionRect = null;
    }
    this.render();
  }

  private updateSelectionRect(): void {
    if (!this.selectedElement) {
      this.clearSelection();
      return;
    }
    if (!this.currentSelectionRect) {
      this.currentSelectionRect = document.createElement("div");
      this.currentSelectionRect.classList.add("selection-rect");
      document.body.appendChild(this.currentSelectionRect);
    }
    const bbox = this.getElementBounds(this.selectedElement);
    this.currentSelectionRect.style.left = `${bbox.x}px`;
    this.currentSelectionRect.style.top = `${bbox.y}px`;
    this.currentSelectionRect.style.width = `${bbox.width}px`;
    this.currentSelectionRect.style.height = `${bbox.height}px`;
  }

  private saveSnapshot(): void {
    if (this.snapshotPending) return;
    this.snapshotPending = true;
    setTimeout(() => {
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      this.history.push(JSON.parse(JSON.stringify(this.elements)));
      this.historyIndex = this.history.length - 1;
      if (this.history.length > 100) {
        this.history.shift();
        this.historyIndex--;
      }
      this.updateUndoRedoButtons();
      this.snapshotPending = false;
    }, 0);
  }

  private undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.elements = JSON.parse(
        JSON.stringify(this.history[this.historyIndex])
      );
      this.clearSelection();
      this.render();
      this.updateUndoRedoButtons();
      this.saveToStorage();
    }
  }

  private redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.elements = JSON.parse(
        JSON.stringify(this.history[this.historyIndex])
      );
      this.clearSelection();
      this.render();
      this.updateUndoRedoButtons();
      this.saveToStorage();
    }
  }

  private updateUndoRedoButtons(): void {
    this.undoButton.disabled = this.historyIndex <= 0;
    this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
  }

  private handleImageUpload(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        this.addImageToBoard(base64);
      };
      reader.readAsDataURL(target.files[0]);
    }
  }

  private addImageToBoard(base64: string): void {
    const imgObj = new Image();
    imgObj.src = base64;
    imgObj.onload = () => {
      this.loadedImages[base64] = imgObj;
      const maxWidth = 200;
      const maxHeight = 200;
      let width = imgObj.width;
      let height = imgObj.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      const start = {
        x: window.innerWidth / 2 - width / 2,
        y: window.innerHeight / 2 - height / 2,
      };
      const end = { x: start.x + width, y: start.y + height };

      this.elements.push({
        id: getUUID(),
        type: "image",
        imgData: base64,
        start,
        end,
        color: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
      });

      this.saveSnapshot();
      this.saveToStorage();
      this.render();
    };
  }

  private showTextEditor(element: DrawingElement): void {
    if (element.type !== "text") {
      return;
    }
    this.selectedElement = element;
    this.textEditor.classList.remove("text-editor-hidden");
    this.textEditor.style.display = "block";
    this.textEditor.style.position = "absolute";
    this.textEditor.style.left = `${element.start.x}px`;
    this.textEditor.style.top = `${element.start.y}px`;
    this.textEditor.style.width = `${Math.max(100, element.end.x - element.start.x)}px`;
    this.textEditor.style.height = `${Math.max(30, element.end.y - element.start.y)}px`;
    this.textEditor.style.color = element.color;
    this.textEditor.style.fontSize = `${element.strokeWidth * 5}px`;
    this.textEditor.value = element.text || "";
    this.textEditor.readOnly = false;
    setTimeout(() => {
      this.textEditor.focus();
      this.textEditor.select();
    }, 10);
    
    this.updateSelectionRect();
  }

  private hideTextEditor(): void {
    if (
      this.selectedElement &&
      this.selectedElement.type === "text" &&
      !this.textEditor.classList.contains("text-editor-hidden")
    ) {
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
  }

  private handleTextEditorInput(): void {
    if (this.selectedElement && this.selectedElement.type === "text") {
      this.selectedElement.text = this.textEditor.value;
      this.textEditor.style.height = "auto";
      const newHeight = Math.max(30, this.textEditor.scrollHeight);
      this.textEditor.style.height = `${newHeight}px`;
      this.selectedElement.end.y = this.textEditor.offsetTop + newHeight;
      this.updateSelectionRect();
      clearTimeout(this.textInputDebounceTimer);
      this.textInputDebounceTimer = window.setTimeout(() => {
        this.render();
      }, 100);
    }
  }

  private handleTextEditorBlur(): void {
    this.hideTextEditor();
    this.clearSelection();
  }

  private handleTextEditorResize(): void {
    if (this.selectedElement && this.selectedElement.type === "text") {
      this.selectedElement.end.x =
        this.textEditor.offsetLeft + this.textEditor.offsetWidth;
      this.selectedElement.end.y =
        this.textEditor.offsetTop + this.textEditor.offsetHeight;
      this.updateSelectionRect();
      clearTimeout(this.textInputDebounceTimer);
      this.textInputDebounceTimer = window.setTimeout(() => {
        this.render();
      }, 50);
    }
  }
  //RENDERING LOGIC ETC
  private render(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.elements.forEach((el) => this.drawElement(el));
      if (
        this.isDrawing &&
        this.currentElement &&
        this.currentTool !== "select" &&
        this.currentTool !== "text"
      ) {
        this.drawElement(this.currentElement);
      }
      this.updateSelectionRect();
    });
  }

  private drawElement(el: DrawingElement): void {
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
        if (
          el !== this.selectedElement ||
          this.textEditor.classList.contains("text-editor-hidden")
        ) {
          this.drawText(el);
        }
        break;
    }
  }

  private drawScribble(el: DrawingElement): void {
    if (!el.points || el.points.length < 1) return;
    this.ctx.beginPath();
    this.ctx.moveTo(el.points[0]!.x, el.points[0]!.y);
    for (let i = 1; i < el.points.length; i++) {
      this.ctx.lineTo(el.points[i]!.x, el.points[i]!.y);
    }
    this.ctx.stroke();
  }

  private drawArrow(el: DrawingElement): void {
    const { start, end } = el;
    const headlen = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headlen * Math.cos(angle - Math.PI / 6),
      end.y - headlen * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      end.x - headlen * Math.cos(angle + Math.PI / 6),
      end.y - headlen * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawRectangle(el: DrawingElement): void {
    const x = Math.min(el.start.x, el.end.x);
    const y = Math.min(el.start.y, el.end.y);
    const w = Math.abs(el.start.x - el.end.x);
    const h = Math.abs(el.start.y - el.end.y);
    this.ctx.beginPath();
    this.ctx.strokeRect(x, y, w, h);
  }

  private drawEllipse(el: DrawingElement): void {
    const center_x = (el.start.x + el.end.x) / 2;
    const center_y = (el.start.y + el.end.y) / 2;
    const radius_x = Math.abs(el.start.x - el.end.x) / 2;
    const radius_y = Math.abs(el.start.y - el.end.y) / 2;
    this.ctx.beginPath();
    this.ctx.ellipse(center_x, center_y, radius_x, radius_y, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  private drawImage(el: DrawingElement): void {
    if (!el.imgData || !this.loadedImages[el.imgData]) return;
    const img = this.loadedImages[el.imgData]!;
    const x = el.start.x;
    const y = el.start.y;
    const w = el.end.x - el.start.x;
    const h = el.end.y - el.start.y;
    this.ctx.drawImage(img, x, y, w, h);
  }

  private drawText(el: DrawingElement): void {
    if (!el.text) return;
    this.ctx.font = `bold ${el.strokeWidth * 5}px Inter, sans-serif`;
    this.ctx.fillStyle = el.color;
    this.ctx.textBaseline = "top";
    const lines = el.text.split("\n");
    let currentY = el.start.y;
    const lineHeight = el.strokeWidth * 5 * 1.2;
    lines.forEach((line) => {
      this.ctx.fillText(line, el.start.x, currentY);
      currentY += lineHeight;
    });
  }
  private saveToStorage(): void {
    try {
      localStorage.setItem("rawDrawElements", JSON.stringify(this.elements));
      localStorage.setItem("rawDrawHistoryIndex", this.historyIndex.toString());
      localStorage.setItem(
        "rawDrawHistory",
        JSON.stringify(this.history.slice(0, this.historyIndex + 1))
      );
    } catch (error) {
      console.error("Failed to save to local storage:", error);
    }
  }

  private loadFromStorage(): void {
    try {
      const savedElements = localStorage.getItem("rawDrawElements");
      const savedHistory = localStorage.getItem("rawDrawHistory");
      const savedIndex = localStorage.getItem("rawDrawHistoryIndex");
      if (savedElements) {
        this.elements = JSON.parse(savedElements);
      }
      if (savedHistory) {
        this.history = JSON.parse(savedHistory);
      }
      if (savedIndex !== null) {
        this.historyIndex = parseInt(savedIndex, 10);
      }
      const imagesToLoad = this.elements.filter(
        (el) => el.type === "image" && el.imgData
      );

      let imagesLoaded = 0;
      imagesToLoad.forEach((el) => {
        const img = new Image();
        img.src = el.imgData!;
        img.onload = () => {
          this.loadedImages[el.imgData!] = img;
          imagesLoaded++;
          if (imagesLoaded === imagesToLoad.length) {
            this.render();
          }
        };
      });
      if (imagesToLoad.length === 0) {
        this.render();
      }
    } catch (error) {
      console.error("Failed to load from local storage:", error);
    }
    if (this.history.length === 0) {
      this.saveSnapshot();
    }
    this.updateUndoRedoButtons();
  }
  private clearBoard(): void {
    const isConfirmed =
      window.prompt(
        'Type "CLEAR" to confirm clearing the entire board. This action cannot be undone.'
      ) === "CLEAR";
    if (!isConfirmed) {
      return;
    }
    this.elements = [];
    this.clearSelection();
    this.saveSnapshot();
    this.saveToStorage();
    this.render();
  }

  private exportAsPNG(): void {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(this.canvas, 0, 0);
    const link = document.createElement("a");
    link.href = tempCanvas.toDataURL("image/png");
    link.download = "raw-draw-diagram.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportAsSVG(): void {
    const padding = 10;
    let minX = this.canvas.width;
    let minY = this.canvas.height;
    let maxX = 0;
    let maxY = 0;

    this.elements.forEach((el) => {
      const bounds = this.getElementBounds(el);
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
    const width = maxX - minX + 2 * padding;
    const height = maxY - minY + 2 * padding;
    const offsetX = minX - padding;
    const offsetY = minY - padding;
    let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    this.elements.forEach((el) => {
      let style = `stroke="${el.color}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
      const startX = el.start.x - offsetX;
      const startY = el.start.y - offsetY;
      const endX = el.end.x - offsetX;
      const endY = el.end.y - offsetY;
      switch (el.type) {
        case "scribble":
          if (el.points && el.points.length > 1) {
            const pathData = el.points
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"} ${p.x - offsetX} ${p.y - offsetY}`
              )
              .join(" ");
            svgContent += `<path d="${pathData}" ${style} />`;
          }
          break;
        case "arrow":
          svgContent += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" ${style} />`;
          const headlen = 15;
          const angle = Math.atan2(endY - startY, endX - startX);
          const p1x = endX - headlen * Math.cos(angle - Math.PI / 6);
          const p1y = endY - headlen * Math.sin(angle - Math.PI / 6);
          const p2x = endX - headlen * Math.cos(angle + Math.PI / 6);
          const p2y = endY - headlen * Math.sin(angle + Math.PI / 6);
          svgContent += `<polygon points="${endX},${endY} ${p1x},${p1y} ${p2x},${p2y}" fill="${el.color}" stroke="none" />`;
          break;
        case "rectangle":
          const rectX = Math.min(startX, endX);
          const rectY = Math.min(startY, endY);
          const rectW = Math.abs(endX - startX);
          const rectH = Math.abs(endY - startY);
          svgContent += `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" ${style} />`;
          break;
        case "ellipse":
          const cx = (startX + endX) / 2;
          const cy = (startY + endY) / 2;
          const rx = Math.abs(startX - endX) / 2;
          const ry = Math.abs(startY - endY) / 2;
          svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${style} />`;
          break;
        case "text":
          if (el.text) {
            const lines = el.text.split("\n");
            const fontSize = el.strokeWidth * 5;
            const lineHeight = fontSize * 1.2;
            svgContent += `<text x="${startX}" y="${startY}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${el.color}" style="font-weight: bold;">`;
            lines.forEach((line, index) => {
              const dy = index === 0 ? 0 : lineHeight;
              svgContent += `<tspan x="${startX}" dy="${dy}">${line}</tspan>`;
            });
            svgContent += `</text>`;
          }
          break;
        case "image":
          if (el.imgData) {
            const imgW = endX - startX;
            const imgH = endY - startY;
            svgContent += `<image x="${startX}" y="${startY}" width="${imgW}" height="${imgH}" href="${el.imgData}" />`;
          }
          break;
      }
    });

    svgContent += `</svg>`;
    const blob = new Blob([svgContent], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "raw-draw-diagram.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

window.onload = () => {
  new WhiteboardApp();
};