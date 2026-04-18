from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.certificate import router as cert_router

app = FastAPI(title="FairGig Certificate Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cert_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "certificate"}
