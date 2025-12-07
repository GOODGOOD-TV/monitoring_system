import { useMemo, useState } from "react";

const API_BASE = import.meta?.env?.VITE_API_BASE || "";
const AFTER_SIGNUP_PATH = "/login";           // 가입 성공 후 로그인 화면으로

export default function RegisterPage() {
  const [form, setForm] = useState({
    company_name: "",
    employee_id: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const api = useMemo(() => {
    return async function api(path, { method = "GET", body, headers = {} } = {}) {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      return json;
    };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const validate = () => {
    if (!form.company_name.trim()) return "기업 코드를 입력해 주세요.";
    if (!form.employee_id.trim()) return "사원번호를 입력해 주세요.";
    if (!form.name.trim()) return "이름을 입력해 주세요.";
    if (!form.email.trim()) return "이메일을 입력해 주세요.";
    if (!form.password) return "비밀번호를 입력해 주세요.";
    if (form.password.length < 8) return "비밀번호는 8자 이상으로 설정해 주세요.";
    if (form.password !== form.confirm) return "비밀번호가 일치하지 않습니다.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setMsg(v); return; }

    setLoading(true);
    setMsg("");
    try {
      // 백엔드에 맞게 엔드포인트 수정 가능: /api/v1/auth/register (권장)
      const body = {
        "company_name": form.company_name,
        "employee_id": form.employee_id,
        "name": form.name,
        "phone": form.phone,
        "email": form.email,
        "password": form.password
      };

      await api("/auth/register", { method: "POST", body });

      setMsg("회원가입 완료! 로그인 화면으로 이동합니다.");
      setTimeout(() => window.location.assign(AFTER_SIGNUP_PATH), 700);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={titleArea}>
        <div style={title}>SIGN UP</div>
        <div style={subtitle}>계정을 생성해 주세요</div>
      </div>

      <form onSubmit={handleSubmit} style={{ width: 420 }}>
        <div style={grid2}>
          <div>
            <label style={label}>기업 이름</label>
            <input name="company_name" value={form.company_name} onChange={onChange} style={input} />
          </div>
          <div>
            <label style={label}>사원번호</label>
            <input name="employee_id" value={form.employee_id} onChange={onChange} style={input} />
          </div>
        </div>

        <div style={grid2}>
          <div>
            <label style={label}>이름</label>
            <input name="name" value={form.name} onChange={onChange} style={input} />
          </div>
          <div>
            <label style={label}>전화번호</label>
            <input name="phone" value={form.phone} onChange={onChange} style={input} placeholder="010-1234-5678" />
          </div>
        </div>

        <div>
          <label style={label}>이메일</label>
          <input name="email" type="email" value={form.email} onChange={onChange} style={input} placeholder="you@example.com" />
        </div>

        <div style={grid2}>
          <div>
            <label style={label}>비밀번호</label>
            <input name="password" type="password" value={form.password} onChange={onChange} style={input} placeholder="8자 이상" />
          </div>
          <div>
            <label style={label}>비밀번호 확인</label>
            <input name="confirm" type="password" value={form.confirm} onChange={onChange} style={input} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="submit" disabled={loading} style={mainBtn}>{loading ? "..." : "회원가입"}</button>
          <button type="button" style={subBtn} onClick={() => window.location.assign("/login")}>로그인으로</button>
        </div>

        {msg && <p style={{ marginTop: 10, fontSize: 13 }}>{msg}</p>}
      </form>
    </div>
  );
}

/* styles */
const wrap = { minHeight: "100vh", padding: 24, background: "#fff" };
const titleArea = { marginBottom: 16 };
const title = { fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" };
const subtitle = { marginTop: 4, fontSize: 12, color: "#71717a" };
const label = { display: "block", fontSize: 12, color: "#374151", marginBottom: 6 };
const input = { width: "100%", border: "1px solid #d4d4d8", borderRadius: 6, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };
const mainBtn = { borderRadius: 6, background: "#111827", color: "#fff", padding: "10px 16px", fontSize: 13, border: "none", cursor: "pointer" };
const subBtn  = { borderRadius: 6, background: "#e5e7eb", color: "#111827", padding: "10px 16px", fontSize: 13, border: "none", cursor: "pointer" };
