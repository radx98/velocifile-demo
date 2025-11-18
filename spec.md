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

### Upload Field

**Structure:**
- Single upload field
- Width: Full width of content container (w-4xl)
- Height: h-64

**Initial state (empty), the placeholder is centered:**
- Lucide 'file-up' icon
- Text: "Upload documents"

**Upload behavior:**
- Files upload immediately on drop (no manual submit)
- After upload, files display as a list under the upload field
- Each file in the list shows: filename + lime-700 Lucide 'check' icon that turns into a red-700 'trash' on hover and removes uploaded file on click

### Run Button

**Appearance:**
- Lime-500 background button
- Text: "Run SERFF compliance pre-check"
- Centered horizontally on the page

**Functionality:**
When clicked, send a request to OpenAI API containing:
1. All uploaded files
2. System prompt that explains the compliance checking task and defines input/output structure
3. Additional check-specific instructions loaded from a separate 'checks' file

### Checklist

**Structure:**
- H3 heading: "Checklist"
- List of compliance checks (loaded from 'checks' file)
- Layout: 2 columns on wider viewports, 1 column on narrow viewports

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

### Checks File Structure

JSON file containing an array of check objects. Each check object has:
- `id`: Unique identifier for the check (string)
- `name`: Check title displayed in UI (string)
- `description`: Short description displayed in UI (string)
- `prompt`: Instructions for the LLM to perform this specific check (string)

Example:
```json
[
  {
    "id": "form-completeness",
    "name": "Form Completeness",
    "description": "Verify all required forms are included",
    "prompt": "Check if all mandatory SERFF forms are present in the submission..."
  }
]
```

### Request Structure

When Run button is clicked, send to OpenAI API:

**System prompt:**
- Explain the overall task: analyze uploaded documents for SERFF compliance
- Define response format: streaming JSON objects with check results, summary, and to-do list
- Instruct to process each check one by one independently and absolutely focused on it that single check every time

**User message:**
- List of checks to perform (from checks file)
- Uploaded files with their content

### Request Example

**System Prompt:**
```
You are a SERFF compliance analyzer for New Jersey insurance filings. Your task is to analyze uploaded documents and perform specific compliance checks.

RESPONSE FORMAT:
You must return newline-delimited JSON objects in this exact order:
1. One JSON object for each check: {"check": {"id": "check-id", "status": "pass|fail|warning", "summary": "brief explanation"}}
2. One summary JSON: {"summary": "overall assessment text"}
3. One todo JSON: {"todo": ["action item 1", "action item 2"]}

INSTRUCTIONS:
- Process each check one by one independently
- Focus absolutely on that single check every time
- Status must be exactly: "pass", "fail", or "warning"
- Keep summaries brief and actionable
```

**User Message:**
```
CHECKS TO PERFORM:
[
  {
    "id": "form-completeness",
    "name": "Form Completeness",
    "description": "Verify all required forms are included",
    "prompt": "Check if all mandatory SERFF forms are present in the submission. Required forms include: SERFF Tracking Form, Company Information Form, Rate Filing Form. Verify each form is complete and properly filled out."
  },
  {
    "id": "rate-accuracy",
    "name": "Rate Accuracy",
    "description": "Validate rate calculations and justifications",
    "prompt": "Review all rate calculations for mathematical accuracy. Verify that rate changes are properly justified and documented. Check that actuarial support is provided for any rate increases."
  },
  {
    "id": "documentation",
    "name": "Supporting Documentation",
    "description": "Ensure all required documentation is present",
    "prompt": "Verify that all supporting documents referenced in the forms are included. Check for actuarial memorandums, loss data, and any required certifications."
  }
]

UPLOADED FILES:
- SERFF_Tracking_Form.pdf (content: [file content])
- Company_Info.pdf (content: [file content])
- Rate_Filing.pdf (content: [file content])
- Actuarial_Memo.pdf (content: [file content])
```

### Response Structure

LLM streams separate JSON objects (newline-delimited JSON format) in this exact order:

**1. N check result JSONs** (one for each check, streamed as each completes):
```json
{"check": {"id": "form-completeness", "status": "pass", "summary": "Brief explanation"}}
{"check": {"id": "rate-accuracy", "status": "fail", "summary": "Brief explanation"}}
{"check": {"id": "documentation", "status": "warning", "summary": "Brief explanation"}}
```
- `status`: Must be exactly one of: `"pass"`, `"fail"`, or `"warning"`
- One JSON object per line
- Streamed sequentially as each check completes

**2. One summary JSON** (after all checks complete):
```json
{"summary": "Plain text overall assessment of the compliance pre-check results"}
```

**3. One todo JSON** (final object):
```json
{"todo": ["Action item 1", "Action item 2", "Action item 3"]}
```

**Total response format:**
N check JSONs + 1 summary JSON + 1 todo JSON, each on a separate line.

### UI Update Logic

- When a check result is received: immediately update the corresponding checklist item's status indicator and populate the check-specific summary
- When summary is being received: display the Summary section and stream the text into it
- When to-do is being received: display the To-Do section and stream the list items into it