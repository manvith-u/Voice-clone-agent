"""Pydantic request/response schemas for the API."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class VoiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    language: str = Field("english")


class VoiceOut(BaseModel):
    id: str
    name: str
    language: str
    original_audio: Optional[str] = None
    created_at: str


class GenerateRequest(BaseModel):
    voice_id: str
    text: str = Field(..., min_length=1)
    language: str = Field("english")
    speed: float = Field(1.0, ge=0.7, le=1.2)


class GenerationOut(BaseModel):
    id: str
    voice_id: str
    voice_name: Optional[str] = None
    text: str
    language: str
    speed: float
    audio_url: str
    created_at: str


class Message(BaseModel):
    message: str
    detail: Optional[str] = None
