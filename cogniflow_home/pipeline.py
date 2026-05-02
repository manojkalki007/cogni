"""
Voice Pipeline Orchestrator.

Handles the full real-time audio loop:
  Caller audio → VAD → STT → EOT → LLM → TTS → audio back to caller

Provider-agnostic: works with Twilio, Exotel, or any provider
that implements the TelephonyProvider interface.

Language-aware: auto-selects Deepgram for English/European,
Sarvam AI for Indian languages.

Latency-optimized: semantic EOT, sentence streaming, filler audio,
speculative pre-generation, per-component tracing.
"""

import asyncio
import base64
import logging
import time
import uuid
from dataclasses import dataclass, field

from cogniflow_home.agent import AGENT_INSTRUCTIONS, AGENT_NAME, GREETING, VOICE_ID
from cogniflow_home.audio import compute_energy_mulaw
from cogniflow_home.compliance.engine import ComplianceEngine
from cogniflow_home.config import settings
from cogniflow_home.events import bus
from cogniflow_home.latency.eot import SemanticEOTDetector
from cogniflow_home.latency.filler import FillerAudioManager
from cogniflow_home.latency.speculative import SpeculativeGenerator
from cogniflow_home.latency.tracer import LatencyTracer
from cogniflow_home.intelligence.emotional_mirror import EmotionalMirror
from cogniflow_home.language.detector import LanguageDetector, LanguageRouter
from cogniflow_home.telephony.base import CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.pipeline")

INDIAN_LANGUAGES = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od", "as", "ur", "ne", "en-in"}
EUROPEAN_LANGUAGES = {"fr", "de", "es", "it", "pt", "pl", "nl", "sv", "no", "da", "fi", "tr", "ar"}

SYSTEM_PROMPT_LATENCY_RULES = """
CRITICAL VOICE RULES:
1. ALWAYS start your response with a short acknowledgment (3-6 words).
   Examples: "Sure, let me check." / "Got it, one moment." / "Of course!"
2. Keep all sentences SHORT. Max 15 words per sentence.
3. Never use lists, bullet points, or formatting. This is a phone call.
4. Say numbers as words: "four hundred fifty" not "450".
5. If you need to use a tool, ALWAYS say a filler phrase FIRST:
   "Let me pull that up for you..." Then call the tool.
"""


def _create_stt(language: str, sample_rate: int = 8000):
    if language in INDIAN_LANGUAGES:
        from cogniflow_home.providers.sarvam_stt import SarvamSTT
        return SarvamSTT(language=language, sample_rate=sample_rate)
    from cogniflow_home.providers.stt import DeepgramSTT
    return DeepgramSTT(language=language, sample_rate=sample_rate)


def _create_tts(language: str, voice_id: str, sample_rate: int = 8000):
    if language in INDIAN_LANGUAGES:
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        return SarvamTTS(language=language, sample_rate=sample_rate)
    if language in EUROPEAN_LANGUAGES:
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, language=language, sample_rate=sample_rate)
    if settings.smallest_ai_api_key:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        return SmallestTTS(voice_id=voice_id, language=language, sample_rate=sample_rate)
    if settings.cartesia_api_key:
        from cogniflow_home.providers.tts import CartesiaTTS
        return CartesiaTTS(voice_id=voice_id, sample_rate=sample_rate)
    from cogniflow_home.providers.sarvam_tts import SarvamTTS
    return SarvamTTS(language="en-in", sample_rate=sample_rate)


def _create_llm(system_prompt: str):
    if settings.groq_api_key:
        from cogniflow_home.providers.groq_llm import GroqLLM
        return GroqLLM(system_prompt=system_prompt)
    from cogniflow_home.providers.llm import OpenAILLM
    return OpenAILLM(system_prompt=system_prompt)


@dataclass
class CallState:
    call_sid: str
    caller_number: str
    called_number: str = ""
    direction: str = "inbound"
    provider: str = "twilio"
    agent_name: str = ""
    language: str = "en"
    started_at: float = field(default_factory=time.time)
    transcript: list[dict] = field(default_factory=list)
    is_agent_speaking: bool = False
    barge_in: bool = False


class VoicePipeline:
    """Orchestrates one phone call through the full voice AI pipeline."""

    def __init__(self, call_info: CallInfo, telephony: TelephonyProvider,
                 instructions_override: str = "", greeting_override: str = "",
                 language: str = "en", voice_id: str = ""):
        call_id = call_info.call_sid or str(uuid.uuid4())
        self.state = CallState(
            call_sid=call_id,
            caller_number=call_info.caller_number,
            called_number=call_info.called_number,
            direction=call_info.direction,
            provider=call_info.provider,
            agent_name=AGENT_NAME,
            language=language,
        )
        self._telephony = telephony

        base_instructions = instructions_override or AGENT_INSTRUCTIONS
        self._instructions = base_instructions + "\n\n" + SYSTEM_PROMPT_LATENCY_RULES
        self._greeting = greeting_override or GREETING

        self.stt = _create_stt(language, sample_rate=8000)
        self.llm = _create_llm(self._instructions)
        self.llm.call_context = {
            "call_id": call_id,
            "caller_number": call_info.caller_number,
            "called_number": call_info.called_number,
            "direction": call_info.direction,
        }
        self.tts = _create_tts(language, voice_id or VOICE_ID, sample_rate=8000)

        self.eot = SemanticEOTDetector(threshold=0.65)
        self.tracer = LatencyTracer(call_id)
        self.compliance = ComplianceEngine()
        self.speculative = SpeculativeGenerator(eot_threshold=0.7, min_words=4)
        self.filler = FillerAudioManager()
        self.emotional_mirror = EmotionalMirror()
        self.language_detector = LanguageDetector(primary_language=language)
        self.language_router = LanguageRouter()

        self._running = False
        self._stt_task = None
        self._audio_chunk_count = 0
        self._silence_chunks = 0
        self._speech_energy_threshold = 200

    def inject_context(self, context: str):
        if context:
            self.llm.conversation_history.insert(1, {
                "role": "system",
                "content": f"Caller context: {context}",
            })

    async def _prewarm_tts(self):
        """Send a tiny dummy request to warm the TTS WebSocket connection."""
        try:
            async for _ in self.tts.synthesize("."):
                pass
            logger.debug("TTS connection pre-warmed")
        except Exception as e:
            logger.warning(f"TTS pre-warm failed (non-fatal): {e}")

    async def start(self):
        self._running = True
        await self.stt.connect()
        await self.tts.connect()
        await self._prewarm_tts()

        self.speculative.set_generate_fn(self.llm.generate_stream)
        self.llm.on_tool_call = self._on_tool_call
        asyncio.create_task(self.filler.initialize(self.tts))

        # Cross-session caller memory + pre-call prediction
        greeting = self._greeting
        try:
            from cogniflow_home.memory.caller_memory import caller_memory
            profile = await caller_memory.recall(self.state.caller_number)
            if profile:
                memory_prompt = caller_memory.build_memory_prompt(profile)
                self._instructions = self._instructions + memory_prompt
                self.llm.conversation_history[0]["content"] = self._instructions
                logger.info(f"Loaded memory for {self.state.caller_number}: {profile.get('name')}")

            from cogniflow_home.intelligence.predictor import pre_call_predictor
            prediction = await pre_call_predictor.predict(self.state.caller_number)
            if prediction and prediction["confidence"] >= 0.6:
                prediction_prompt = pre_call_predictor.build_prediction_prompt(prediction)
                self._instructions = self._instructions + prediction_prompt
                self.llm.conversation_history[0]["content"] = self._instructions
                if prediction["confidence"] >= 0.7:
                    greeting = prediction["suggested_greeting"]
        except Exception:
            logger.debug("Memory/prediction unavailable (non-fatal)", exc_info=True)

        self._stt_task = asyncio.create_task(self._process_transcripts())
        logger.info(
            f"Pipeline started for call {self.state.call_sid} "
            f"via {self.state.provider} (lang={self.state.language})"
        )

        await bus.emit("call.started", {
            "call_id": self.state.call_sid,
            "direction": self.state.direction,
            "caller_number": self.state.caller_number,
            "called_number": self.state.called_number,
            "agent_name": self.state.agent_name,
            "provider": self.state.provider,
            "language": self.state.language,
        })

        await self._speak(greeting)

    async def handle_audio(self, mulaw_bytes: bytes):
        if not self._running:
            return

        await self.stt.send_audio(mulaw_bytes)

        if self.state.is_agent_speaking:
            energy = compute_energy_mulaw(mulaw_bytes)
            if energy > self._speech_energy_threshold:
                self._silence_chunks = 0
                self._audio_chunk_count += 1
                if self._audio_chunk_count >= 10:
                    logger.info("Barge-in detected — stopping agent speech")
                    self.state.barge_in = True
                    self.state.is_agent_speaking = False
                    self._audio_chunk_count = 0
                    self.eot.cancel()
                    self.speculative.cancel()
                    await self._telephony.clear_audio()
            else:
                self._silence_chunks += 1
                if self._silence_chunks > 5:
                    self._audio_chunk_count = 0
        else:
            self._audio_chunk_count = 0

    async def _process_transcripts(self):
        try:
            async for result in self.stt.results():
                if not self._running:
                    break

                if not result.is_final:
                    eot_prob = self.eot.predict(result.transcript)
                    await self.speculative.on_partial_transcript(
                        result.transcript, eot_prob
                    )
                    # Language detection on partials
                    new_lang = self.language_detector.should_switch(result.transcript)
                    if new_lang:
                        await self._switch_language(new_lang)
                    continue

                transcript = result.transcript
                # Emotional mirroring
                sentiment = self._quick_sentiment(transcript)
                self.emotional_mirror.update(sentiment)
                redacted, compliance_events = self.compliance.monitor_transcript(
                    transcript
                )
                for event in compliance_events:
                    await bus.emit("compliance.event", {
                        "call_id": self.state.call_sid,
                        **event,
                    })

                logger.info(f"User said: {redacted}")
                self.state.transcript.append(
                    {"role": "user", "text": redacted, "ts": time.time()}
                )

                self.tracer.new_turn()

                speculative = await self.speculative.on_final_transcript(redacted)
                if speculative:
                    await self._speak_speculative(speculative)
                else:
                    await self._generate_and_speak(redacted)

                self.tracer.check_alert()
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Transcript processing error")

    async def _generate_and_speak(self, user_text: str):
        self.state.is_agent_speaking = True
        self.state.barge_in = False

        # Emotional mirroring — inject emotion context
        emotion_prompt = self.emotional_mirror.get_prompt_injection()
        llm_input = user_text
        if emotion_prompt:
            llm_input = f"[EMOTION CONTEXT: {emotion_prompt}]\n\nCaller said: \"{user_text}\""
        if self.emotional_mirror.should_offer_human():
            llm_input += "\n[SYSTEM: Caller has been frustrated for 30+ seconds. Proactively offer to transfer to a human agent.]"

        # Knowledge base RAG
        try:
            from cogniflow_home.knowledge.base import kb
            agent_id = getattr(self, 'agent_id', None)
            if agent_id:
                kb_results = await kb.query(agent_id, user_text)
                kb_context = kb.build_context_prompt(kb_results)
                if kb_context:
                    llm_input = kb_context + "\n\n" + llm_input
        except Exception:
            pass

        full_response = ""
        t_llm = self.tracer.start("llm_ttft")
        first_sentence = True

        try:
            async for sentence in self.llm.generate_stream(llm_input):
                if first_sentence:
                    self.tracer.end(t_llm)
                    first_sentence = False

                if self.state.barge_in:
                    logger.info("Barge-in: stopping mid-response")
                    break

                full_response += sentence + " "

                t_tts = self.tracer.start("tts_ttfb")
                await self._speak(sentence)
                self.tracer.end(t_tts)

                if self.state.barge_in:
                    break

        except Exception:
            logger.exception("Generate-and-speak error")

        if first_sentence:
            self.tracer.end(t_llm)

        self.state.is_agent_speaking = False

        if full_response.strip():
            self.state.transcript.append(
                {"role": "agent", "text": full_response.strip(), "ts": time.time()}
            )

            agent_text = " ".join(
                t["text"] for t in self.state.transcript if t["role"] == "agent"
            )
            disclosure_violations = self.compliance.check_disclosures(
                self.state.started_at, agent_text
            )
            for v in disclosure_violations:
                await bus.emit("compliance.event", {
                    "call_id": self.state.call_sid,
                    **v,
                })

    async def _speak_speculative(self, sentences: list[str]):
        self.state.is_agent_speaking = True
        self.state.barge_in = False
        full_response = ""

        for sentence in sentences:
            if self.state.barge_in:
                break
            full_response += sentence + " "
            await self._speak(sentence)

        self.state.is_agent_speaking = False

        if full_response.strip():
            self.state.transcript.append(
                {"role": "agent", "text": full_response.strip(), "ts": time.time()}
            )
            logger.info("Speculative response delivered")

    async def _on_tool_call(self, tool_name: str):
        filler_audio = self.filler.get_filler(tool_name)
        if filler_audio:
            chunk_size = 160
            for i in range(0, len(filler_audio), chunk_size):
                if self.state.barge_in:
                    break
                segment = filler_audio[i : i + chunk_size]
                payload = base64.b64encode(segment).decode("ascii")
                await self._telephony.send_audio(payload)
                await asyncio.sleep(0.018)
        else:
            filler_text = self.filler.get_filler_text(tool_name)
            await self._speak(filler_text)

    async def _switch_language(self, language: str):
        """Hot-swap STT and TTS providers when language changes."""
        providers = self.language_router.get_providers(language)
        logger.info(f"Switching to language: {language}, providers: {providers}")

        await self.stt.close()
        self.stt = _create_stt(language, sample_rate=8000)
        await self.stt.connect()

        await self.tts.close()
        self.tts = _create_tts(language, "", sample_rate=8000)
        await self.tts.connect()
        await self._prewarm_tts()

        self.state.language = language
        await bus.emit("language.switched", {
            "call_id": self.state.call_sid,
            "new_language": language,
        })

    def _quick_sentiment(self, text: str) -> float:
        """Ultra-fast keyword-based sentiment. 0=negative, 1=positive."""
        text_lower = text.lower()
        negative = ['angry', 'frustrated', 'terrible', 'worst', 'hate', 'useless',
                     'waste', 'horrible', 'pathetic', 'disgusting', 'never', 'cancel',
                     'complaint', 'unacceptable', 'ridiculous', 'stupid']
        positive = ['thank', 'great', 'excellent', 'perfect', 'wonderful', 'amazing',
                     'love', 'awesome', 'fantastic', 'helpful', 'good', 'happy',
                     'appreciate', 'pleased', 'satisfied']

        neg_count = sum(1 for w in negative if w in text_lower)
        pos_count = sum(1 for w in positive if w in text_lower)

        if neg_count + pos_count == 0:
            return 0.5
        return pos_count / (neg_count + pos_count)

    async def _speak(self, text: str):
        try:
            async for audio_chunk in self.tts.synthesize(text):
                if self.state.barge_in:
                    break

                chunk_size = 160
                for i in range(0, len(audio_chunk), chunk_size):
                    if self.state.barge_in:
                        break
                    segment = audio_chunk[i : i + chunk_size]
                    payload = base64.b64encode(segment).decode("ascii")
                    await self._telephony.send_audio(payload)
                    await asyncio.sleep(0.018)

        except Exception:
            logger.exception("TTS speak error")

    async def stop(self):
        self._running = False
        if self._stt_task:
            self._stt_task.cancel()
            try:
                await self._stt_task
            except asyncio.CancelledError:
                pass
        await self.stt.close()
        await self.tts.close()

        duration = int(time.time() - self.state.started_at)

        await self.tracer.save()

        await bus.emit("call.completed", {
            "call_id": self.state.call_sid,
            "direction": self.state.direction,
            "caller_number": self.state.caller_number,
            "called_number": self.state.called_number,
            "agent_name": self.state.agent_name,
            "provider": self.state.provider,
            "language": self.state.language,
            "duration_seconds": duration,
            "transcript": self.state.transcript,
        })

        logger.info(
            f"Pipeline stopped for call {self.state.call_sid} "
            f"(duration: {duration}s, turns: {len(self.state.transcript)})"
        )
