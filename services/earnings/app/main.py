from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.shifts import router as shifts_router
from app.routes.screenshots import router as screenshots_router
from app.routes.verification import router as verification_router

app = FastAPI(title="FairGig Earnings Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shifts_router)
app.include_router(screenshots_router)
app.include_router(verification_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "earnings"}
