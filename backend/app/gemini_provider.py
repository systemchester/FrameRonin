"""Gemini image provider for matte and character action generation."""
from __future__ import annotations

import base64
import io
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from collections import deque
from typing import Callable

import httpx
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_TEXT_MODEL = "gemini-2.5-flash"
DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProviderError(RuntimeError):
    """Raised when Gemini returns an unusable response."""

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


def get_gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""


def is_gemini_configured() -> bool:
    return bool(get_gemini_api_key())


def get_gemini_text_model() -> str:
    return os.getenv("GEMINI_TEXT_MODEL") or DEFAULT_TEXT_MODEL


def get_gemini_image_model() -> str:
    return os.getenv("GEMINI_IMAGE_MODEL") or DEFAULT_IMAGE_MODEL


def _guess_mime(content: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(content))
        fmt = (image.format or "PNG").lower()
        if fmt == "jpg":
            fmt = "jpeg"
        return f"image/{fmt}"
    except Exception:
        return "image/png"


def _inline_image_part(content: bytes) -> dict:
    return {
        "inline_data": {
            "mime_type": _guess_mime(content),
            "data": base64.b64encode(content).decode("ascii"),
        }
    }


def _extract_inline_images(value) -> list[bytes]:
    images: list[bytes] = []
    if isinstance(value, dict):
        blob = value.get("inlineData") or value.get("inline_data")
        if isinstance(blob, dict) and isinstance(blob.get("data"), str):
            try:
                images.append(base64.b64decode(blob["data"]))
            except Exception:
                pass
        for child in value.values():
            if child is not blob:
                images.extend(_extract_inline_images(child))
    elif isinstance(value, list):
        for child in value:
            images.extend(_extract_inline_images(child))
    return images


def _extract_text(value) -> str:
    chunks: list[str] = []
    if isinstance(value, dict):
        text = value.get("text")
        if isinstance(text, str):
            chunks.append(text)
        for child in value.values():
            chunks.append(_extract_text(child))
    elif isinstance(value, list):
        for child in value:
            chunks.append(_extract_text(child))
    return " ".join(chunk.strip() for chunk in chunks if chunk.strip())


def _post_generate_content(client: httpx.Client, *, model: str, parts: list[dict]) -> dict:
    api_key = get_gemini_api_key()
    if not api_key:
        raise GeminiProviderError("AI_PROVIDER_NOT_CONFIGURED", "GEMINI_API_KEY is not configured.")

    url = f"{API_BASE}/models/{model}:generateContent"
    response = client.post(
        url,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={"contents": [{"role": "user", "parts": parts}]},
    )
    try:
        data = response.json()
    except Exception:
        data = {}

    if response.status_code >= 400:
        error = data.get("error") if isinstance(data, dict) else None
        message = ""
        code = str(response.status_code)
        if isinstance(error, dict):
            message = str(error.get("message") or "")
            code = str(error.get("status") or error.get("code") or code)
        raise GeminiProviderError(code, message or response.text[:1000] or "Gemini request failed.")

    return data


def _generate_image_edit(content: bytes, prompt: str) -> bytes:
    model = get_gemini_image_model()
    with httpx.Client(timeout=240) as client:
        data = _post_generate_content(
            client,
            model=model,
            parts=[{"text": prompt}, _inline_image_part(content)],
        )
    images = _extract_inline_images(data)
    if not images:
        text = _extract_text(data)
        raise GeminiProviderError(
            "GEMINI_EMPTY_IMAGE_RESULT",
            f"Gemini did not return an image. Response text: {text[:1000]}",
        )
    return images[-1]


def _make_edge_background_transparent(image: Image.Image, tolerance: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.getextrema()[3][0] < 255:
        return rgba

    width, height = rgba.size
    pixels = rgba.load()
    bg = pixels[0, 0][:3]
    stack = [(x, 0) for x in range(width)] + [(x, height - 1) for x in range(width)]
    stack += [(0, y) for y in range(height)] + [(width - 1, y) for y in range(height)]
    seen: set[tuple[int, int]] = set()

    def close_to_bg(rgb: tuple[int, int, int]) -> bool:
        return sum(abs(int(rgb[i]) - int(bg[i])) for i in range(3)) <= tolerance * 3

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in seen:
            continue
        seen.add((x, y))
        r, g, b, a = pixels[x, y]
        if a == 0 or not close_to_bg((r, g, b)):
            continue
        pixels[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return rgba


def _remove_dominant_edge_background(image: Image.Image, tolerance: int = 20) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    edge_points: list[tuple[int, int]] = []
    bins: dict[tuple[int, int, int], int] = {}

    for x in range(width):
        for y in (0, height - 1):
            r, g, b, a = pixels[x, y]
            if a > 180:
                edge_points.append((x, y))
                key = (r // 16, g // 16, b // 16)
                bins[key] = bins.get(key, 0) + 1
    for y in range(height):
        for x in (0, width - 1):
            r, g, b, a = pixels[x, y]
            if a > 180:
                edge_points.append((x, y))
                key = (r // 16, g // 16, b // 16)
                bins[key] = bins.get(key, 0) + 1

    if not edge_points or not bins:
        return rgba
    dominant_bin, count = max(bins.items(), key=lambda item: item[1])
    if count < max(24, len(edge_points) * 0.22):
        return rgba

    samples = []
    for x, y in edge_points:
        r, g, b, _ = pixels[x, y]
        if (r // 16, g // 16, b // 16) == dominant_bin:
            samples.append((r, g, b))
    if not samples:
        return rgba
    bg = tuple(round(sum(sample[i] for sample in samples) / len(samples)) for i in range(3))

    def close_to_bg(rgb: tuple[int, int, int]) -> bool:
        return max(abs(int(rgb[i]) - int(bg[i])) for i in range(3)) <= tolerance

    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()
    for x, y in edge_points:
        r, g, b, a = pixels[x, y]
        if a > 180 and close_to_bg((r, g, b)):
            queue.append((x, y))
            seen.add((x, y))

    removed = 0
    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        if a <= 24 or not close_to_bg((r, g, b)):
            continue
        pixels[x, y] = (r, g, b, 0)
        removed += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                seen.add((nx, ny))
                queue.append((nx, ny))

    return rgba if removed >= 64 else image.convert("RGBA")


def _neighbor_average_color(pixels, width: int, height: int, points: list[tuple[int, int]]) -> tuple[int, int, int]:
    total = [0, 0, 0]
    count = 0
    point_set = set(points)
    for x, y in points[:3000]:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in point_set:
                r, g, b, a = pixels[nx, ny]
                if a > 24:
                    total[0] += r
                    total[1] += g
                    total[2] += b
                    count += 1
    if not count:
        return (255, 255, 255)
    return tuple(max(0, min(255, round(value / count))) for value in total)


def _fill_internal_alpha_holes(image: Image.Image, max_area: int = 5200) -> Image.Image:
    """Close accidental transparent holes inside a generated sprite."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    seen: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] > 24:
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            seen.add((x, y))
            points: list[tuple[int, int]] = []
            touches_border = False

            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                if cx == 0 or cy == 0 or cx == width - 1 or cy == height - 1:
                    touches_border = True
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if (
                        0 <= nx < width
                        and 0 <= ny < height
                        and (nx, ny) not in seen
                        and pixels[nx, ny][3] <= 24
                    ):
                        seen.add((nx, ny))
                        queue.append((nx, ny))

            if touches_border or len(points) > max_area:
                continue
            r, g, b = _neighbor_average_color(pixels, width, height, points)
            for px, py in points:
                pixels[px, py] = (r, g, b, 255)

    return rgba


def _remove_alpha_speckles(image: Image.Image, min_area: int = 36) -> Image.Image:
    """Remove tiny opaque crumbs that Gemini sometimes leaves around a sprite."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    seen: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y][3] <= 24:
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            seen.add((x, y))
            points: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if (
                        0 <= nx < width
                        and 0 <= ny < height
                        and (nx, ny) not in seen
                        and pixels[nx, ny][3] > 24
                    ):
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            if len(points) < min_area:
                for px, py in points:
                    r, g, b, _ = pixels[px, py]
                    pixels[px, py] = (r, g, b, 0)

    return rgba


def _remove_large_neutral_background_components(image: Image.Image, min_area: int = 420) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    seen: set[tuple[int, int]] = set()

    def is_neutral_bg_pixel(x: int, y: int) -> bool:
        r, g, b, a = pixels[x, y]
        if a <= 24:
            return False
        spread = max(r, g, b) - min(r, g, b)
        return spread < 18 and (max(r, g, b) < 38 or min(r, g, b) > 205)

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or not is_neutral_bg_pixel(x, y):
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            seen.add((x, y))
            points: list[tuple[int, int]] = []
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen and is_neutral_bg_pixel(nx, ny):
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            bbox_area = max(1, (max_x - min_x + 1) * (max_y - min_y + 1))
            long_line = (max_x - min_x > width * 0.25 or max_y - min_y > height * 0.25) and len(points) >= 120
            broad_block = len(points) >= min_area and bbox_area >= min_area * 2
            if long_line or broad_block:
                for px, py in points:
                    r, g, b, _ = pixels[px, py]
                    pixels[px, py] = (r, g, b, 0)

    return rgba


def _remove_probable_checker_background(image: Image.Image, ratio_threshold: float = 0.12) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    candidates: list[tuple[int, int]] = []
    opaque = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a <= 24:
                continue
            opaque += 1
            spread = max(r, g, b) - min(r, g, b)
            if spread < 22 and (min(r, g, b) > 188 or max(r, g, b) < 42):
                candidates.append((x, y))

    if opaque <= 0 or len(candidates) / opaque < ratio_threshold:
        return rgba

    for x, y in candidates:
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
    return rgba


def _repair_sprite_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.getextrema()[3][0] >= 255:
        rgba = _make_edge_background_transparent(rgba)
    else:
        rgba = _remove_dominant_edge_background(rgba)
    alpha = rgba.getchannel("A").filter(ImageFilter.MedianFilter(size=3))
    rgba.putalpha(alpha)
    rgba = _remove_probable_checker_background(rgba)
    rgba = _fill_internal_alpha_holes(rgba)
    rgba = _remove_alpha_speckles(rgba)
    rgba = _remove_large_neutral_background_components(rgba)
    return rgba


def _image_bytes_to_png(content: bytes) -> bytes:
    image = Image.open(io.BytesIO(content)).convert("RGBA")
    image = _repair_sprite_alpha(image)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def remove_background_with_gemini(content: bytes) -> bytes:
    prompt = (
        "Background removal task for production game art. Keep the complete foreground object or character exactly as it appears, "
        "including all clothing, hair, hands, feet, cape, ornaments, highlights, and bright white or pale details. "
        "Remove only the actual background and return a PNG with a transparent alpha channel. "
        "Do not hollow out the subject. Do not erase holes inside clothes, armor, skin, hair, weapons, decorations, or effects. "
        "Do not change the object's shape, color, style, pose, texture, proportions, or edges. "
        "Do not add shadows, borders, text, logos, UI, scenery, or a replacement background."
    )
    return _image_bytes_to_png(_generate_image_edit(content, prompt))


ACTION_PROMPTS = {
    "idle": "neutral standing idle pose with subtle breathing, readable RPG sprite silhouette, feet planted",
    "walk": "simple walk-cycle pose, one foot forward and one foot back, arms naturally balanced, feet anchor stable",
    "run": "simple running pose, forward lean and bent knees, readable athletic stride, feet anchor stable",
    "attack": "basic humanoid melee attack wind-up or slash pose with normal human hands and clenched fists, no claws",
    "skill": "focused casting or skill-ready pose with normal human hands, strong body expression, no effects",
    "hurt": "clear hurt recoil pose, torso leaning back slightly, normal human hands, full body visible",
    "death": "defeated falling or kneeling pose, full body visible and uncropped, no gore",
}


def _build_action_prompt(action: str, index: int, count: int, canvas_size: int, pixel_art: bool) -> str:
    style_hint = (
        "Keep crisp pixel-art edges, pixel scale, and hard readable silhouettes."
        if pixel_art
        else "Keep clean high-quality game character rendering."
    )
    return (
        "Create a production-ready 2D RPG character animation frame from the uploaded image. "
        "Use the uploaded image as the exact character identity reference. "
        f"Generate frame {index + 1} of {count} for a {ACTION_PROMPTS.get(action, action)}. "
        "Keep the same face, hair, clothing, colors, body proportions, art style, and character scale. "
        f"Return one single transparent-background PNG on a square {canvas_size}x{canvas_size} canvas. "
        "The full body must be visible, including complete hair, hat, hands, feet, cape, and all ornaments. "
        "Leave at least 24 pixels of transparent padding above the head and around the widest body/cape edges. "
        "The character must stay horizontally centered with a stable feet anchor near 84% canvas height. "
        "The result must be a normal humanoid martial RPG sprite. "
        "Do not create claw hands, dragon claws, monster fingers, animal paws, mutated hands, extra fingers, extra limbs, or oversized hands. "
        "Do not add weapons, blades, magic weapons, glowing weapons, attack effects, green energy, text, logos, UI, borders, background scenery, shadows, or watermarks. "
        "Do not hollow out any body, clothing, armor, cape, hair, or ornament areas; keep the subject solid with a clean alpha channel. "
        f"{style_hint}"
    )


def _save_canvas_png(content: bytes, output_path: Path, canvas_size: int) -> None:
    image = Image.open(io.BytesIO(content)).convert("RGBA")
    image = _repair_sprite_alpha(image)
    if image.size == (canvas_size, canvas_size):
        _repair_sprite_alpha(image).save(output_path, "PNG")
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
    canvas = _repair_sprite_alpha(canvas)
    canvas.save(output_path, "PNG")


def generate_character_action_candidates_with_gemini(
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
    if not get_gemini_api_key():
        raise GeminiProviderError("AI_PROVIDER_NOT_CONFIGURED", "GEMINI_API_KEY is not configured.")

    output_dir.mkdir(parents=True, exist_ok=True)
    model = get_gemini_image_model()
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

    def _generate_one(item: dict) -> dict:
        action = item["action"]
        index = item["frame_index"]
        count = item["frame_count"]
        image_bytes = _generate_image_edit(
            base_png,
            _build_action_prompt(action, index, count, canvas_size, pixel_art),
        )
        filename = f"{action}_{index + 1:03d}.png"
        out_path = output_dir / filename
        _save_canvas_png(image_bytes, out_path, canvas_size)
        return {
            "id": f"{action}_{index + 1:03d}",
            "action": action,
            "frame_index": index,
            "filename": filename,
            "url": "",
            "provider": "gemini",
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
        "provider": "gemini",
        "model": model,
    }
