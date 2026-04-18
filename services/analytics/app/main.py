from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.commission import router as commission_router
from app.routes.income import router as income_router
from app.routes.vulnerability import router as vulnerability_router
from app.routes.comparison import router as comparison_router
from app.routes.dashboard import router as dashboard_router

app = FastAPI(title="FairGig Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(commission_router)
app.include_router(income_router)
app.include_router(vulnerability_router)
app.include_router(comparison_router)
app.include_router(dashboard_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}
