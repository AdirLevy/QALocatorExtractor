// Only register the listener once
if (!window.hasLocatorListener) {
    console.log("[Locator Extractor] Content script loaded.");
    window.hasLocatorListener = true;

    chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        console.log("[Locator Extractor] Received message:", message);
        if (message.action === "extractLocators") {
            const locators = extractLocators(message.language, message.framework, message.priorityOrder);
            console.log("[Locator Extractor] Sending locators:", locators);
            sendResponse({ locators });
        }
        return true; // Needed for async sendResponse (even though we're not using it here)
    });
}

const allStrategies = {
    "data-testid": el => el.getAttribute("data-testid") && `[data-testid="${el.getAttribute("data-testid")}"]`,
    id: el => el.id && `#${el.id}`,
    name: el => el.name && `[name='${el.name}']`,
    class: el => el.className && `.${el.className.trim().split(/\s+/).join('.')}`,
    tag: el => el.tagName.toLowerCase(),
    text: el => {
        const text = el.textContent?.trim();
        return text ? `text()='${text}'` : null;
    },
    attribute: el => {
        for (const attr of ["data-test", "aria-label", "placeholder", "role", "type"]) {
            if (el.hasAttribute(attr)) return `[${attr}="${el.getAttribute(attr)}"]`;
        }
        return null;
    }
};

function extractLocators(language, framework, priorityOrder) {
    console.log("[Locator Extractor] Running extractLocators...");
    const elements = document.querySelectorAll("*");
    const strategies = priorityOrder
        .map(type => ({
            name: type,
            getLocator: allStrategies[type]
        }))
        .filter(s => typeof s.getLocator === "function");

    const locators = [];

    elements.forEach(el => {
        let selector;
        for (const strat of strategies) {
            selector = strat.getLocator(el);
            if (selector) {
                console.log(`[Found] ${strat.name}: ${selector}`);
                break;
            }
        }

        if (!selector) return;

        const variableName = getVariableName(el);
        const locatorCode = formatLocator(variableName, selector, language, framework);
        if (locatorCode) locators.push(locatorCode);
    });

    console.log(`[Locator Extractor] Found ${locators.length} locators.`);
    return locators.length ? locators.join("\n") : "No valid locators found.";
}

function getVariableName(el) {
    let baseName = "element";

    if (el.hasAttribute("data-testid")) baseName = el.getAttribute("data-testid").replace(/[-_]/g, "");
    else if (el.id) baseName = el.id.replace(/[-_]/g, "");
    else if (el.name) baseName = el.name.replace(/[-_]/g, "");
    else if (el.placeholder) baseName = el.placeholder.split(" ")[0].toLowerCase();
    else if (el.type) baseName = el.type;

    switch (el.tagName) {
        case "BUTTON": return baseName + "Button";
        case "INPUT":
            if (["text", "email", "password"].includes(el.type)) return baseName + "Field";
            if (el.type === "checkbox") return baseName + "Checkbox";
            if (el.type === "radio") return baseName + "Radio";
            return baseName + "Input";
        case "TEXTAREA": return baseName + "Textarea";
        case "SELECT": return baseName + "Dropdown";
        case "A": return baseName + "Link";
        case "LABEL": return baseName + "Label";
        case "H1":
        case "H2":
        case "H3": return baseName + "Heading";
        case "TABLE": return baseName + "Table";
        default: return baseName;
    }
}

function formatLocator(variableName, selector, language, framework) {
    if (!selector) return null;

    const frameworks = {
        cypress: () => `cy.get("${selector}")`,
        selenium: () => `driver.findElement(By.cssSelector("${selector}"))`,
        playwright: () => `page.locator("${selector}")`
    };

    const languages = {
        js: () => `const ${variableName} = ${frameworks[framework]()};`,
        python: () => `${variableName} = self.driver.find_element_by_css_selector("${selector}")`,
        java: () => `WebElement ${variableName} = driver.findElement(By.cssSelector("${selector}"));`,
        csharp: () => `var ${variableName} = Driver.FindElement(By.CssSelector("${selector}"));`,
        cpp: () => `WebElement ${variableName} = driver->FindElement(By::cssSelector("${selector}"));`
    };

    return languages[language]?.();
}
