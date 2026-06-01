"""Brian (LabAssistant) — FastAPI service with mcp-use agent and MCP server registry."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent_service import AgentService
from mcp_store import McpStore, McpStoreError

store = McpStore()
agent_service = AgentService(store)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await agent_service.close()


app = FastAPI(title="Brian Lab Assistant", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class McpServerIn(BaseModel):
    id: str = Field(min_length=2, max_length=49)
    name: str = Field(min_length=1, max_length=120)
    url: str
    healthUrl: str = ""
    toolId: str = ""
    enabled: bool = True


class McpServerUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    healthUrl: str | None = None
    toolId: str | None = None
    enabled: bool | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "llmConfigured": agent_service._llm_configured(),
        "mcpServerCount": len(store.list_servers()),
    }


@app.get("/api/mcp/servers")
async def list_mcp_servers() -> dict[str, Any]:
    return {"servers": store.list_servers()}


@app.post("/api/mcp/servers", status_code=201)
async def create_mcp_server(body: McpServerIn) -> dict[str, Any]:
    try:
        server = store.add_server(body.model_dump())
        agent_service.invalidate()
        return server
    except McpStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/mcp/servers/{server_id}")
async def update_mcp_server(server_id: str, body: McpServerUpdate) -> dict[str, Any]:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        server = store.update_server(server_id, payload)
        agent_service.invalidate()
        return server
    except McpStoreError as exc:
        raise HTTPException(status_code=404 if "Unknown" in str(exc) else 400, detail=str(exc)) from exc


@app.delete("/api/mcp/servers/{server_id}", status_code=204)
async def delete_mcp_server(server_id: str) -> None:
    try:
        store.delete_server(server_id)
        agent_service.invalidate()
    except McpStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    try:
        reply = await agent_service.chat(body.message)
        return ChatResponse(reply=reply)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Brian failed: {exc}") from exc


@app.get("/api/mcp/health/{server_id}")
async def mcp_server_health(server_id: str) -> dict[str, Any]:
    server = store.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Unknown MCP server")
    health_url = server.get("healthUrl") or server["url"]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(health_url)
            return {
                "id": server_id,
                "status": "up" if res.status_code < 500 else "down",
                "httpStatus": res.status_code,
            }
    except Exception:
        return {"id": server_id, "status": "down", "httpStatus": 0}


def main() -> None:
    import uvicorn

    port = int(os.getenv("BRIAN_PORT", "9010"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
