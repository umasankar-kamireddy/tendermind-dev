"""Postgres-backed agent memory manager + injector.

Ported from lib/memory/manager.ts and lib/memory/injector.ts, which kept
learnings in `memory/agents/*.json`. That store can't work on a serverless
deployment: the filesystem is read-only apart from a per-instance temp dir,
so file-based memories either crashed the agents or silently vanished
between invocations. Learnings now live in the `agent_memories` table
(app/db.py) alongside the rest of the app's state, which is what makes them
actually accumulate across runs.

Every entry point is async because the pool is - see agents/nodes.py and
app/routers/bid_detail.py for the callers.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from typing import Any

from app import db

logger = logging.getLogger(__name__)

_AGENT_KEYWORDS = {
    "legal": ["LD", "retention", "termination", "warranty", "indemnity", "arbitration"],
    "engineering": ["scope", "timeline", "site", "drawing", "specification"],
    "accounting": ["cost", "payment", "qualification", "criteria", "experience"],
    "risk": ["risk", "mitigation", "gap", "compliance", "exposure"],
}

_MEMORY_TYPE_BY_AGENT = {
    "legal": "clause_extraction",
    "engineering": "classification",
    "accounting": "cost_estimation",
    "risk": "risk_pattern",
}


class MemoryManager:
    """Thin async wrapper over the agent_memories table. Kept as a class so
    the call sites (and the TS port's shape) stay recognisable; it holds no
    cache of its own - the whole point of moving off the file store is that
    one instance's memories must be visible to the next request, which may
    land on a different serverless instance."""

    async def save_memory(self, memory: dict[str, Any]) -> str:
        memory_id = memory.get("id") or f"mem_{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"
        now = _now_iso()
        stored = {
            **memory,
            "id": memory_id,
            "metadata": {**memory.get("metadata", {}), "updated_at": now, "last_used": now},
        }
        await db.save_agent_memory(stored)
        return memory_id

    async def get_memories_for_agent(self, agent: str, limit: int = 5) -> list[dict[str, Any]]:
        return await db.get_agent_memories(agent, limit)

    async def record_memory_usage(self, memory_id: str) -> None:
        await db.record_agent_memory_usage(memory_id)

    async def delete_memory(self, memory_id: str) -> None:
        await db.delete_agent_memory(memory_id)

    async def delete_memories_for_bid(self, bid_id: str) -> int:
        """Delete all memories learned from a specific bid's analysis - used
        when a bid document is removed from history, so stale learnings from
        a deleted document stop being injected into future agent runs."""
        return await db.delete_agent_memories_for_bid(bid_id)


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"


_manager: MemoryManager | None = None


def get_memory_manager() -> MemoryManager:
    global _manager
    if _manager is None:
        _manager = MemoryManager()
    return _manager


def _relevance_score(content: str, tags: list[str], document_text_lower: str) -> int:
    score = 0
    for word in content.lower().split():
        if len(word) > 4 and word in document_text_lower:
            score += 1
    for tag in tags:
        if tag.lower() in document_text_lower:
            score += 3
    return score


def _format_memories_as_context(memories: list[dict[str, Any]], agent: str) -> str:
    if not memories:
        return f"No previous learnings available for {agent} analysis."

    lines = [f"Based on {len(memories)} previous {agent} analyses:", ""]
    for i, memory in enumerate(memories, start=1):
        lines.append(f"{i}. {memory['content']}")
        tags = memory["metadata"].get("tags") or []
        if tags:
            lines.append(f"   Tags: {', '.join(tags)}")
        lines.append(f"   Used {memory['metadata']['usage_count']} times")
        lines.append("")
    return "\n".join(lines)


async def inject_memory_context(
    system_prompt: str, agent: str, document_text: str | None = None
) -> str:
    """Prepend relevant past-analysis learnings to a system prompt. Never
    raises - memory is an enhancement, so a DB hiccup degrades to the plain
    prompt rather than failing the agent run."""
    manager = get_memory_manager()
    try:
        memories = await manager.get_memories_for_agent(agent, limit=10)
    except Exception:
        logger.warning("Could not load %s agent memories, continuing without", agent, exc_info=True)
        return system_prompt

    if document_text and memories:
        document_text_lower = document_text.lower()
        memories.sort(
            key=lambda m: _relevance_score(m["content"], m["metadata"].get("tags") or [], document_text_lower),
            reverse=True,
        )
        memories = memories[:5]

    if not memories:
        return system_prompt

    for memory in memories[:3]:
        try:
            await manager.record_memory_usage(memory["id"])
        except Exception:
            logger.warning("Could not record memory usage for %s", memory["id"], exc_info=True)

    context_text = _format_memories_as_context(memories, agent)
    return (
        f"{system_prompt}\n\n"
        f"## RELEVANT LEARNINGS FROM PREVIOUS ANALYSES\n{context_text}\n\n"
        "Use the above learnings to inform your analysis, but always prioritize the current "
        "document's specific requirements."
    )


def _extract_key_findings(response: str) -> str | None:
    sentences = [s.strip() for s in re.split(r"[.!?]+", response) if len(s.strip()) > 20]
    if not sentences:
        return None
    return ". ".join(sentences[:2])


def _generate_tags(agent: str, content: str) -> list[str]:
    tags = [agent]
    content_lower = content.lower()
    for keyword in _AGENT_KEYWORDS.get(agent, []):
        if keyword.lower() in content_lower:
            tags.append(keyword)
    return tags


async def extract_and_save_memory(
    agent: str, response: str, bid_id: str, document_type: str
) -> str:
    """Extract a learning from an agent's raw response and persist it."""
    key_findings = _extract_key_findings(response)
    if not key_findings:
        return ""

    now = _now_iso()
    memory = {
        "id": "",
        "type": _MEMORY_TYPE_BY_AGENT.get(agent, "general"),
        "agent": agent,
        "content": key_findings,
        "metadata": {
            "source_bid_id": bid_id,
            "source_document": document_type,
            "confidence": 0.85,
            "tags": _generate_tags(agent, key_findings),
            "created_at": now,
            "updated_at": now,
            "usage_count": 0,
            "last_used": now,
        },
    }
    return await get_memory_manager().save_memory(memory)
