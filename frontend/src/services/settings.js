// src/services/settings.js
// 실제 API 붙이기 전까지 사용할 임시 저장소 (fetch로 쉽게 교체 가능)

let SETTINGS = {
    thresholds: { tempLow: 18, tempHigh: 28, humLow: 35, humHigh: 65 },
    alert: { delayMin: 5, sms: true, email: false, slack: false },
    retentionDays: 90, // 데이터 보존기간(일)
  };
  
  export async function getSettings() {
    // 서버가 있다면: return (await fetch('/api/settings')).json();
    return structuredClone(SETTINGS);
  }
  
  export async function saveSettings(next) {
    // 서버가 있다면: await fetch('/api/settings', { method:'POST', body: JSON.stringify(next) });
    SETTINGS = structuredClone(next);
    return true;
  }
  