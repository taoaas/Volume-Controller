document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('title').textContent = "Volume Controller";

  const tabList = document.getElementById('tab-list');

  // Get the active tab first, then load all tabs
  chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
    const activeTabId = activeTabs[0] ? activeTabs[0].id : null;

    chrome.tabs.query({}, (allTabs) => {
      const webTabs = allTabs.filter(t =>
        t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
      );

      if (webTabs.length === 0) {
        tabList.innerHTML = `<div class="no-tabs">${chrome.i18n.getMessage("noTabsMsg") || "No web tabs open."}</div>`;
        return;
      }

      const hostnames = webTabs.map(t => {
        try { return new URL(t.url).hostname; } catch { return null; }
      });

      chrome.runtime.sendMessage({ target: 'background', action: 'getVolumes' }, (activeVolumes) => {
        webTabs.forEach((t, i) => {
          const hostname = hostnames[i];
          if (!hostname) return;

          const item = document.createElement('div');
          item.className = 'tab-item';
          if (t.id === activeTabId) {
            item.classList.add('current');
          }

          // Favicon
          const favicon = document.createElement('img');
          favicon.className = 'tab-favicon';
          favicon.src = t.favIconUrl || 'images/icon.png';
          favicon.onerror = () => { favicon.src = 'images/icon.png'; };

          // Info
          const info = document.createElement('div');
          info.className = 'tab-info';

          const titleRow = document.createElement('div');
          titleRow.className = 'tab-title-row';

          const title = document.createElement('div');
          title.className = 'tab-title';
          title.textContent = t.title || hostname;
          title.title = t.title || hostname;

          const badge = document.createElement('span');
          badge.className = 'tab-current-badge';
          badge.textContent = chrome.i18n.getMessage("tabCurrent") || "Current";

          titleRow.appendChild(title);
          titleRow.appendChild(badge);

          const urlText = document.createElement('div');
          urlText.className = 'tab-url-text';
          urlText.textContent = t.url;
          urlText.title = t.url;

          info.appendChild(titleRow);
          info.appendChild(urlText);

          // Controls
          const controls = document.createElement('div');
          controls.className = 'tab-controls';

          const volSlider = document.createElement('input');
          volSlider.type = 'range';
          volSlider.min = '0';
          volSlider.max = '100';

          // If tab is currently captured activeVolumes[t.id] has its float, else default to 100
          const currentVol = activeVolumes[t.id] !== undefined ? Math.round(activeVolumes[t.id] * 100) : 100;
          volSlider.value = currentVol;

          const volLabel = document.createElement('div');
          volLabel.className = 'tab-vol-label';
          volLabel.textContent = currentVol + '%';

          volSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            volLabel.textContent = val + '%';
            const volumeFloat = val / 100.0;

            // Send message to background script to use tabCapture API
            chrome.runtime.sendMessage({
              target: 'background',
              action: 'setVolume',
              tabId: t.id,
              volume: volumeFloat
            });
          });

          controls.appendChild(volSlider);
          controls.appendChild(volLabel);

          item.appendChild(favicon);
          item.appendChild(info);
          item.appendChild(controls);
          tabList.appendChild(item);
        });
      });
    });
  });
});
