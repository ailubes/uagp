"""The web portal is optional: civic drafts can also arrive from personal MCP clients."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .handoff import public_catalog


def create_portal_router(database_path: str) -> APIRouter:
    router = APIRouter(tags=["UAGP Portal"])
    index = Path(__file__).parent / "static" / "index.html"

    @router.get("/ui", include_in_schema=False)
    def ui() -> FileResponse:
        return FileResponse(index, media_type="text/html", headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": (
                "default-src 'none'; "
                "style-src 'unsafe-inline'; "
                "script-src 'unsafe-inline'; "
                "connect-src 'self'; img-src 'self' data:; "
                "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
            ),
        })

    @router.get("/v1/public/proposals")
    def public_proposals(category: str = "all", limit: int = 12) -> dict:
        try:
            return public_catalog(database_path, category, limit)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return router
