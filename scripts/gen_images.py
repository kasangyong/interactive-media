"""로컬 sd-turbo 로 사이트 이미지 생성 (public/img/*.jpg).

사용: python scripts/gen_images.py [name ...]
캐시된 stabilityai/sd-turbo 를 오프라인으로 로드한다.
"""
import sys
from pathlib import Path

import torch
from diffusers import AutoPipelineForText2Image

OUT = Path(__file__).resolve().parent.parent / "public" / "img"
STYLE = ", minimal composition, cinematic lighting, soft film grain, high detail, editorial photography"

PROMPTS = {
    # 패럴랙스 레이어 (밝은 배경의 오브젝트)
    "parallax-1": "glossy chrome liquid metal blob sculpture floating, light grey seamless studio background",
    "parallax-2": "translucent frosted glass spheres stacked, pale grey studio background, cobalt blue reflections",
    "parallax-3": "matte white abstract curved architecture, long shadows, pale grey sky",
    "parallax-4": "cobalt blue ribbon of silk flowing in the air, light grey studio background",
    # 타임라인
    "tl-1963": "vintage 1960s vector display CRT screen glowing green lines, light pen touching the glass, dark lab",
    "tl-1968": "prototype wooden computer mouse with one button on a desk next to keyboard, 1960s, warm light",
    "tl-1974": "glowing colorful human silhouette projected on a wall, interactive video art installation, dark room",
    "tl-1989": "early computer terminal showing hyperlinked text pages, network cables, 1990 office, blue glow",
    "tl-1996": "colorful vector animation on a 1990s CRT monitor, playful shapes, bright saturated colors",
    "tl-2010": "abstract 3D wireframe mesh glowing in a web browser window, neon blue on black",
    "tl-2016": "person wearing a virtual reality headset in a dark room lit by blue light, from behind",
    "tl-2020": "neural network abstract visualization, glowing particles flowing, deep black background, lime green",
    # OG / 폴백
    "og": "iridescent blue noise-distorted sphere floating in deep black space with stars",
}


def main() -> None:
    names = sys.argv[1:] or list(PROMPTS)
    OUT.mkdir(parents=True, exist_ok=True)
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sd-turbo", torch_dtype=torch.float16, variant=None, local_files_only=True
    ).to("cuda")
    pipe.set_progress_bar_config(disable=True)
    for i, name in enumerate(names):
        g = torch.Generator("cuda").manual_seed(1000 + i)
        img = pipe(PROMPTS[name] + STYLE, num_inference_steps=2, guidance_scale=0.0, width=512, height=512, generator=g).images[0]
        path = OUT / f"{name}.jpg"
        img.save(path, quality=88)
        print("saved", path.name, flush=True)


if __name__ == "__main__":
    main()
