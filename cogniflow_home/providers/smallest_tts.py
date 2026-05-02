"""Smallest AI Text-to-Speech.

Low-latency Lightning TTS with natural-sounding voices.
Outputs mulaw 8kHz directly — no conversion needed for telephony.
"""

import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.audio import pcm16_to_mulaw
from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.smallest")

SMALLEST_API_URL = "https://waves-api.smallest.ai/api/v1/lightning/get_speech"


class SmallestTTS:
    def __init__(self, voice_id: str = "", language: str = "en", sample_rate: int = 8000):
        self.voice_id = voice_id or "emily"
        self.language = language
        self.sample_rate = sample_rate
        self._client = httpx.AsyncClient(timeout=15.0)

    async def connect(self):
        logger.info(f"Smallest AI TTS ready (voice={self.voice_id})")

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        headers = {
            "Authorization": f"Bearer {settings.smallest_ai_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "text": text,
            "voice_id": self.voice_id,
            "sample_rate": self.sample_rate,
            "speed": 1.0,
            "add_wav_header": False,
        }

        try:
            async with self._client.stream(
                "POST", SMALLEST_API_URL, json=body, headers=headers
            ) as resp:
                if resp.status_code != 200:
                    error = await resp.aread()
                    logger.warning(
                        f"Smallest AI error: {resp.status_code} {error.decode()}"
                    )
                    return

                async for chunk in resp.aiter_bytes(640):
                    if chunk:
                        yield pcm16_to_mulaw(chunk)

        except Exception:
            logger.exception("Smallest AI TTS request failed")

    async def close(self):
        await self._client.aclose()
        logger.info("Smallest AI TTS closed")
