"""Persist MCP server definitions for Brian."""

from __future__ import annotations

import json
import re
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

DEFAULT_STORE = Path(__file__).resolve().parent / "mcp_servers.json"
_ID_RE = re.compile(r"^[a-z][a-z0-9-]{1,48}$")


class McpStoreError(ValueError):
    pass


class McpStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or DEFAULT_STORE
        self._lock = threading.Lock()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"servers": []}
        with self.path.open(encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "servers" not in data:
            raise McpStoreError("Invalid MCP store format")
        return data

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        tmp.replace(self.path)

    @staticmethod
    def _validate_server(server: dict[str, Any], *, require_id: bool = True) -> dict[str, Any]:
        sid = (server.get("id") or "").strip()
        name = (server.get("name") or "").strip()
        url = (server.get("url") or "").strip()
        health_url = (server.get("healthUrl") or "").strip()

        if require_id and not sid:
            raise McpStoreError("id is required")
        if require_id and not _ID_RE.match(sid):
            raise McpStoreError("id must be 2–49 chars, lowercase letters, digits, dashes")
        if not name:
            raise McpStoreError("name is required")
        if not url:
            raise McpStoreError("url is required")
        if urlparse(url).scheme not in ("http", "https"):
            raise McpStoreError("url must be http or https")
        if health_url and urlparse(health_url).scheme not in ("http", "https"):
            raise McpStoreError("healthUrl must be http or https")

        cleaned: dict[str, Any] = {
            "id": sid,
            "name": name,
            "url": url,
            "healthUrl": health_url or url.rsplit("/mcp", 1)[0] + "/",
            "enabled": bool(server.get("enabled", True)),
        }
        tool_id = (server.get("toolId") or "").strip()
        if tool_id:
            cleaned["toolId"] = tool_id
        return cleaned

    def list_servers(self) -> list[dict[str, Any]]:
        with self._lock:
            return deepcopy(self._load().get("servers", []))

    def get_server(self, server_id: str) -> dict[str, Any] | None:
        for server in self.list_servers():
            if server["id"] == server_id:
                return server
        return None

    def add_server(self, payload: dict[str, Any]) -> dict[str, Any]:
        server = self._validate_server(payload, require_id=True)
        with self._lock:
            data = self._load()
            servers = data.setdefault("servers", [])
            if any(s["id"] == server["id"] for s in servers):
                raise McpStoreError(f"Server id already exists: {server['id']}")
            servers.append(server)
            self._save(data)
            return deepcopy(server)

    def update_server(self, server_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            data = self._load()
            servers = data.setdefault("servers", [])
            for idx, existing in enumerate(servers):
                if existing["id"] != server_id:
                    continue
                merged = {**existing, **payload, "id": server_id}
                updated = self._validate_server(merged, require_id=True)
                servers[idx] = updated
                self._save(data)
                return deepcopy(updated)
            raise McpStoreError(f"Unknown server id: {server_id}")

    def delete_server(self, server_id: str) -> None:
        with self._lock:
            data = self._load()
            servers = data.setdefault("servers", [])
            next_servers = [s for s in servers if s["id"] != server_id]
            if len(next_servers) == len(servers):
                raise McpStoreError(f"Unknown server id: {server_id}")
            data["servers"] = next_servers
            self._save(data)
