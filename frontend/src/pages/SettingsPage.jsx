// src/pages/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../services/settings";
import { api, API_BASE } from "../lib/api.js";

/** 날짜 문자열을 YYYY-MM-DD 형태로 변환 */
function formatDate(value) {
  if (!value) return "-";
  // 예: "2025-11-10T15:53:26.000Z" → "2025-11-10"
  return String(value).slice(0, 10);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  // 비밀번호 변경용 상태
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  // 설정 불러오기
  useEffect(() => {
    (async () => {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (err) {
        console.error("getSettings error:", err);
        setLoadError(err.message || "설정 정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>내 계정 설정</h1>
        <p style={{ marginTop: 16, color: "#b91c1c" }}>
          설정 정보를 불러오는 중 문제가 발생했습니다: {loadError}
        </p>
      </div>
    );
  }

  if (!settings) return <div style={{ padding: 24 }}>불러오는 중…</div>;

  const s = settings;

  const onChange = (path, value) => {
    setSettings((prev) => {
      const next = structuredClone(prev);
      const [a, b] = path.split(".");
      if (b) {
        if (!next[a]) next[a] = {};
        next[a][b] = value;
      } else {
        next[a] = value;
      }
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
    alert("저장되었습니다.");
  };

  const onChangePwField = (field, value) => {
    setPasswords((prev) => ({ ...prev, [field]: value }));
    setPwMsg("");
  };

  const validatePasswordChange = () => {
    if (!passwords.current.trim()) return "현재 비밀번호를 입력해 주세요.";
    if (!passwords.next.trim()) return "새 비밀번호를 입력해 주세요.";
    if (passwords.next.length < 8) return "새 비밀번호는 8자 이상으로 설정해 주세요.";
    if (passwords.next !== passwords.confirm)
      return "새 비밀번호가 서로 일치하지 않습니다.";
    return "";
  };

  const onChangePassword = async () => {
    const v = validatePasswordChange();
    if (v) {
      setPwMsg(v);
      return;
    }

    setChangingPw(true);
    setPwMsg("");
    try {
      await api("/users/me/password", {
        method: "PATCH",
        body: {
          current_password: passwords.current,
          new_password: passwords.next,
        },
      });

      setPwMsg("비밀번호가 변경되었습니다.");
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (e) {
      console.error("change password error:", e);
      setPwMsg(e.message || "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setChangingPw(false);
    }
  };

  const formatRole = (role) => {
    if (role === "admin") return "관리자";
    if (role === "manager") return "매니저";
    if (role === "user") return "일반 사용자";
    return role || "-";
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>내 계정 설정</h1>

      {/* 프로필 + 연락처 정보 */}
      <Card>
        <SectionTitle>프로필 정보</SectionTitle>
        <Grid>
          <Label>이름</Label>
          <ReadOnlyValue>{s.profile?.name ?? "-"}</ReadOnlyValue>

          <Label>사번</Label>
          <ReadOnlyValue>{s.profile?.employee_id ?? "-"}</ReadOnlyValue>

          <Label>회사명</Label>
          <ReadOnlyValue>{s.profile?.company_name ?? "-"}</ReadOnlyValue>

          <Label>계정 생성일</Label>
          <ReadOnlyValue>{formatDate(s.profile?.created_at)}</ReadOnlyValue>

          <Label>역할</Label>
          <ReadOnlyValue>{formatRole(s.profile?.role)}</ReadOnlyValue>

          <Label>전화번호</Label>
          <Input
            value={s.contact?.phone ?? ""}
            onChange={(e) => onChange("contact.phone", e.target.value)}
            placeholder="010-0000-0000"
          />

          <Label>이메일</Label>
          <Input
            type="email"
            value={s.contact?.email ?? ""}
            onChange={(e) => onChange("contact.email", e.target.value)}
            placeholder="you@example.com"
          />
        </Grid>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          로그인 및 알림 수신에 사용되는 이메일입니다.
        </div>
        <div style={{ textAlign: "right", marginTop: 12 }}>
          <PrimaryButton onClick={onSave} disabled={saving}>
            {saving ? "저장중…" : "프로필 설정 저장"}
          </PrimaryButton>
        </div>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <SectionTitle>비밀번호 변경</SectionTitle>
        <Grid>
          <Label>현재 비밀번호</Label>
          <Input
            type="password"
            value={passwords.current}
            onChange={(e) => onChangePwField("current", e.target.value)}
          />

          <Label>새 비밀번호</Label>
          <Input
            type="password"
            value={passwords.next}
            onChange={(e) => onChangePwField("next", e.target.value)}
            placeholder="8자 이상"
          />

          <Label>새 비밀번호 확인</Label>
          <Input
            type="password"
            value={passwords.confirm}
            onChange={(e) => onChangePwField("confirm", e.target.value)}
          />
        </Grid>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          영문, 숫자, 특수문자를 포함해 8자 이상으로 설정하는 것을 권장합니다.
        </div>
        <div style={{ textAlign: "right", marginTop: 12 }}>
          <SecondaryButton onClick={onChangePassword} disabled={changingPw}>
            {changingPw ? "변경 중…" : "비밀번호 변경 저장"}
          </SecondaryButton>
        </div>
        {pwMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#111827" }}>
            {pwMsg}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------ UI helpers ------ */

function Card({ children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
      {children}
    </h2>
  );
}

function Grid({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ color: "#6b7280", fontSize: 12, alignSelf: "center" }}>
      {children}
    </div>
  );
}

function Input(props) {
  return <input {...props} style={inputStyle} />;
}

const inputStyle = {
  height: 32,
  padding: "0 8px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  background: "#fff",
};

function ReadOnlyValue({ children }) {
  return (
    <div
      style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, ...p }) {
  return (
      <button
        {...p}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          cursor: "pointer",
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
        }}
      >
        {children}
      </button>
  );
}

function SecondaryButton({ children, ...p }) {
  return (
    <button
      {...p}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        cursor: "pointer",
        border: "1px solid #e5e7eb",
        background: "#fff",
        color: "#111",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
