"""ElevenLabs Text-to-Speech for European and premium English voices.

Supports: English, French, German, Spanish, Italian, Portuguese, Polish,
Dutch, Swedish, Norwegian, Danish, Finnish, Turkish, Arabic, and more.

Outputs PCM audio which we convert to mulaw for telephony.
"""

import asyncio
import base64
import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.audio import pcm16_to_mulaw
from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.elevenlabs")

ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech"

VOICES = {
    "en-male": "pNInz6obpgDQGcFmaJgB",       # Adam
    "en-female": "21m00Tcm4TlvDq8ikWAM",      # Rachel
    "fr-male": "yoZ06aMxZJJ28mfd3POQ",        # French male
    "de-male": "ErXwobaYiN019PkySvjV",        # German male
    "es-female": "EXAVITQu4vr4xnSDxMaL",      # Spanish female
    "it-male": "VR6AewLTigWG4xSOukaG",        # Italian male
    "pt-female": "ThT5KcBeYPX3keUQqHPh",      # Portuguese female
}


class ElevenLabsTTS:
    def __init__(self, voice_id: str = "", language: str = "en", sample_rate: int = 8000):
        self.voice_id = voice_id or VOICES.get(f"{language}-male", VOICES["en-male"])
        self.sample_rate = sample_rate
        self._client = httpx.AsyncClient(timeout=15.0)

    async def connect(self):
        logger.info(f"ElevenLabs TTS ready (voice={self.voice_id})")

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        url = f"{ELEVENLABS_URL}/{self.voice_id}/stream"
        headers = {
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        }
        body = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "output_format": "pcm_16000",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
            },
        }

        try:
            async with self._client.stream("POST", url, json=body, headers=headers) as resp:
                if resp.status_code != 200:
                    logger.warning(f"ElevenLabs error: {resp.status_code}")
                    return

                pcm_buffer = bytearray()
                async for chunk in resp.aiter_bytes(1024):
                    pcm_buffer.extend(chunk)

                    while len(pcm_buffer) >= 640:
                        pcm_chunk = bytes(pcm_buffer[:640])
                        del pcm_buffer[:640]

                        from cogniflow_home.audio import pcm16_to_mulaw
                        import audioop
                        downsampled = audioop.ratecv(pcm_chunk, 2, 1, 16000, 8000, None)[0]
                        mulaw_chunk = pcm16_to_mulaw(downsampled)
                        yield mulaw_chunk

                if pcm_buffer:
                    import audioop
                    downsampled = audioop.ratecv(bytes(pcm_buffer), 2, 1, 16000, 8000, None)[0]
                    mulaw_chunk = pcm16_to_mulaw(downsampled)
                    yield mulaw_chunk

        except Exception:
            logger.exception("ElevenLabs TTS request failed")

    async def close(self):
        await self._client.aclose()
        logger.info("ElevenLabs TTS closed")
