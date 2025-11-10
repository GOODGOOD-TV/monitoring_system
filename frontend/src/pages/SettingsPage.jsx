import React, { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../services/settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => setSettings(await getSettings()))();
  }, []);

  if (!settings) return <div style={{ padding: 24 }}>불러오는 중…</div>;

  const s = settings;

  const onChange = (path, value) => {
    setSettings(prev => {
      const next = structuredClone(prev);
      const [a, b] = path.split(".");
      if (b) next[a][b] = value;
      else next[a] = value;
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
    alert("저장되었습니다.");
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>시스템 설정</h1>

      {/* 임계값 */}
      <Card>
        <SectionTitle>임계값 설정</SectionTitle>
        <Grid>
          <Label>온도 하한(°C)</Label>
          <Input type="number" value={s.thresholds.tempLow}
                 onChange={e=>onChange("thresholds.tempLow", Number(e.target.value))}/>
          <Label>온도 상한(°C)</Label>
          <Input type="number" value={s.thresholds.tempHigh}
                 onChange={e=>onChange("thresholds.tempHigh", Number(e.target.value))}/>
          <Label>습도 하한(%)</Label>
          <Input type="number" value={s.thresholds.humLow}
                 onChange={e=>onChange("thresholds.humLow", Number(e.target.value))}/>
          <Label>습도 상한(%)</Label>
          <Input type="number" value={s.thresholds.humHigh}
                 onChange={e=>onChange("thresholds.humHigh", Number(e.target.value))}/>
        </Grid>
      </Card>

      {/* 알림 */}
      <Card>
        <SectionTitle>알림 설정</SectionTitle>
        <Grid>
          <Label>알람 지연(분)</Label>
          <Input type="number" value={s.alert.delayMin}
                 onChange={e=>onChange("alert.delayMin", Number(e.target.value))}/>
          <Label>SMS</Label>
          <input type="checkbox" checked={s.alert.sms}
                 onChange={e=>onChange("alert.sms", e.target.checked)} />
          <Label>이메일</Label>
          <input type="checkbox" checked={s.alert.email}
                 onChange={e=>onChange("alert.email", e.target.checked)} />
          <Label>Slack</Label>
          <input type="checkbox" checked={s.alert.slack}
                 onChange={e=>onChange("alert.slack", e.target.checked)} />
        </Grid>
      </Card>

      {/* 데이터 보존기간 */}
      <Card>
        <SectionTitle>데이터 보존기간</SectionTitle>
        <Grid>
          <Label>보존기간(일)</Label>
          <select value={s.retentionDays}
                  onChange={e=>onChange("retentionDays", Number(e.target.value))}
                  style={inputStyle}>
            <option value={30}>30일</option>
            <option value={90}>90일</option>
            <option value={180}>180일</option>
            <option value={365}>365일</option>
            <option value={9999}>무제한</option>
          </select>
        </Grid>
      </Card>

      <div style={{ textAlign: "right", marginTop: 16 }}>
        <PrimaryButton onClick={onSave} disabled={saving}>
          {saving ? "저장중…" : "저장"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ------ UI helpers ------ */

function Card({ children }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 16,
      marginTop: 16
    }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{children}</h2>;
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ color: "#6b7280", fontSize: 12, alignSelf: "center" }}>{children}</div>;
}
function Input(props) {
  return <input {...props} style={inputStyle} />;
}
const inputStyle = { height: 32, padding: "0 8px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" };

function PrimaryButton({ children, ...p }) {
  return (
    <button {...p} style={{
      padding: "8px 14px",
      borderRadius: 8,
      cursor: "pointer",
      border: "1px solid #111",
      background: "#111",
      color: "#fff"
    }}>
      {children}
    </button>
  );
}
