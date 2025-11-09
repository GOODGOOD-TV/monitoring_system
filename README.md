# Monitoring System (Sentory)

산업 데이터 모니터링 및 예측 플랫폼 **Sentory**의 전체 프로젝트입니다.  
이 레포는 **백엔드(Express + MariaDB)** 와 **프론트엔드(React/Vite)** 를 함께 관리합니다.

---

## 🏗️ 프로젝트 개요
Sentory는 공장, 설비, 센서 등에서 발생하는 데이터를 수집하고  
AI 기반 분석으로 이상 징후를 조기에 감지하는 시스템입니다.  
직관적인 웹 대시보드를 통해 데이터를 시각화하고,  
예측 결과를 실시간으로 모니터링할 수 있습니다.

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React, Vite, Axios, Chart.js |
| **Backend** | Node.js (Express), JWT, Bcrypt |
| **Database** | MariaDB (Docker Compose) |
| **Infra** | Docker, GitHub Actions, .env 환경변수 |
| **Version Control** | Git / GitHub |

---

## ⚙️ 설치 및 실행

### 1. 클론 및 초기화
```bash
git clone https://github.com/GOODGOOD-TV/monitoring_system.git
cd monitoring_system
```

### 2. 환경 변수 설정
`backend/.env.sample`을 참고해 `backend/.env` 파일을 생성합니다:
```bash
cp backend/.env.sample backend/.env
```

### 3. 데이터베이스 실행
```bash
docker compose up -d
```

### 4. 백엔드 실행
```bash
cd backend
npm ci
npm run dev
```
서버: [http://localhost:3000](http://localhost:3000)

### 5. 프론트엔드 실행
```bash
cd ../frontend
npm ci
npm run dev
```
클라이언트: [http://localhost:5173](http://localhost:5173)

---

## 📁 폴더 구조
```
monitoring_system/
 ├─ backend/
 │   ├─ server.js
 │   ├─ routes/
 │   ├─ controllers/
 │   ├─ db.js
 │   ├─ middlewares/
 │   ├─ utils/
 │   └─ .env.sample
 │
 ├─ frontend/
 │   ├─ src/
 │   ├─ public/
 │   ├─ vite.config.js
 │   └─ package.json
 │
 ├─ docker-compose.yml
 ├─ README.md
 └─ .gitignore
```

---

## 🧩 주요 스크립트
| 명령어 | 설명 |
|---------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm start` | 프로덕션 실행 |
| `npm run lint` | 코드 검사 (eslint) |
| `npm run format` | 코드 정리 (prettier) |
| `npm test` | 테스트 실행 |

---

## 🧑‍🤝‍🧑 팀 구성
| 이름 | 역할 | 담당 |
|------|------|------|
| 김선한 | 백엔드 / DB | Express, MariaDB, 인증 |
| 팀원 A | 프론트엔드 | React, 대시보드 UI |
| 팀원 B | AI 분석 | 데이터 수집, 예측 알고리즘 |

---

## 🗓️ 진행 상황
- [x] DB 및 서버 초기화
- [x] 회원가입 / 로그인 API
- [ ] 센서 데이터 수집 API
- [ ] 예측 모델 통합
- [ ] 관리자 대시보드

---

## 🧭 라이선스
이 프로젝트는 내부 학습 및 시연 목적이며, 외부 배포용이 아닙니다.
