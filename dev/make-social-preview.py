"""
Render the social preview card for @nashihang777/dsh-talent-workbench.

1280x640 is GitHub's social-preview size. Everything is drawn at 2x and
downsampled, so text edges stay clean without relying on font hinting.

Style: deep navy field, faint engineering grid, cyan/teal accents, a stylised
preview of the workbench on the right (weighted dimension bars, a candidate row
with a score ring, and the local hash-chain ledger underneath).
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

W, H = 1280, 640
S = 2  # supersample factor
W2, H2 = W * S, H * S

NAVY_DEEP = (7, 11, 22)
NAVY = (11, 19, 33)
PANEL = (17, 27, 44)
INK = (233, 240, 248)
MUTED = (148, 163, 184)
CYAN = (56, 189, 248)
CYAN_DIM = (14, 165, 233)
TEAL = (52, 211, 153)
AMBER = (251, 191, 36)
HAIR = (44, 63, 88)


def font(path, size):
    return ImageFont.truetype(path, int(size * S))


MSYH = "C:/Windows/Fonts/msyh.ttc"
MSYH_BD = "C:/Windows/Fonts/msyhbd.ttc"
MSYH_LT = "C:/Windows/Fonts/msyhl.ttc"
MONO = "C:/Windows/Fonts/consola.ttf"
MONO_BD = "C:/Windows/Fonts/consolab.ttf"


def vgrad(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def radial_glow(size, center, radius, color, strength=1.0):
    """Additive-ish glow rendered once and blurred."""
    w, h = size
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)
    cx, cy = center
    steps = 60
    for i in range(steps, 0, -1):
        r = radius * i / steps
        alpha = int(255 * strength * (1 - i / steps) ** 2.2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.10))
    tint = Image.new("RGB", (w, h), color)
    return tint, layer


def paste_glow(base, center, radius, color, strength=1.0):
    tint, mask = radial_glow(base.size, center, radius, color, strength)
    base.paste(tint, (0, 0), mask.point(lambda v: int(v * 0.55)))


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text_w(draw, s, f):
    box = draw.textbbox((0, 0), s, font=f)
    return box[2] - box[0], box[3] - box[1]


img = vgrad((W2, H2), NAVY_DEEP, (10, 17, 30))

# --- atmosphere ------------------------------------------------------------
paste_glow(img, (int(W2 * 0.86), int(H2 * -0.10)), int(W2 * 0.55), (14, 116, 144), 0.95)
paste_glow(img, (int(W2 * 0.06), int(H2 * 1.05)), int(W2 * 0.45), (13, 90, 106), 0.55)
paste_glow(img, (int(W2 * 0.55), int(H2 * 0.55)), int(W2 * 0.30), (12, 74, 110), 0.35)

# --- engineering grid ------------------------------------------------------
grid = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
gd = ImageDraw.Draw(grid)
step = 32 * S
for x in range(0, W2, step):
    gd.line([(x, 0), (x, H2)], fill=(56, 189, 248, 12), width=1)
for y in range(0, H2, step):
    gd.line([(0, y), (W2, y)], fill=(56, 189, 248, 12), width=1)
# heavier rules every 6 cells
for x in range(0, W2, step * 6):
    gd.line([(x, 0), (x, H2)], fill=(56, 189, 248, 20), width=1)
for y in range(0, H2, step * 6):
    gd.line([(0, y), (W2, y)], fill=(56, 189, 248, 20), width=1)
img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")
d = ImageDraw.Draw(img)

# corner brackets: a quiet "frame" cue
bl = 26 * S
pad = 22 * S
for (x, y, dx, dy) in [
    (pad, pad, 1, 1),
    (W2 - pad, pad, -1, 1),
    (pad, H2 - pad, 1, -1),
    (W2 - pad, H2 - pad, -1, -1),
]:
    d.line([(x, y), (x + dx * bl, y)], fill=(56, 189, 248, 90), width=2 * S)
    d.line([(x, y), (x, y + dy * bl)], fill=(56, 189, 248, 90), width=2 * S)

# --- left column -----------------------------------------------------------
LX = 76 * S
# eyebrow pill
f_eyebrow = font(MONO_BD, 15)
label = "DEEPSEEK HARNESS  ·  PLUGIN"
tw, th = text_w(d, label, f_eyebrow)
padx, pady = 16 * S, 9 * S
rounded(d, [LX, 78 * S, LX + tw + padx * 2, 78 * S + th + pady * 2], (th + pady * 2) // 2,
        fill=(15, 32, 52), outline=(34, 78, 108), width=2 * S)
d.text((LX + padx, 78 * S + pady - 2 * S), label, font=f_eyebrow, fill=CYAN)

# title (Chinese) with a cyan dot accent
f_title = font(MSYH_BD, 66)
title = "人才匹配工作台"
d.text((LX - 3 * S, 132 * S), title, font=f_title, fill=INK)
dot_cx = LX + text_w(d, title, f_title)[0] + 16 * S
d.ellipse([dot_cx, 132 * S + 40 * S, dot_cx + 13 * S, 132 * S + 53 * S], fill=TEAL)

# latin subtitle
f_sub = font(MONO, 25)
d.text((LX, 224 * S), "Talent Matching Workbench", font=f_sub, fill=(125, 211, 252))

# divider
d.line([(LX, 268 * S), (LX + 470 * S, 268 * S)], fill=(56, 189, 248, 70), width=2 * S)

# one-liner
f_line = font(MSYH, 21)
lines = [
    "19 个独立考察维度 · 13 个岗位模板 · 逐维可解释推导",
    "简历批量导入 · 智能体识别字段 · 数据不出本机",
]
y = 290 * S
for line in lines:
    d.text((LX, y), line, font=f_line, fill=(203, 213, 225))
    y += 33 * S

# chips
f_chip = font(MONO_BD, 15)
chips = [("LOCAL-FIRST", TEAL), ("MIT", (148, 163, 184)), ("npm", (251, 191, 36))]
cx = LX
chy = 380 * S
for text, color in chips:
    tw, th = text_w(d, text, f_chip)
    w = tw + 22 * S
    rounded(d, [cx, chy, cx + w, chy + th + 16 * S], (th + 16 * S) // 2,
            fill=(14, 26, 42), outline=(40, 62, 88), width=2 * S)
    d.text((cx + 11 * S, chy + 7 * S), text, font=f_chip, fill=color)
    cx += w + 10 * S

# repo line
f_repo = font(MONO, 17)
d.text((LX, 470 * S), "@nashihang777/dsh-talent-workbench", font=f_repo, fill=(148, 163, 184))
d.text((LX, 500 * S), "github.com/nashihang777/dsh-talent-workbench", font=font(MONO, 15), fill=(100, 116, 139))

# --- right column: workbench mock ------------------------------------------
PX, PY = 612 * S, 92 * S
PW, PH = 596 * S, 456 * S

# soft shadow
shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle([PX + 6 * S, PY + 14 * S, PX + PW + 6 * S, PY + PH + 14 * S], radius=22 * S, fill=(0, 0, 0, 120))
shadow = shadow.filter(ImageFilter.GaussianBlur(18 * S))
img = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")
d = ImageDraw.Draw(img)

rounded(d, [PX, PY, PX + PW, PY + PH], 22 * S, fill=PANEL, outline=(45, 65, 92), width=2 * S)

# panel header
d.text((PX + 26 * S, PY + 22 * S), "筛选推导", font=font(MSYH_BD, 20), fill=INK)
d.text((PX + 118 * S, PY + 27 * S), "· v1.6.1", font=font(MONO, 15), fill=(100, 116, 139))
# traffic dots
for i, c in enumerate([(248, 113, 113), (251, 191, 36), (52, 211, 153)]):
    d.ellipse([PX + PW - 74 * S + i * 20 * S, PY + 26 * S, PX + PW - 62 * S + i * 20 * S, PY + 38 * S], fill=c)

d.line([(PX + 20 * S, PY + 58 * S), (PX + PW - 20 * S, PY + 58 * S)], fill=(40, 56, 80), width=2 * S)

# candidate row
rounded(d, [PX + 20 * S, PY + 72 * S, PX + PW - 20 * S, PY + 132 * S], 12 * S, fill=(21, 33, 52), outline=(48, 68, 96), width=2 * S)
d.text((PX + 38 * S, PY + 88 * S), "候选人 A", font=font(MSYH_BD, 19), fill=INK)
d.text((PX + 38 * S, PY + 111 * S), "材料科学与工程 · 博士 · 示例大学 A", font=font(MSYH, 14), fill=(148, 163, 184))

# score ring
ring_cx, ring_cy, ring_r = PX + PW - 62 * S, PY + 102 * S, 24 * S
d.arc([ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r], start=-90, end=250, fill=TEAL, width=5 * S)
d.arc([ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r], start=250, end=270, fill=(45, 62, 88), width=5 * S)
d.text((ring_cx - 17 * S, ring_cy - 12 * S), "87", font=font(MONO_BD, 23), fill=INK)

# dimension bars
bars = [
    ("技术栈匹配度", 0.92, CYAN),
    ("学术水平预估", 0.78, CYAN),
    ("科研经历深度", 0.71, CYAN),
    ("补齐落地短板", 0.44, AMBER),
    ("跨学科", 0.35, (148, 163, 184)),
]
by = PY + 150 * S
bar_x = PX + 150 * S
bar_w = PW - 210 * S
for name, ratio, color in bars:
    d.text((PX + 26 * S, by - 9 * S), name, font=font(MSYH, 15), fill=(203, 213, 225))
    rounded(d, [bar_x, by - 5 * S, bar_x + bar_w, by + 5 * S], 5 * S, fill=(28, 42, 62))
    w = int(bar_w * ratio)
    rounded(d, [bar_x, by - 5 * S, bar_x + max(w, 10 * S), by + 5 * S], 5 * S, fill=color)
    d.text((bar_x + bar_w + 12 * S, by - 11 * S), f"{int(ratio * 100)}", font=font(MONO_BD, 15), fill=color)
    by += 36 * S

# weight note
# Consolas has no CJK glyphs, so this line uses the CJK face.
d.text((PX + 26 * S, PY + 340 * S), "权重归一化  Σ=1.00    ·    门槛 0.60    ·    推荐线 70",
       font=font(MSYH, 15), fill=(110, 128, 152))

# hash chain strip
chain_y = PY + 372 * S
d.line([(PX + 20 * S, chain_y - 14 * S), (PX + PW - 20 * S, chain_y - 14 * S)], fill=(40, 56, 80), width=2 * S)
d.text((PX + 26 * S, chain_y), "本地账本 · SHA-256 哈希链", font=font(MSYH, 14), fill=(148, 163, 184))
prev = None
node_y = chain_y + 40 * S
for i in range(6):
    nx = PX + 46 * S + i * 92 * S
    if prev is not None:
        d.line([(prev, node_y), (nx - 12 * S, node_y)], fill=(52, 211, 153, 150), width=2 * S)
    d.ellipse([nx - 8 * S, node_y - 8 * S, nx + 8 * S, node_y + 8 * S], fill=TEAL if i < 5 else CYAN)
    d.text((nx - 20 * S, node_y + 16 * S), f"#{i + 1:02d}", font=font(MONO, 12), fill=(100, 116, 139))
    prev = nx + 8 * S

# --- downsample and save ---------------------------------------------------
out = img.resize((W, H), Image.LANCZOS)
out.save("assets/social-preview.png", "PNG", optimize=True)
print("saved assets/social-preview.png", out.size)
