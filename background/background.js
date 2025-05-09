const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "copyText") {
        navigator.clipboard.writeText(request.text).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            console.error("Clipboard write failed:", err);
            sendResponse({ success: false });
        });
        return true; // Required to use async sendResponse
    }
});
