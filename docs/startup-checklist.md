# Startup Checklist

Use this checklist to run CallInsights locally on Windows.

## Prerequisites

- `Python 3.11+` installed and available in PowerShell as `python`
- `Node.js 20+` and `npm`
- Two terminal windows

## 1. Start the Backend

Open a PowerShell terminal:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Expected result:

- API starts on `http://127.0.0.1:8000`
- Root check works at `http://127.0.0.1:8000/`
- Health check works at `http://127.0.0.1:8000/health/`

## 2. Start the Frontend

Open a second PowerShell terminal:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npm install
npm run dev
```

Expected result:

- Vite starts on `http://localhost:5173`
- The UI loads and fetches data from `http://127.0.0.1:8000`

## 3. Open the App

In your browser, open:

```text
http://localhost:5173
```

## 4. Quick Smoke Check

Verify the following:

- The app shell loads with sidebar, top bar, and theme toggle
- Executive Overview opens by default
- Issue Explorer shows issue cards and evidence
- Call Drilldown opens a transcript
- Light, dark, and system theme toggle works

## 5. If the API Does Not Start

Check:

- You are inside `apps/api`
- The virtual environment is activated
- `pip install -r requirements.txt` completed successfully

Retry:

```powershell
uvicorn app.main:app --reload
```

## 6. If the Frontend Does Not Start

Check:

- You are inside `apps/web`
- `npm install` completed successfully

Retry:

```powershell
npm run dev
```

## 7. If the UI Loads but Shows an Error

Check:

- Backend is running on `http://127.0.0.1:8000`
- Frontend is running on `http://localhost:5173`
- The backend endpoint `http://127.0.0.1:8000/api/rank1/dashboard` returns JSON

## 8. Optional Verification

Frontend TypeScript check:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npx tsc -b
```

## 9. Common Windows Notes

- If PowerShell blocks virtual environment activation, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

- If port `8000` or `5173` is already in use, stop the existing process or run the conflicting service on a different port.

- If the frontend starts but does not load data, confirm the backend is still running and that CORS has not been changed from the current defaults.
