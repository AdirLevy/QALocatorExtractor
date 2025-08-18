Locator Extractor – Chrome Extension

A Chrome extension for automatically extracting unique UI element locators from any web page for use in Cypress, Selenium, Playwright, and multiple programming languages.
The extension intelligently prioritizes stable attributes (like data-testid, id, name, aria-label) before falling back to short, human-readable text locators (cy.contains()) and finally structural selectors like nth-child or XPath.


Features:

- Frameworks: Cypress, Selenium, Playwright
- Languages: JavaScript, Python, Java, C#, C++
- Multiple Locator Strategies: data-testid, id, name, placeholder, aria-label, role, for
- Short, stable text locators with cy.contains() support
- Structural locators like nth-child and XPath (last resort)
- Locator Prioritization – Choose which strategies to try first
- Smart Filtering – Avoids:
- - Very long text blocks
- - Multi-line text
- - Elements with only numbers/symbols
- One-Click Copy – Copy generated locators to clipboard
- Popup UI with syntax highlighting


Installation

1. Clone or download this repository: git clone https://github.com/AdirLevy/QALocatorExtractor
2. Open Google Chrome and go to: chrome://extensions
3. Enable Developer Mode (top right).
4. Click Load unpacked and select the extension folder.

The extension icon will now appear in your Chrome toolbar, ready to use.



Usage

- Navigate to any web page.
- Click the Locator Extractor icon in your Chrome toolbar.

- Choose:
- - Programming language (JS, Python, Java, C#, C++)
- - Framework (Cypress, Selenium, Playwright)
- - Output Type (code snippet or raw selector string)
- Click Extract Locators.
- Review the list in the popup — copy and paste into your tests.
- Locator Strategy
- Locators are extracted in this priority order by default:
- - data-testid
- - id
- - name
- - placeholder
- - aria-label
- - role
- - for
- - Short, stable text (cy.contains())
- - nth-child
- - XPath (last resort)
- - Smart Text Filtering

- Text locators (cy.contains("...")) are only generated if:
- - Text length is between 2 and 50 characters
- - Text is single-line
- - Text contains at least one letter
- - No pure numbers/symbols
- - This prevents unwanted massive strings like:
- - cy.contains("ISTQB AI Testing Certification Register for ISTQB Exams ...")
- - and instead produces: cy.contains("AI Testing Certification")




Development

Folder Structure

extension/
│── manifest.json       # Chrome extension manifest
│── popup.html          # Popup UI HTML
│── popup.js            # Popup logic
│── popup.css           # Popup styles
│── content.js          # Locator extraction logic (runs in page context)
│── icons/              # Extension icons



Main Logic (content.js)

Runs in the context of the current tab
Iterates through all DOM elements
Uses priorityOrder to decide which strategy to try first
Calls formatLocator() to generate language/framework-specific code
Customizing
Change Priority Order


Edit priorityOrder in your popup.js:

const defaultPriorityOrder = [
  "data-testid",
  "id",
  "name",
  "placeholder",
  "aria-label",
  "role",
  "for",
  "text",
  "nth-child"
];



Change Text Filter Rules

In content.js inside allStrategies.text and getBestUniqueSelector:

Adjust max length from 50 to another number
Allow/disallow multi-line text
Change allowed characters
Planned Enhancements
 Add keyboard shortcut for quick extraction
 Save settings in Chrome storage
 Export locators directly to JSON or .spec.js file
 Option to include img[alt="..."] for images



License

MIT License — free to use, modify, and distribute.