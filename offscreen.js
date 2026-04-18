const audioStates = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') return false;

  if (request.action === 'checkStatus') {
    sendResponse(!!audioStates[request.tabId]);
    return true;
  }

  if (request.action === 'getVolumes') {
    const vols = {};
    for (const tid in audioStates) {
      vols[tid] = audioStates[tid].gainNode.gain.value;
    }
    sendResponse(vols);
    return true;
  }

  if (request.action === 'updateVolume') {
    if (audioStates[request.tabId]) {
      // 0.0 ~ 1.0 (100% max as requested)
      audioStates[request.tabId].gainNode.gain.value = request.volume;
    }
    sendResponse(true);
    return true;
  }

  if (request.action === 'captureAndSetVolume') {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: request.streamId
            }
          },
          video: false
        });

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const gainNode = audioCtx.createGain();
        
        gainNode.gain.value = request.volume;
        
        // パイプライン接続: タブの音 -> 音量調整 -> 最終出力
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // 管理用オブジェクトとして保存
        audioStates[request.tabId] = {
          audioCtx,
          source,
          gainNode,
          stream
        };

        // タブが閉じられたりキャプチャが停止した時の処理
        stream.getTracks().forEach(track => {
          track.onended = () => {
            if (audioStates[request.tabId]) {
              audioStates[request.tabId].audioCtx.close();
              delete audioStates[request.tabId];
            }
          };
        });

        sendResponse({ success: true });
      } catch (err) {
        console.error("Failed to capture audio:", err);
        sendResponse({ success: false });
      }
    })();
    return true; // async response
  }
});
