# NJ SERFF Compliance Pre-Check App

## Layout

**Page styling:**
- White background
- Font: Helvetica (or sans-serif fallback)
- Text color: neutral-800
- Minimal border-radius on all visible block elements
- Content container: max-width w-4xl, centered on page

### Header

Display two text elements:
- Title: "SERFF Compliance Pre-Check"
- Subtitle: "New-Jersey"

### Upload Fields

**Structure:**
- 4 upload fields with labels positioned above each field
- Labels (in order): "Forms", "Rate/Rule", "Supporting Documentation", "Correspondence"
- Layout: 2x2 grid on wider viewports, 1x4 column on narrow viewports (same breakpoint as Checklist)
- Field dimensions: 4:3 aspect ratio (rectangular)

**Initial state (empty), the placeholder is centered:**
- Lucide 'file-up' icon
- Text: "drop files here"

**Upload behavior:**
- Files upload immediately on drop (no manual submit)
- After upload, files display as a list inside their respective upload field
- Each file in the list shows: filename + lime-700 Lucide 'check' icon that turns into a red-700 'trash' on hover and removes uploaded file on click
- If the file list exceeds the field height, enable vertical scrolling within the field

### Run Button

**Appearance:**
- Lime-500 background button
- Text: "Run SERFF compliance pre-check"
- Centered horizontally on the page

**Functionality:**
When clicked, send a request to OpenAI API containing:
1. All uploaded files
2. 4 lists of file names resembling file categories defined by which upload field was used
3. System prompt that explains the compliance checking task and defines input/output structure
4. Additional check-specific instructions loaded from a separate 'checks' file

### Checklist

**Structure:**
- H3 heading: "Checklist"
- List of compliance checks (loaded from 'checks' file)
- Layout: 2 columns on wider viewports, 1 column on narrow viewports (same breakpoint as Upload Fields)

**Each checklist item contains:**
1. **Title** with **state indicator** (displayed inline next to title)
2. **Short description** (below title)
3. **Check-specific summary** (below description, populated after check completes), lime/red/amber-800 depending on the result

**State indicator logic:**
- **Before Run button is pressed:** No indicator shown
- **After Run button is pressed:**
  - Initially: neutral-800 spinning Lucide 'loader-circle' (processing)
  - After processing completes, one of:
    - lime-700 Lucide 'check' (pass)
    - red-700 Lucide 'x' (fail)
    - amber-700 Lucide 'triangle-alert' (warning)

### Summary & To-Do

**Visibility:** These sections appear only after all checks have completed processing.

**Summary section:**
- H3 heading: "Summary"
- Plain text summary of overall results

**To-Do section:**
- H3 heading: "To-Do"
- List of remaining actions needed to complete compliance pre-check

## Data Handling

...