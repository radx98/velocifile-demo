# NJ SERFF compliance pre-check app

## Layout

Minimalistic white background page. Helvetica and other sans-serif fonts as a replacement. Text color neutral-800. Minimal rounding on visible block elements. The width of the content on the page is w-4xl.

### Header

Title: SERFF Compliance Pre-Check
Subtitle: New-Jersey

### Upload Fields

4 rectangular (4:3) upload fields in 2x2 grid (or 1:4 if the viewport can't fit them). Lucide 'file-up' icon in each of them followed by the text 'drop files here'. Following titles above them:

* Forms
* Rate/Rule
* Supporting Documentation
* Correspondence

Upload happens on drop right away. Files appear inside the upload fields when they're uploaded. They have green Lucide 'check' icon next to them. If the list of the files doesnt fit into the upload field, the list can be scrolled.

### Run Button

Green centered button with 'Run SERFF compliance pre-check' text on it. When press sends a request to an LLM via OpenAI API. The request contains:

* All the files separated into 4 categories.
* System prompt, explaining the task and setting the structure of the input and output.
* System prompt appendages from a separate 'checks' file, listing all the checks that need to be passed and instructions for them.

### Checklist

H3 'Checklist' title.

List of checks that user files need to pass (stored in 'checks' file). The list is arranged in 2 columns or 1 if the viewport gets too narrow (same as upload fields).

Each of the items has:
* Title and a state indicator that appears after the Run button is pressed
    * Processing icon (neutral-800 spinning Lucide 'loader-circle')
    * Success/pass (lime-700 Lucide 'check')
    * Fail (red-700 Lucide 'x')
    * Warning (amber-700 'triangle-alert')
* Short description
* Short check-specific summary

### Summary & To-Do

After all checks completed, plain text summary with h3 'Summary' title is shown. It's followed be h3 'To-Do' title and a list of things that are still need to be done in to complete the compliance pre-check.

## Data Handling

...