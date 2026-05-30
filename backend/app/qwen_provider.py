"""Qwen/DashScope image provider for character action candidates."""
from __future__ import annotations

import base64
import io
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable

import httpx
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_API_BASE = "https://dashscope.aliyuncs.com/api/v1"
DEFAULT_IMAGE_MODEL = "qwen-image-2.0-pro"
GENERATION_PATH = "/services/aigc/multimodal-generation/generation"
REGIONAL_API_BASES = [
    "https://dashscope-intl.aliyuncs.com/api/v1",
    "https://dashscope.aliyuncs.com/api/v1",
    "https://dashscope-us.aliyuncs.com/api/v1",
]


class QwenProviderError(RuntimeError):
    """Raised when DashScope/Qwen returns an unusable response."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _load_local_env() -> None:
    for env_path in (ROOT / ".env.local", ROOT / "backend" / ".env.local", ROOT / ".env"):
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip().lstrip("\ufeff")
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_local_env()


def get_qwen_api_key() -> str:
    return os.getenv("DASHSCOPE_API_KEY") or os.getenv("QWEN_API_KEY") or ""


def is_qwen_configured() -> bool:
    return bool(get_qwen_api_key())


def get_qwen_model() -> str:
    return os.getenv("DASHSCOPE_IMAGE_MODEL") or os.getenv("QWEN_IMAGE_MODEL") or DEFAULT_IMAGE_MODEL


def _endpoint_from_base(base: str) -> str:
    base = base.rstrip("/")
    if base.endswith(GENERATION_PATH):
        return base
    return f"{base}{GENERATION_PATH}"


def _get_endpoint() -> str:
    base = os.getenv("DASHSCOPE_API_BASE") or os.getenv("QWEN_API_BASE") or DEFAULT_API_BASE
    return _endpoint_from_base(base)


def _get_candidate_endpoints() -> list[str]:
    endpoints = [_get_endpoint()]
    for base in REGIONAL_API_BASES:
        endpoint = _endpoint_from_base(base)
        if endpoint not in endpoints:
            endpoints.append(endpoint)
    return endpoints


def _image_to_data_url(content: bytes) -> str:
    encoded = base64.b64encode(content).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _extract_image_refs(value) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"image", "url", "image_url"} and isinstance(child, str):
                refs.append(child)
            else:
                refs.extend(_extract_image_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(_extract_image_refs(child))
    return refs


def _fetch_image_bytes(client: httpx.Client, ref: str) -> bytes:
    if ref.startswith("data:image/"):
        _, encoded = ref.split(",", 1)
        return base64.b64decode(encoded)
    response = client.get(ref, timeout=120)
    response.raise_for_status()
    return response.content


def _save_canvas_png(content: bytes, output_path: Path, canvas_size: int) -> None:
    image = Image.open(io.BytesIO(content)).convert("RGBA")
    if image.size == (canvas_size, canvas_size):
        image.save(output_path, "PNG")
        return

    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    scale = min(canvas_size / max(image.width, 1), canvas_size / max(image.height, 1))
    draw_w = max(1, round(image.width * scale))
    draw_h = max(1, round(image.height * scale))
    resample = Image.Resampling.NEAREST if image.width <= 256 or image.height <= 256 else Image.Resampling.LANCZOS
    image = image.resize((draw_w, draw_h), resample)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((canvas_size - draw_w) // 2, round(canvas_size * 0.84 - draw_h)))
    canvas.save(output_path, "PNG")


ACTION_PROMPTS = {
    "idle": "idle animation frames with subtle breathing and stable standing posture",
    "walk": "walking animation frames, alternating feet, slight forward lean, stable center and feet anchor",
    "run": "running animation frames with stronger motion than walking, consistent silhouette and proportions",
    "attack": "basic attack pose frames, clear arm and body action direction, leave empty space for a separate weapon layer",
    "skill": "skill or casting pose frames with stronger body expression, no separate weapon effect generated",
    "hurt": "hurt reaction frames, slight recoil or backward lean, full character remains visible",
    "death": "death animation frames, falling or defeated posture, full character remains visible and uncropped",
}


def _build_prompt(action: str, count: int, canvas_size: int, pixel_art: bool) -> str:
    style_hint = (
        "Keep crisp pixel-art edges and do not blur pixels."
        if pixel_art
        else "Keep clean high-quality game character rendering."
    )
    return (
        "Use the uploaded image as the exact character identity reference. "
        f"Generate {count} separate {ACTION_PROMPTS.get(action, action)}. "
        "The same face, hair, clothing, colors, body proportions, art style, and character scale must remain consistent across every frame. "
        f"Each output must be a single transparent-background PNG on a {canvas_size}x{canvas_size} canvas. "
        "The character must stay horizontally centered with a stable feet anchor near 84% canvas height. "
        "Do not add weapons, attack effects, text, logos, UI, borders, background scenery, shadows, or watermarks. "
        f"{style_hint}"
    )


def _negative_prompt() -> str:
    return (
        "different character, changed costume, changed hair, changed face, inconsistent style, "
        "background, scene, weapon, attack effect, text, logo, watermark, cropped body, extra limbs, "
        "deformed hands, low quality, blurry, overexposed, duplicate character"
    )


def _post_dashscope_generation(client: httpx.Client, headers: dict, payload: dict) -> dict:
    errors: list[str] = []
    for endpoint in _get_candidate_endpoints():
        response = client.post(endpoint, headers=headers, json=payload)
        try:
            data = response.json()
        except Exception:
            data = {}

        error_code = str(data.get("code") or response.status_code if response.status_code >= 400 else data.get("code") or "")
        error_message = str(data.get("message") or response.text[:500] or "")
        if response.status_code < 400 and not error_code:
            return data

        errors.append(f"{endpoint}: {error_code or response.status_code} {error_message}".strip())
        if error_code not in {"InvalidApiKey", "401", "403"}:
            raise QwenProviderError(error_code or str(response.status_code), error_message or "Qwen request failed.")

    raise QwenProviderError(
        "InvalidApiKey",
        "DashScope rejected the configured API key in all supported regions. "
        "Please check that the key is a Model Studio/DashScope key and that the correct region is enabled. "
        f"Attempts: {' | '.join(errors)}",
    )


def generate_character_action_candidates_with_qwen(
    *,
    base_png: bytes,
    output_dir: Path,
    fixed_counts: dict,
    canvas_size: int,
    pixel_art: bool,
    on_progress: Callable[[int, int], None] | None = None,
    on_candidate: Callable[[dict, int, int], None] | None = None,
    on_batch_start: Callable[[int, int, int], None] | None = None,
    frame_plan: list[dict] | None = None,
    max_concurrency: int = 3,
) -> dict:
    api_key = get_qwen_api_key()
    if not api_key:
        raise QwenProviderError("AI_PROVIDER_NOT_CONFIGURED", "DASHSCOPE_API_KEY is not configured.")

    output_dir.mkdir(parents=True, exist_ok=True)
    model = get_qwen_model()
    actions = ["idle", "walk", "run", "attack", "skill", "hurt", "death"]
    if frame_plan:
        plan = [
            {
                "action": str(item.get("action")),
                "frame_index": max(0, int(item.get("frame_index", 0))),
                "frame_count": max(1, int(item.get("frame_count", fixed_counts.get(str(item.get("action")), 1)))),
            }
            for item in frame_plan
            if str(item.get("action")) in actions
        ]
    else:
        plan = [
            {"action": action, "frame_index": index, "frame_count": int(fixed_counts.get(action, 0))}
            for action in actions
            for index in range(int(fixed_counts.get(action, 0)))
        ]
    total = max(1, len(plan))
    completed = 0
    candidates = []
    worker_count = max(1, min(3, int(max_concurrency or 1), len(plan) or 1))

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    image_ref = _image_to_data_url(base_png)

    def _generate_one(item: dict) -> dict:
        action = item["action"]
        index = item["frame_index"]
        payload = {
            "model": model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"image": image_ref},
                            {"text": _build_prompt(action, item["frame_count"], canvas_size, pixel_art)},
                        ],
                    }
                ]
            },
            "parameters": {
                "n": 1,
                "watermark": False,
                "negative_prompt": _negative_prompt(),
                "prompt_extend": True,
                "size": f"{canvas_size}*{canvas_size}",
            },
        }

        with httpx.Client(timeout=180) as client:
            data = _post_dashscope_generation(client, headers, payload)
            refs = _extract_image_refs(data)
            if len(refs) < 1:
                raise QwenProviderError(
                    "QWEN_EMPTY_RESULT",
                    f"Qwen returned {len(refs)} image(s) for {action}, expected 1.",
                )

            filename = f"{action}_{index + 1:03d}.png"
            out_path = output_dir / filename
            image_bytes = _fetch_image_bytes(client, refs[0])
            _save_canvas_png(image_bytes, out_path, canvas_size)
        return {
            "id": f"{action}_{index + 1:03d}",
            "action": action,
            "frame_index": index,
            "filename": filename,
            "url": "",
            "provider": "qwen",
        }

    for batch_start in range(0, len(plan), worker_count):
        batch = plan[batch_start:batch_start + worker_count]
        batch_index = (batch_start // worker_count) + 1
        if on_batch_start:
            on_batch_start(batch_index, completed, total)
        with ThreadPoolExecutor(max_workers=len(batch)) as executor:
            future_map = {executor.submit(_generate_one, item): item for item in batch}
            for future in as_completed(future_map):
                candidate = future.result()
                candidates.append(candidate)
                completed += 1
                if on_candidate:
                    on_candidate(dict(candidate), completed, total)
                if on_progress:
                    on_progress(completed, total)

    candidates.sort(key=lambda item: (actions.index(item["action"]), int(item["frame_index"])))

    return {
        "candidates": candidates,
        "fixed_frame_counts": fixed_counts,
        "canvas_size": canvas_size,
        "provider": "qwen",
        "model": model,
    }
