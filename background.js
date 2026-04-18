let creating; // A global promise to avoid concurrency issues

async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Volume control via tabCapture API',
    });
    await creating;
    creating = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target === 'background') {
    if (request.action === 'getVolumes') {
      (async () => {
        try {
          await setupOffscreenDocument();
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'getVolumes' }, (vols) => {
            sendResponse(vols || {});
          });
        } catch (e) {
          sendResponse({});
        }
      })();
      return true;
    }

    if (request.action === 'setVolume') {
    (async () => {
      try {
        await setupOffscreenDocument();

        // Check if offscreen already has this tab captured
        const isCaptured = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'checkStatus', tabId: request.tabId }, resolve);
        });

        if (isCaptured) {
          // Simply update the volume
          chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'updateVolume',
            tabId: request.tabId,
            volume: request.volume
          });
          sendResponse({ success: true });
        } else {
          // We need to capture the tab first (Requires getMediaStreamId)
          chrome.tabCapture.getMediaStreamId({ targetTabId: request.tabId }, async (streamId) => {
            if (!streamId || chrome.runtime.lastError) {
              console.warn("Could not capture tab:", chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError });
              return;
            }

            // Tell offscreen doc to capture stream and apply volume
            chrome.runtime.sendMessage({
              target: 'offscreen',
              action: 'captureAndSetVolume',
              tabId: request.tabId,
              streamId: streamId,
              volume: request.volume
            }, () => {
              sendResponse({ success: true });
            });
          });
        }
      } catch (e) {
        console.error(e);
        sendResponse({ success: false });
      }
    })();
    return true; // async response
    }
  }
});
