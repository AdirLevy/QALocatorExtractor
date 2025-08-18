(() => {
    if (window.hasLocatorListener) return; // stop if already injected
    window.hasLocatorListener = true;

    console.log("[Locator Extractor] Content script loaded.");

    chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        if (message.action === "extractLocators") {
            const locators = extractLocators(
                message.language,
                message.framework,
                message.priorityOrder,
                message.outputType,
                message.safeOnly // pass safeOnly flag
            );
            sendResponse({ locators });
        }
        return true;
    });

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
            if (!el || !el.textContent) return null;
            const text = el.textContent.trim();

            // Skip if too long or multi-line
            if (text.length > 50) return null;
            if (text.split(/\r?\n/).length > 1) return null;

            // Skip if it’s only numbers/symbols
            if (!/[a-zA-Z]/.test(text)) return null;

            const tag = el.tagName.toLowerCase();
            const safeText = text.replace(/"/g, '\\"');

            // Prefer cy.contains() for clickable/heading elements
            if (["a", "button", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
                return `${tag}:contains("${safeText}")`;
            }

            return null;
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

    function extractLocators(language, framework, priorityOrder, outputType, safeOnly = false) {
        Object.keys(nameCounter).forEach(key => delete nameCounter[key]);
        const elements = document.querySelectorAll("*");
        const locators = [];

        elements.forEach(el => {
            if (shouldSkipElement(el)) return;

            const selector = getBestUniqueSelector(el, priorityOrder, safeOnly);
            if (!selector) return;

            const rawName = getVariableName(el);
            if (!rawName) return;

            const variableName = getUniqueName(rawName);
            const locatorCode = formatLocator(variableName, selector, language, framework, outputType);

            if (locatorCode) {
                const priorityRank = getSelectorPriority(selector, priorityOrder);
                locators.push({ code: locatorCode, rank: priorityRank });
            }
        });

        // Sort by priority rank (lower number = better)
        locators.sort((a, b) => a.rank - b.rank);

        return locators.length ? locators.map(l => l.code).join("\n") : "No valid locators found.";
    }

    function getSelectorPriority(selector, priorityOrder) {
        for (let i = 0; i < priorityOrder.length; i++) {
            if (selector.includes(priorityOrder[i])) {
                return i;
            }
        }
        return priorityOrder.length;
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

    function getBestUniqueSelector(el, priorityOrder, safeOnly = false) {
        for (const key of priorityOrder) {
            const strategy = allStrategies[key];
            if (!strategy) continue;

            const selector = strategy(el);
            if (selector && isUnique(selector)) return selector;
        }

        // ✅ Short, stable text (cy.contains)
        const text = el.textContent?.trim();
        if (text && text.length > 2 && text.length <= 50 && !/\r?\n/.test(text) && /[a-zA-Z]/.test(text)) {
            const tag = el.tagName.toLowerCase();
            return `${tag}:contains("${text.replace(/"/g, '\\"')}")`;
        }

        if (safeOnly) {
            // If safeOnly is ON, skip nth-of-type and XPath
            return null;
        }

        // ✅ nth-of-type fallback
        if (el.parentElement) {
            const tag = el.tagName.toLowerCase();
            const siblings = Array.from(el.parentElement.querySelectorAll(tag));
            const index = siblings.indexOf(el) + 1;
            const fallbackSelector = `${tag}:nth-of-type(${index})`;
            if (isUnique(fallbackSelector)) return fallbackSelector;
        }

        // 🛑 Final fallback — XPath
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
            let text = el.textContent.replace(/[-:,.\/]/g, " ").trim();
            // Limit to first 4 words max
            let words = text.split(/\s+/).slice(0, 4).join(" ");
            // Limit total length to avoid absurdly long variable names
            if (words.length > 30) {
                words = words.substring(0, 30);
            }
            baseName = words;
        } else {
            return null;
        }

        if (/^\d/.test(baseName)) {
            let match = baseName.match(/\.[a-z0-9]+$/i);
            let extension = match ? match[0].slice(1) : "";  // remove the dot
            let capitalizedExtension = extension.charAt(0).toUpperCase() + extension.slice(1).toLowerCase();
            baseName = "random" + capitalizedExtension + "File";
        }
        // Remove file extensions
        baseName = baseName.replace(/\.[a-z0-9]+$/i, "");
        baseName = toCamelCase(baseName);

        switch (el.tagName) {
            case "BUTTON": return baseName + "Button";
            case "INPUT":
                if (["text", "email", "password"].includes(el.type)) return baseName + "Field";
                if (el.type === "checkbox" && !baseName.toLowerCase().includes("checkbox")) return baseName + "Checkbox";
                if (el.type === "radio" && !baseName.toLowerCase().includes("radio")) return baseName + "Radio";
                if (el.type === "submit" && !baseName.toLowerCase().includes("button")) return baseName + "Button";
                if (baseName.toLowerCase().includes("button") || baseName.toLowerCase().includes("input") || baseName.toLowerCase().includes("field")) return baseName;
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

    function quoteSingle(str) {
        // Wrap in single quotes and escape inner ' and backslashes
        return `'${String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }

    function escapeForDoubleQuotes(str) {
        // For languages that use "string" literals (Java, Python, C#, C++): escape inner "
        return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function escapeForSingleQuotes(str) {
        // For JS selectors in cy.get()/page.locator(): escape inner '
        return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function formatLocator(variableName, selector, language, framework, outputType) {
        // Detect :contains("...") and extract the inner text if present
        const isContainsSelector = selector.includes(':contains(');
        const containsText = isContainsSelector
            ? (selector.match(/:contains\("(.+?)"\)/)?.[1] ?? "")
            : "";

        // Pre-escaped variants for different quote styles
        const selForSingle = escapeForSingleQuotes(selector);     // for JS: '...'
        const selForDouble = escapeForDoubleQuotes(selector);     // for Java/Python/etc: "..."

        // Framework-specific calls
        const frameworks = {
            // Keep contains() text in double quotes (cleanest for human text)
            cypress: () => isContainsSelector
                ? `cy.contains("${escapeForDoubleQuotes(containsText)}")`
                : `cy.get('${selForSingle}')`,

            // Playwright prefers single quotes around the selector string in JS
            playwright: () => `page.locator('${selForSingle}')`,

            // Selenium (JS users typically not here, but keeping escapes sane for other langs)
            selenium: () => `driver.findElement(By.cssSelector("${selForDouble}"))`
        };

        // Language wrappers
        const languages = {
            // JS: const foo = cy.get('...'); or cy.contains("...")
            js: () => `const ${variableName} = ${frameworks[framework]()};`,

            // Python (legacy style kept, but escapes fixed)
            python: () => `${variableName} = self.driver.find_element_by_css_selector("${selForDouble}")`,

            // Java
            java: () => `WebElement ${variableName} = driver.findElement(By.cssSelector("${selForDouble}"));`,

            // C#
            csharp: () => `var ${variableName} = Driver.FindElement(By.CssSelector("${selForDouble}"));`,

            // C++
            cpp: () => `WebElement ${variableName} = driver->FindElement(By::cssSelector("${selForDouble}"));`
        };

        // Plain “String” output mode (variable = 'selector')
        if (outputType === "string") {
            // Always single-quote the selector, escape inner single quotes only
            return `${variableName} = ${quoteSingle(selector)}`;
        }

        // Default
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
        if (!str) return "";
        // 1) Normalize separators to spaces (but keep capitals so we can split on them)
        const cleaned = String(str).replace(/[^a-zA-Z0-9]+/g, " ").trim();
        if (!cleaned) return "";

        // 2) Split on capital boundaries and spaces/underscores
        //    e.g. "VerifiedUser" -> ["Verified","User"], "menu-open" -> ["menu","open"]
        const parts = cleaned.split(/(?=[A-Z])|\s+|_/).filter(Boolean);

        // 3) Lowercase then camelize
        return parts
            .map((p, i) => {
                const lower = p.toLowerCase();
                return i === 0 ? lower : lower[0].toUpperCase() + lower.slice(1);
            })
            .join("");
    }

})();