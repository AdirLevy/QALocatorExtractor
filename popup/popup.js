document.getElementById("generate").addEventListener("click", async () => {
    const language = document.getElementById("language").value;
    const framework = document.getElementById("framework").value;
    const outputType = document.getElementById("outputType").value; // NEW
    const priorityOrder = [
        "data-testid", "id", "name", "placeholder",
        "aria-label", "for", "role", "text", "tag", "nth-child"
    ];
    const loader = document.getElementById("loader");
    loader.style.display = "block";
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content/content.js"]
        });
        chrome.tabs.sendMessage(
            tab.id,
            { action: "extractLocators", language, framework, outputType, priorityOrder, safeOnly: document.getElementById("safeOnly").checked },
            (response) => {
                loader.style.display = "none";

                const codeEl = document.querySelector("#output code");
                const langMap = { js: "javascript", python: "python", java: "java", csharp: "csharp", cpp: "clike" };
                codeEl.className = `language-${langMap[language] || "javascript"}`;

                let text = (response && response.locators) ? response.locators : "No locators found.";

                // Normalize line breaks just in case
                text = String(text).replace(/\r\n/g, "\n");

                // Use textContent so Prism gets literal \n
                codeEl.textContent = text.endsWith("\n") ? text : text + "\n";

                // Highlight exactly this block (safer in popups)
                if (window.Prism && typeof Prism.highlightElement === "function") {
                    Prism.highlightElement(codeEl);
                }
            }
        );
    } catch (err) {
        loader.style.display = "none";
        document.getElementById("output").value = "❌ Failed to inject script or connect.";
    }
});



// Fix: Correcting the event listener for the copy button to match the ID in the HTML
document.getElementById("copy").addEventListener("click", () => {
    const resultText = document.querySelector("#output code").textContent;
    if (resultText) {
        copyToClipboard(resultText);
        alert("Copied to clipboard!");
    }
});

// Function to copy text to clipboard
function copyToClipboard(text) {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
}
