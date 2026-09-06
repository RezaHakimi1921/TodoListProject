# TaskOS

Personal task workspace for one user. Phase 1 now also captures 15-minute work logs and groups them for Jira copy-paste.

## Run locally

Need .NET 9 SDK and Node 20+.

```powershell
cd backend\TaskOS.Api
dotnet run
```

```powershell
cd frontend
npm install
npm run dev
```

- API: `http://localhost:5088`
- UI: `http://localhost:5173`

Click a task card to open the editor drawer. Status chips on the card update immediately.

## Problem studio

`/problems` turns the five decision habits into gates, not advice:

1. One-line problem
2. Invert the constraint (no time / infinite time)
3. Third-option rule — choose stays locked until three options exist
4. Junior one-liner on every option
5. Premortem before choose; `Validated` only after “tested / it worked”

Choose and validate also write a work log, so Jira summary stays in one place.

## Work log

Timer (web + extension) and the extension badge all call the same endpoint:

```
POST /api/worklogs   { description, durationMinutes, source }
GET  /api/worklogs?date=yyyy-MM-dd
GET  /api/worklogs/summary?date=yyyy-MM-dd
```

`source` is `Timer`, `Extension`, or `Manual`. Duration defaults to 15.

Pause/Away skips prompts. The extension also skips a tick if the machine has been idle for 2 minutes.

### Chrome extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → folder `extension`
4. Keep the API running on port 5088

## API

```
GET    /api/tasks?status=&energyType=&tag=
POST   /api/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}
PUT    /api/tasks/{id}/status
GET    /api/tasks/similar?title=
POST   /api/tasks/{id}/timeline
GET    /api/tasks/{id}/timeline
GET    /api/dailylogs?date=
POST   /api/dailylogs
GET    /api/dailylogs/{date}/related-tasks
POST   /api/worklogs
GET    /api/worklogs?date=
GET    /api/worklogs/summary?date=
GET    /api/problems
POST   /api/problems
GET    /api/problems/{id}
PUT    /api/problems/{id}
POST   /api/problems/{id}/options
PUT    /api/problems/{id}/options/{optionId}
DELETE /api/problems/{id}/options/{optionId}
POST   /api/problems/{id}/choose
POST   /api/problems/{id}/validate
```
