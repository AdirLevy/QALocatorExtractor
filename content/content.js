if (!window.hasLocatorListener) {
    console.log("[Locator Extractor] Content script loaded.");
    window.hasLocatorListener = true;

    chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        if (message.action === "extractLocators") {
            const locators = extractLocators(message.language, message.framework, message.priorityOrder);
            sendResponse({ locators });
        }
        return true;
    });
}

// ---------------------------------- Main Locator Priority/Strategy ----------------------------------


const allStrategies = {
    "data-testid": el => el.getAttribute("data-testid") && `[data-testid="${el.getAttribute("data-testid")}"]`,
    id: el => el.id && `#${el.id}`,
    name: el => el.name && `[name="${el.name}"]`,
    placeholder: el => el.placeholder && `[placeholder="${el.placeholder}"]`,
    "aria-label": el => el.getAttribute("aria-label") && `[aria-label="${el.getAttribute("aria-label")}"]`,
    role: el => el.getAttribute("role") && `[role="${el.getAttribute("role")}"]`,
    for: el => el.getAttribute("for") && `[for="${el.getAttribute("for")}"]`,
    // text: el => {
    //     const text = el.textContent?.trim();
    //     return text && text.length > 2 ? `${el.tagName.toLowerCase()}:contains("${text}")` : null;
    // },
    text: el => {
        const text = el.textContent?.trim();
        if (!text || text.length < 3) return null;

        const tag = el.tagName.toLowerCase();
        const safeText = text.replace(/"/g, '\\"');
        return `${tag}:contains("${safeText}")`; // or `cy.contains("${safeText}")`
    },
    tag: el => el.tagName.toLowerCase(),
    "nth-child": el => {
        if (!el.parentElement) return null;
        const siblings = Array.from(el.parentElement.children);
        const index = siblings.indexOf(el) + 1;
        return `${el.tagName.toLowerCase()}:nth-child(${index})`;
    }
};


// ---------------------------------- Main Locator Funtion ----------------------------------

function extractLocators(language, framework, priorityOrder) {
    Object.keys(nameCounter).forEach(key => delete nameCounter[key]);
    const elements = document.querySelectorAll("*");
    const locators = [];

    elements.forEach(el => {
        if (shouldSkipElement(el)) return;

        const selector = getBestUniqueSelector(el, priorityOrder);
        if (!selector) return;

        const rawName = getVariableName(el);
        if (!rawName) return;

        const variableName = getUniqueName(rawName);
        const locatorCode = formatLocator(variableName, selector, language, framework);

        if (locatorCode) {
            console.log(`[EXTRACTED] ${variableName} -> ${selector}`);
            locators.push(locatorCode);
        }
    });

    return locators.length ? locators.join("\n") : "No valid locators found.";
}

// ---------------------------------- Sub-Main Funtions ----------------------------------

function shouldSkipElement(el) {
    const ignoredTags = [
        "SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD", "IFRAME",
        "SVG", "PATH", "NOSCRIPT", "G", "CANVAS", "IMG"
    ];

    const interactableTags = [
        "BUTTON", "INPUT", "TEXTAREA", "SELECT", "LABEL",
        "A", "H1", "H2", "H3", "H4", "H5", "H6"
    ];

    const isBlacklisted = ignoredTags.includes(el.tagName);
    const isUseful =
        interactableTags.includes(el.tagName) ||
        el.getAttribute("data-testid") ||
        el.id || el.name || el.placeholder ||
        el.getAttribute("aria-label") || el.getAttribute("role") || el.getAttribute("for") ||
        el.getAttribute("tabindex") !== null;

    const isHidden = el.offsetParent === null;
    const isZeroSize = el.offsetWidth === 0 && el.offsetHeight === 0;

    return isBlacklisted || isHidden || isZeroSize || !isUseful;
}

const nameCounter = {};

function getUniqueName(base) {
    if (!nameCounter[base]) {
        nameCounter[base] = 1;
        return base;
    }
    return `${base}${++nameCounter[base]}`;
}

// function getBestUniqueSelector(el, priorityOrder) {
//     for (const key of priorityOrder) {
//         const strategy = allStrategies[key];
//         if (!strategy) continue;

//         const selector = strategy(el);
//         if (selector && isUnique(selector)) return selector;
//     }

//     // Use text + nth-of-type as readable fallback
//     if (el.textContent?.trim()) {
//         const tag = el.tagName.toLowerCase();
//         const siblings = Array.from(el.parentNode.querySelectorAll(tag));
//         const index = siblings.indexOf(el) + 1;
//         const fallbackSelector = `${tag}:nth-of-type(${index})`;

//         if (isUnique(fallbackSelector)) return fallbackSelector;
//     }

//     return generateXPath(el); // Absolute last resort
// }

function getBestUniqueSelector(el, priorityOrder) {
    for (const key of priorityOrder) {
        const strategy = allStrategies[key];
        if (!strategy) continue;

        const selector = strategy(el);
        if (selector && isUnique(selector)) return selector;
    }

    // ✅ Prefer `:contains("...")` if element has readable text
    const text = el.textContent?.trim();
    if (text && text.length > 2) {
        const tag = el.tagName.toLowerCase();
        const containsSelector = `${tag}:contains("${text.replace(/"/g, '\\"')}")`;

        // ✅ Do not check uniqueness — cy.contains handles it at runtime
        return containsSelector;
    }

    // ✅ As a last-resort, use nth-of-type if parent/sibling info exists
    if (el.parentElement) {
        const tag = el.tagName.toLowerCase();
        const siblings = Array.from(el.parentElement.querySelectorAll(tag));
        const index = siblings.indexOf(el) + 1;
        const fallbackSelector = `${tag}:nth-of-type(${index})`;
        if (isUnique(fallbackSelector)) return fallbackSelector;
    }

    // 🛑 Final fallback — XPath (only if nothing better)
    return generateXPath(el);
}

function isUnique(selector) {
    try {
        return document.querySelectorAll(selector).length === 1;
    } catch {
        return false;
    }
}

function getVariableName(el) {
    let baseName = "element";

    if (el.getAttribute("data-testid")) baseName = el.getAttribute("data-testid");
    else if (el.id) baseName = el.id;
    else if (el.name) baseName = el.name;
    else if (el.placeholder) baseName = el.placeholder.split(" ")[0];
    else if (el.getAttribute("aria-label")) baseName = el.getAttribute("aria-label").split(" ")[0];
    else if (el.textContent && el.textContent.trim().length > 0) {
        // baseName = el.textContent.trim().split(/\s+/).slice(0, 3).join("");
        baseName = toCamelCase(baseName);
    } else {
        return null;
    }

    // baseName = baseName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    baseName = toCamelCase(baseName);

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
        case "H3":
        case "H4":
        case "H5":
        case "H6": return baseName + "Heading";
        case "SPAN": return baseName + "Text";
        default: return baseName;
    }
}

function formatLocator(variableName, selector, language, framework) {
    const isContainsSelector = selector.includes(":contains(");
    const cleanText = selector.match(/:contains\("(.+?)"\)/)?.[1];
    
    const frameworks = {
        // cypress: () => `cy.get("${selector}")`,
        cypress: () => isContainsSelector
            ? `cy.contains("${cleanText}")`
            : `cy.get("${selector}")`,
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

function generateXPath(el) {
    if (!el) return null;
    let path = "";
    while (el.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = el.previousSibling;
        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === el.tagName) {
                index++;
            }
            sibling = sibling.previousSibling;
        }
        path = `/${el.tagName.toLowerCase()}[${index}]${path}`;
        el = el.parentNode;
    }
    return path ? path : null;
}

function toCamelCase(str) {
    return str
        .toLowerCase()
        .replace(/[^a-zA-Z0-9 ]/g, " ")
        .split(/[\s_]+/)
        .map((word, i) => (i === 0 ? word : word[0]?.toUpperCase() + word.slice(1)))
        .join("");
}
