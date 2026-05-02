"""Streaming Text-to-Speech via Cartesia."""

import asyncio
import base64
import json
import logging
import uuid
from typing import AsyncIterator

import websockets

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts")

CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"


class CartesiaTTS:
    def __init__(self, voice_id: str, sample_rate: int = 8000):
        self.voice_id = voice_id
        self.sample_rate = sample_rate
        self._ws = None

    async def connect(self):
        url = (
            f"{CARTESIA_WS_URL}"
            f"?api_key={settings.cartesia_api_key}"
            f"&cartesia_version=2024-06-10"
        )
        self._ws = await websockets.connect(url, ping_interval=10, ping_timeout=30)
        logger.info("Cartesia TTS connected")

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        if not self._ws:
            raise RuntimeError("TTS not connected")

        context_id = str(uuid.uuid4())

        request = {
            "model_id": "sonic-2",
            "transcript": text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_mulaw",
                "sample_rate": self.sample_rate,
            },
            "context_id": context_id,
            "language": "en",
        }

        await self._ws.send(json.dumps(request))

        while True:
            try:
                response = await asyncio.wait_for(self._ws.recv(), timeout=10.0)
                data = json.loads(response)

                if data.get("done", False):
                    break

                if "data" in data:
                    audio_bytes = base64.b64decode(data["data"])
                    yield audio_bytes

            except asyncio.TimeoutError:
                logger.warning("TTS response timeout")
                break
            except Exception:
                logger.exception("TTS receive error")
                break

    async def close(self):
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        logger.info("Cartesia TTS closed")
