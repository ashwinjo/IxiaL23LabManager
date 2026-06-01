"""Brian agent — mcp-use MCPAgent over configured MCP servers."""

from __future__ import annotations

import asyncio
import os
from typing import Any

from langchain_openai import ChatOpenAI
from mcp_use import MCPAgent, MCPClient

from mcp_store import McpStore

SYSTEM_PROMPT = """You are Brian, the Ixia L2–L3 lab assistant embedded in IxiaL23LabManager.
You help network test engineers query chassis inventory, IxNetwork sessions, and lab utilization.
Use the available MCP tools to fetch live data. Be concise and practical.
If a tool is unavailable, say so clearly and suggest checking MCP server health in the shell UI.
Never invent chassis IPs, session names, or port statistics — always use tool results."""


class AgentService:
    def __init__(self, store: McpStore) -> None:
        self.store = store
        self._agent: MCPAgent | None = None
        self._config_key: str | None = None
        self._lock = asyncio.Lock()

    @staticmethod
    def _llm_configured() -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    @staticmethod
    def _build_client_config(servers: list[dict[str, Any]]) -> dict[str, Any]:
        enabled = [s for s in servers if s.get("enabled", True)]
        return {
            "mcpServers": {
                server["id"]: {"url": server["url"]}
                for server in enabled
            }
        }

    def _config_fingerprint(self, servers: list[dict[str, Any]]) -> str:
        enabled = [s for s in servers if s.get("enabled", True)]
        parts = [f"{s['id']}:{s['url']}:{s.get('enabled', True)}" for s in enabled]
        return "|".join(sorted(parts))

    async def _get_agent(self) -> MCPAgent:
        if not self._llm_configured():
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Add it to lab-assistant/.env or your environment."
            )

        servers = self.store.list_servers()
        fingerprint = self._config_fingerprint(servers)
        if self._agent is not None and self._config_key == fingerprint:
            return self._agent

        async with self._lock:
            if self._agent is not None and self._config_key == fingerprint:
                return self._agent

            if self._agent is not None:
                try:
                    await self._agent.close()
                except Exception:
                    pass
                self._agent = None

            client_config = self._build_client_config(servers)
            if not client_config["mcpServers"]:
                raise RuntimeError("No enabled MCP servers configured. Add servers in Home / Config → MCP.")

            client = MCPClient.from_dict(client_config)
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            llm = ChatOpenAI(model=model, temperature=0)
            self._agent = MCPAgent(
                llm=llm,
                client=client,
                max_steps=int(os.getenv("BRIAN_MAX_STEPS", "8")),
                memory_enabled=True,
                system_prompt=SYSTEM_PROMPT,
            )
            self._config_key = fingerprint
            return self._agent

    def invalidate(self) -> None:
        self._agent = None
        self._config_key = None

    async def chat(self, message: str) -> str:
        agent = await self._get_agent()
        result = await agent.run(message.strip())
        if isinstance(result, str):
            return result
        return str(result)

    async def close(self) -> None:
        if self._agent is None:
            return
        try:
            await self._agent.close()
        finally:
            self._agent = None
            self._config_key = None
