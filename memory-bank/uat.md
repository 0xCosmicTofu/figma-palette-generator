# User Acceptance Testing (UAT) - Palette Generator (Foundation)

## Scope
This UAT validates the foundational behaviors of the Palette Generator plugin prior to implementing core color algorithms (median cut, full scale generation, harmonies). It ensures the plugin loads, the UI operates, messaging works, and the canvas output scaffolding is created.

## Test Environment
- Figma Desktop App (latest)
- Plugin imported via `manifest.json`
- Project directory built with `npm run build` (or `npm run dev` during iteration)

## Roles
- Tester: Designer/Developer
- System Under Test: Palette Generator Figma plugin

## Acceptance Criteria
- Plugin opens without errors and UI renders correctly
- UI controls change state without glitches
- Generate action validates selection and shows appropriate notifications
- With a valid frame, the plugin creates the placeholder output frame
- Progress/status indicators display appropriately
- No console errors in Figma developer console during normal flows

---

## Test Cases

### 1. Plugin Launch
- **Purpose**: Verify plugin launches and UI renders
- **Setup**: Figma file open
- **Steps**:
  1. Run the plugin from Plugins → Development → Palette Generator
- **Expected**:
  - UI window opens (title, instructions, settings, actions)
  - No error notifications

### 2. UI Controls – State Changes
- **Purpose**: Verify settings inputs operate
- **Steps**:
  1. Change “Color Scale Steps” to 5, 9, and 13
  2. Toggle WCAG Accessibility on/off
  3. Select/deselect Harmony Types (Analogous, Complementary, Triadic, Split-Complementary)
- **Expected**:
  - Inputs reflect chosen values, no UI glitches
  - No errors or unexpected notifications

### 3. Generate – No Selection
- **Purpose**: Validate selection requirement
- **Setup**: Nothing selected in canvas
- **Steps**:
  1. Click “Generate Palette”
- **Expected**:
  - Notification: “Please select a frame containing images” (error)
  - No frames are created

### 4. Generate – Non-Frame Selection
- **Purpose**: Prevent invalid node types
- **Setup**: Select a non-frame node (e.g., rectangle, group)
- **Steps**:
  1. Click “Generate Palette”
- **Expected**:
  - Notification: “Please select a frame (not a group or other element)” (error)
  - No frames are created

### 5. Generate – Frame Without Images
- **Purpose**: Validate content requirement
- **Setup**: Select a frame with no bitmap image fills
- **Steps**:
  1. Click “Generate Palette”
- **Expected**:
  - Notification: “No images found in the selected frame” (error)
  - No frames are created

### 6. Generate – Frame With Images (≤ 10)
- **Purpose**: Happy path placeholder output
- **Setup**: Select a frame containing up to 10 bitmap-filled rectangles
- **Steps**:
  1. Click “Generate Palette”
- **Expected**:
  - Progress bar animates; status shows “Generating palette…”
  - Notification: “Palette generated successfully!” (non-error)
  - A new frame named “Generated Color Palette” appears near viewport center (800×600)
  - No console errors

### 7. Generate – Frame With Images (> 10)
- **Purpose**: Enforce current soft limit
- **Setup**: Select a frame containing more than 10 bitmap-filled rectangles
- **Steps**:
  1. Click “Generate Palette”
- **Expected**:
  - Notification: “Maximum 10 images supported. Using first 10 images.” (non-error)
  - A “Generated Color Palette” frame is still created
  - No console errors

### 8. Cancel Action
- **Purpose**: Verify cancel closes plugin cleanly
- **Steps**:
  1. Click “Cancel” in the UI
- **Expected**:
  - Plugin window closes without error

### 9. Progress & Status Visibility
- **Purpose**: Ensure feedback elements behave
- **Steps**:
  1. Initiate Generate
  2. Observe progress bar and status message
- **Expected**:
  - Progress shows during operation
  - Success or error status shown appropriately

### 10. Build/Reload Loop
- **Purpose**: Validate dev workflow
- **Steps**:
  1. Run `npm run dev`
  2. Make a trivial edit to `src/code.ts` (e.g., change success notification text) or `ui.html`
  3. Rebuild occurs
  4. Reload plugin in Figma
- **Expected**:
  - Changes are reflected after reload
  - No TypeScript or lint errors introduced unintentionally

---

## Pass/Fail Criteria
- All high-priority tests (1, 3–7) must pass
- Minor UI issues in test 2 can be noted but are not blockers unless they impact functionality
- No unhandled errors in Figma console during any test

## Known Limitations (at this stage)
- Median cut color extraction not yet implemented (placeholder colors used)
- Full 000–900 scale creation and harmony visualizations not yet generated on canvas
- No color style registration yet

## Notes
- For image tests, ensure rectangles use IMAGE fills (with valid imageHash) rather than placed raster nodes without fills
- The 10-image limit is a current implementation guardrail and can be adjusted later

