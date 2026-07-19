from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "scroll-world" / "real"
OUT = ROOT / "assets" / "scroll-world"


def cover(image, size, focus_y=0.5):
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - size[0]) // 2)
    top = max(0, min(resized.height - size[1], round((resized.height - size[1]) * focus_y)))
    return resized.crop((left, top, left + size[0], top + size[1]))


def finish(image, path, copy_side="left"):
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Color(image).enhance(1.04)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = image.size
    for x in range(width):
        progress = x / max(1, width - 1)
        alpha = int(225 * (1 - progress) ** 2.2) if copy_side == "left" else int(225 * progress ** 2.2)
        draw.line((x, 0, x, height), fill=(5, 6, 7, alpha))
    for y in range(height):
        edge = abs(y / max(1, height - 1) - 0.5) * 2
        draw.line((0, y, width, y), fill=(0, 0, 0, int(80 * edge**2)))
    result = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    result.save(path, "WEBP", quality=88, method=6)


def photo_pair(name, source, desktop_focus=0.5, mobile_focus=0.45):
    image = Image.open(source)
    finish(cover(image, (1920, 1080), desktop_focus), OUT / f"{name}.webp")
    portrait = cover(image, (1080, 1920), mobile_focus)
    finish(portrait, OUT / f"{name}-mobile.webp")


def crest_pair():
    crest = Image.open(SRC / "crest.png").convert("RGBA")
    for size, suffix, scale in [((1920, 1080), "", 0.53), ((1080, 1920), "-mobile", 0.72)]:
        base = Image.new("RGB", size, "#070809")
        glow = Image.new("RGBA", size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        center = (int(size[0] * (0.68 if not suffix else 0.5)), int(size[1] * (0.5 if not suffix else 0.39)))
        radius = int(min(size) * 0.36)
        glow_draw.ellipse((center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius), fill=(218, 41, 28, 115))
        glow = glow.filter(ImageFilter.GaussianBlur(radius // 2))
        base = Image.alpha_composite(base.convert("RGBA"), glow)
        target = int(min(size) * scale)
        ratio = min(target / crest.width, target / crest.height)
        logo = crest.resize((round(crest.width * ratio), round(crest.height * ratio)), Image.Resampling.LANCZOS)
        base.alpha_composite(logo, (center[0] - logo.width // 2, center[1] - logo.height // 2))
        finish(base.convert("RGB"), OUT / f"crest{suffix}.webp")


def players_pair():
    files = ["player-422685.png", "player-863098.png", "player-1070052.png", "player-1292810.png", "player-1358581.png", "player-1073977.png"]
    for size, suffix in [((1920, 1080), ""), ((1080, 1920), "-mobile")]:
        base = Image.new("RGBA", size, "#070809")
        glow = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(glow)
        draw.ellipse((size[0]*0.28, size[1]*0.1, size[0]*1.05, size[1]*0.94), fill=(218, 41, 28, 125))
        base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(int(min(size)*0.16))))
        if suffix:
            positions = [(270, 400, 330), (620, 430, 330), (180, 760, 310), (530, 800, 310), (270, 1110, 330), (620, 1140, 330)]
        else:
            positions = [(780, 260, 310), (1080, 225, 350), (1390, 275, 300), (850, 600, 300), (1160, 570, 330), (1450, 610, 300)]
        for filename, (cx, cy, width) in zip(files, positions):
            person = Image.open(SRC / filename).convert("RGBA")
            ratio = width / person.width
            person = person.resize((width, round(person.height * ratio)), Image.Resampling.LANCZOS)
            diameter = width
            crop_top = max(0, min(person.height - diameter, int(person.height * 0.04)))
            portrait = person.crop((0, crop_top, diameter, crop_top + diameter))
            mask = Image.new("L", (diameter, diameter), 0)
            ImageDraw.Draw(mask).ellipse((8, 8, diameter - 8, diameter - 8), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(2))
            frame = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
            frame.alpha_composite(portrait)
            frame.putalpha(mask)
            ring = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
            ImageDraw.Draw(ring).ellipse((5, 5, diameter - 5, diameter - 5), outline=(245, 225, 34, 210), width=5)
            shadow = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 130)).filter(ImageFilter.GaussianBlur(18))
            base.alpha_composite(shadow, (cx - diameter // 2 + 10, cy + 15))
            base.alpha_composite(frame, (cx - diameter // 2, cy))
            base.alpha_composite(ring, (cx - diameter // 2, cy))
        finish(base.convert("RGB"), OUT / f"players{suffix}.webp")


photo_pair("stadium", SRC / "stadium.webp", 0.52, 0.5)
photo_pair("trophies", SRC / "trophies.jpg", 0.45, 0.42)
photo_pair("kits", SRC / "kits.jpg", 0.68, 0.88)
crest_pair()
players_pair()
