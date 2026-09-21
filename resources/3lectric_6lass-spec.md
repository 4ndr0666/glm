# 4NDR0666OS GTK3 UI/UX SPECIFICATION: 3LECTRIC-GLASS PARADIGM
**DOCUMENT CLASSIFICATION:** CRITICAL SYSTEM REQUISITE
**TARGET ARCHITECTURE:** GTK 3.22+
**RENDERING ENGINE:** Cairo / X11 / Wayland Compositor (with strict RGBA visual enforcement)
**PARADIGM:** Statistically Pure Glassmorphism (Totalitarian Override Level 800)

---

## 1.0 ARCHITECTURAL OVERVIEW & RENDERING PIPELINE

The "3lectric-Glass" paradigm is a strictly defined, hardware-accelerated user interface specification designed for volatile system orchestration environments. It rejects standard opaque widget rendering in favor of a layered, alpha-composited spatial hierarchy. The system relies on absolute control over the GTK CSS parsing engine and mandates explicit compositor support for an RGBA visual pipeline.

### 1.1 Compositor Prerequisite & Hardware Alpha Enablement
For the CSS alpha channels to render as physical transparency (glassmorphism) rather than being flattened against a black or gray fallback canvas, the GTK application must intercept the window realization phase.

The rendering pipeline must execute the following sequence unconditionally before `Gtk.Window` rendering:
1.  **Application Paintability:** `Gtk.Window.set_app_paintable(True)` must be invoked to bypass default GTK background filling.
2.  **Visual Extraction:** The active display screen (`Gtk.Window.get_screen()`) must be queried for an RGBA visual (`get_rgba_visual()`).
3.  **Visual Injection:** The extracted visual must be forced into the application configuration via `set_visual()`. Failure to acquire the RGBA visual must trigger a strict fallback or system warning.

### 1.2 Parser Constraints & Lexical Safety
The GTK3 CSS provider is a specialized parser, not a standard web CSS3 engine. Compliance requires adhering to the following hardcoded constraints:
* **Universal Color Ban:** The universal selector `*` will critically fault if assigned a hex color value (e.g., `color: #00E5FF;`). GTK evaluates this out-of-bounds. Color properties must be distributed to discrete widget nodes (e.g., `label`, `button`).
* **Property Sanitization:** Web-centric properties such as `text-shadow` or `-webkit-` prefixes will be silently discarded or trigger parser warnings. They are strictly prohibited to maintain log purity.
* **Font Array Fallback:** Commas in `font-family` declarations (e.g., `"JetBrains Mono", monospace`) are legally parsed. The engine attempts a chronological resolution.
* **Animation Legality:** `transition` properties are fully supported globally in GTK 3.22+ and are mandated for interactive node state changes.

---

## 2.0 COLORIMETRY & ALPHA COMPOSITING MATRIX

The visual matrix relies on a heavily restricted palette. All backgrounds utilize a specific dark-blue/black base (`RGB 10, 19, 26`) manipulated exclusively through its alpha channel to achieve depth layering. All active elements utilize high-contrast neon accents.

### 2.1 Base Palette Specification

| Functionality | Hex Code / RGBA | Definition & Usage |
| :--- | :--- | :--- |
| **Matrix Deep Base** | `rgba(10, 19, 26, 1.0)` | Absolute zero depth. Used only as a root reference. |
| **Glass Level 1 (Window)**| `rgba(10, 19, 26, 0.72)`| Primary application window background. Allows maximum safe wallpaper bleed. |
| **Glass Level 2 (Menu/Popup)**| `rgba(10, 19, 26, 0.65)`| Ephemeral overlay background. Slightly more opaque to ensure legibility. |
| **Glass Level 3 (Panel/Input)**| `rgba(10, 19, 26, 0.55)`| Nested input fields and panels. Lowest opacity for maximum perceived depth. |
| **Solid Header** | `rgba(10, 19, 26, 0.95)`| Headerbar base. Near-opaque to anchor the drag surface. |
| **Primary Accent** | `#00E5FF` | The primary interactive and text color. "Electric Cyan". |
| **Secondary Accent** | `#67E8F9` | Hover states, highlights, and primary titles. |
| **Destructive Alert** | `#ff0055` | System purge actions. "Neon Pink/Red". |
| **Absolute Light** | `#ffffff` | Pure white. Used exclusively for active button text or critical notifications. |

### 2.2 Global Transition Specifications
All state changes (hover, active, checked) must interpolate smoothly to prevent visual jarring in the orchestration interface.
* **Transition Target:** `all`
* **Duration:** `150ms`
* **Easing Function:** `ease-in-out`

---

## 3.0 TYPOGRAPHY SCHEMATICS

Font rendering enforces a strict separation between structural components and data presentation.

* **System/Data Font:** `"JetBrains Mono", monospace`
    * *Usage:* Universal default. Applied to all standard labels, buttons, console outputs, and subtitles. Guarantees deterministic character width for alignment.
* **Display Font:** `"Orbitron", sans-serif`
    * *Usage:* Headerbar primary titles. Weight `700` (Bold). Size `14pt`.

---

## 4.0 WIDGET NODE TOPOLOGY

The following details the exact CSS topologies mapped to GTK widget classes.

### 4.1 The Universal Engine (`*`)
* **Background:** Must be explicitly set to `none` to eradicate inherited system themes (e.g., Adwaita gradients).
* **Typography:** Defaults to `JetBrains Mono`.
* **Animation:** Globally hooks the `150ms` transition.

### 4.2 Main Window Orchestrator (`window.main-window`)
* **Alpha Base:** `rgba(10, 19, 26, 0.72)`
* **Containment Field:** Bounded by a `1px solid rgba(0, 229, 255, 0.2)` border.
* **Spatial Glow:** Emits an outer aura via `box-shadow: 0 0 40px rgba(0, 229, 255, 0.15)`.
* **Default Color:** `#00E5FF` (Note: Only applies to nodes inheriting directly that don't override).

### 4.3 HeaderBar Typology (`headerbar`)
The top-level window grip must remain visually distinct from the volatile logic area.
* **Alpha Base:** `rgba(10, 19, 26, 0.95)` (High opacity).
* **Lower Boundary:** `border-bottom: 2px solid #00E5FF;` for a hard termination line.
* **Title Node (`.title`):** Orbitron, 14pt, 700 weight, `#67E8F9`.
* **Subtitle Node (`.subtitle`):** JetBrains Mono, 9pt, `rgba(0, 229, 255, 0.7)`.

### 4.4 Standard Control Surfaces (`button`)
Buttons must look like discrete, actionable terminals.
* **Idle State:** * Background: `rgba(10, 19, 26, 0.65)`
    * Border: `1px solid rgba(0, 229, 255, 0.4)`
    * Geometry: `border-radius: 0px;` (Strict rectangular brutalism).
* **Hover State (`:hover`):**
    * Background shifts to a cyan wash: `rgba(0, 229, 255, 0.2)`
    * Glow emission: `box-shadow: 0 0 20px rgba(0, 229, 255, 0.5)`
    * Text color: `#67E8F9`
* **Active State (`:active`):**
    * Background opacity increases: `rgba(0, 229, 255, 0.3)`
    * Text color: `#ffffff`

### 4.5 Destructive Control Surfaces (`button.destructive-action`)
Buttons triggering irreversible system actions (e.g., environmental purge) override the primary cyan with the alert hex.
* **Idle State:** Border and Color set to `#ff0055`.
* **Hover State:** Background wash `rgba(255, 0, 85, 0.3)` and intense box-shadow `0 0 25px #ff0055`. Text shifts to `#ffffff`.

### 4.6 Boolean Toggles (`switch`)
Replaces standard checkmarks with sliding logic gates.
* **Trough (Idle):** Background `#050A0F`, Border `1px solid #00E5FF`.
* **Slider (The Node):** Pure `#00E5FF` with a localized aura `box-shadow: 0 0 12px rgba(0, 229, 255, 0.8)`.
* **Trough (Active/Checked):** Background floods with cyan wash `rgba(0, 229, 255, 0.2)`.

### 4.7 Ephemeral Popovers & Comboboxes (`combobox`, `menu`, `popover`)
*Crucial architecture to prevent dropdown detachment from the glassmorphism paradigm.*
* **Parent Toggle (`combobox button`):** Inherits standard button styling but shifts base to `rgba(10, 19, 26, 0.55)`.
* **Spawned Nodes (`window.popup`, `menu`, `popover`):** When the system generates the floating dropdown, it must explicitly catch these classes.
    * Background: `rgba(10, 19, 26, 0.65)`
    * Border: `1px solid rgba(0, 229, 255, 0.3)`
    * Geometry: Bounded by `box-shadow: 0 0 20px rgba(0, 229, 255, 0.15)`.
* **Children (`menuitem`):** Padding 5px. On hover, background shifts to `rgba(0, 229, 255, 0.2)` and text to `#ffffff`.

### 4.8 Spatial Navigation (`scrollbar`)
Scrollbars must be minimized and non-intrusive.
* **Trough:** `rgba(0, 0, 0, 0.4)` (Subdued void).
* **Slider:** `#00E5FF` with `0` border radius. Minimum dimensions enforced at `6px` by `6px`. Hover state lightens to `#67E8F9`.

---

## 5.0 THE LITERAL STYLESHEET PAYLOAD

To instantiate the 3lectric-Glass paradigm, the GTK `CssProvider` must ingest the following raw CSS byte-string exactly as written.

```css
/* --- RESET --- */
* {
    background: none;
    font-family: "JetBrains Mono", monospace;
    transition: all 150ms ease-in-out;
}

/* --- MAIN WINDOW --- */
window.main-window {
    background-color: rgba(10, 19, 26, 0.72);
    border: 1px solid rgba(0, 229, 255, 0.2);
    box-shadow: 0 0 40px rgba(0, 229, 255, 0.15);
    color: #00E5FF;
}

/* --- HEADERBAR --- */
headerbar {
    background: rgba(10, 19, 26, 0.95);
    border-bottom: 2px solid #00E5FF;
    padding: 10px;
    color: #00E5FF;
}

headerbar .title {
    font-family: "Orbitron", sans-serif;
    font-size: 14pt;
    font-weight: 700;
    color: #67E8F9;
}

headerbar .subtitle {
    font-family: "JetBrains Mono", monospace;
    font-size: 9pt;
    color: rgba(0, 229, 255, 0.7);
}

/* --- GENERIC LABEL COLOUR --- */
label {
    color: #00E5FF;
}

/* --- GLASS PANEL --- */
.glass-panel {
    background: rgba(10, 19, 26, 0.55);
    border: 1px solid rgba(0, 229, 255, 0.3);
    border-radius: 4px;
    margin: 5px;
    color: #00E5FF;
}

/* --- BUTTONS --- */
button {
    background: rgba(10, 19, 26, 0.65);
    border: 1px solid rgba(0, 229, 255, 0.4);
    color: #00E5FF;
    border-radius: 0px;
    padding: 10px 20px;
    font-weight: bold;
}

button:hover {
    background: rgba(0, 229, 255, 0.2);
    border-color: #00E5FF;
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.5);
    color: #67E8F9;
}

button:active {
    background: rgba(0, 229, 255, 0.3);
    color: #ffffff;
}

/* --- DESTRUCTIVE BUTTONS --- */
button.destructive-action,
button.destructive {
    border-color: #ff0055;
    color: #ff0055;
}

button.destructive-action:hover,
button.destructive:hover {
    background: rgba(255, 0, 85, 0.3);
    box-shadow: 0 0 25px #ff0055;
    color: #ffffff;
}

/* --- SWITCHES --- */
switch {
    background: #050A0F;
    border: 1px solid #00E5FF;
    color: #00E5FF;
}

switch slider {
    background: #00E5FF;
    box-shadow: 0 0 12px rgba(0, 229, 255, 0.8);
}

switch:checked {
    background: rgba(0, 229, 255, 0.2);
}

/* --- COMBOBOX / DROPDOWNS / POPOVERS --- */
combobox,
combobox button {
    background: rgba(10, 19, 26, 0.55);
    border: 1px solid rgba(0, 229, 255, 0.4);
    color: #00E5FF;
}

combobox window.popup,
combobox window.popup menu,
menu,
popover {
    background: rgba(10, 19, 26, 0.65);
    border: 1px solid rgba(0, 229, 255, 0.3);
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
    color: #00E5FF;
}

menuitem {
    color: #00E5FF;
    padding: 5px;
}

menuitem:hover {
    background: rgba(0, 229, 255, 0.2);
    color: #ffffff;
}

/* --- SCROLLBARS --- */
scrollbar trough {
    background-color: rgba(0, 0, 0, 0.4);
}

scrollbar slider {
    background-color: #00E5FF;
    border-radius: 0;
    min-width: 6px;
    min-height: 6px;
}

scrollbar slider:hover {
    background-color: #67E8F9;
}

/* --- REVEALER / NOTIFICATION OVERLAY --- */
.notification-label {
    color: #ffffff;
    font-weight: bold;
}
```
