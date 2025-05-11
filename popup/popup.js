document.getElementById("generate").addEventListener("click", async () => {
    const language = document.getElementById("language").value;
    const framework = document.getElementById("framework").value;
    const priorityOrder = [
        "data-testid", "id", "name", "placeholder",
        "aria-label", "for", "role", "text", "tag", "nth-child"
    ];

    const loader = document.getElementById("loader");
    loader.style.display = "block";

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // First inject the content script if it's not already there
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content/content.js"]
        });

        // Send message to the injected script
        chrome.tabs.sendMessage(
            tab.id,
            { action: "extractLocators", language, framework, priorityOrder },
            (response) => {
                loader.style.display = "none";

                if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError.message);
                    document.getElementById("output").value = "❌ Error: Could not connect to the tab.";
                    return;
                }

                document.getElementById("output").value = response?.locators || "No locators found.";
            }
        );
    } catch (err) {
        loader.style.display = "none";
        console.error("Script injection or messaging failed:", err);
        document.getElementById("output").value = "❌ Failed to inject script or connect.";
    }
});



// Fix: Correcting the event listener for the copy button to match the ID in the HTML
document.getElementById("copy").addEventListener("click", () => {
    const resultText = document.getElementById("output").value;
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
