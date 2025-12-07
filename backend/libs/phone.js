// backend/libs/phone.js

export function toE164Korean(input) {
  if (typeof input !== "string") {
    throw new Error("전화번호 형식이 올바르지 않습니다.");
  }

  const trimmed = input.trim();

  // 1) 이미 +로 시작하는 경우 (+8210xxxx 형식만 허용)
  if (trimmed.startsWith("+")) {
    const cleaned = trimmed.replace(/[^\d+]/g, ""); // +랑 숫자만 남김, 예: "+821012345678"

    // +82로 시작하는지만 먼저 확인
    if (!cleaned.startsWith("+82")) {
      throw new Error("한국 휴대폰 번호(+8210xxxxxxxx)만 사용할 수 있습니다.");
    }

    // '+' 뺀 숫자 부분
    const digits = cleaned.replace("+", ""); // "821012345678" 같은 형태

    // 한국 010 휴대폰: 82 + 10 + 8자리 = 총 12자리
    if (!/^8210\d{8}$/.test(digits)) {
      throw new Error("전화번호 형식이 올바르지 않습니다.(예: 010-1234-5678)");
    }

    return "+82" + digits.slice(2); // "+8210XXXXXXXX"
  }

  // 2) 로컬 포맷 (010-xxxx-xxxx / 010xxxxxxxx)
  const digits = trimmed.replace(/\D/g, ""); // 숫자만

  // 010 + 8자리 (총 11자리)
  if (!/^010\d{8}$/.test(digits)) {
    throw new Error("전화번호 형식이 올바르지 않습니다.(예: 010-1234-5678)");
  }

  // 01012345678 → +821012345678
  return "+82" + digits.slice(1);
}
