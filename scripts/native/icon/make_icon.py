# -*- coding: utf-8 -*-
"""Vẽ biểu tượng tạm cho ứng dụng AI Workspace (đám mây + tia sét, theo màu logo iThunder Clouds).
Cần Pillow. Kết quả ghi vào ai-work/assets/ cho `npx tauri icon` và `npx @capacitor/assets generate`.
Khi có biểu tượng chính thức 1024x1024: thay assets/icon-only.png, icon-foreground.png, icon-background.png."""
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "assets")
S = 4                 # vẽ ở 4x rồi thu nhỏ để khử răng cưa
N = 1024 * S
NAVY_TOP, NAVY_BOTTOM = (16, 52, 120), (6, 20, 48)
CLOUD_TOP, CLOUD_BOTTOM = (226, 246, 255), (122, 200, 245)
RED, WHITE = (228, 30, 42), (255, 255, 255)


def vgradient(size, top, bottom):
    w, h = size
    g = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g.resize((w, h))


def cloud_mask(scale=1.0, cx=0.5, cy=0.55):
    m = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(m)
    u = N * scale
    ox, oy = N * cx, N * cy

    def circle(x, y, r):
        d.ellipse((ox + (x - r) * u, oy + (y - r) * u, ox + (x + r) * u, oy + (y + r) * u), fill=255)
    circle(-0.20, 0.03, 0.17)
    circle(0.02, -0.08, 0.24)
    circle(0.22, 0.02, 0.17)
    d.rounded_rectangle((ox - 0.36 * u, oy - 0.02 * u, ox + 0.38 * u, oy + 0.19 * u), radius=0.10 * u, fill=255)
    return m


def bolt(scale=1.0, cx=0.5, cy=0.55):
    u = N * scale
    ox, oy = N * cx, N * cy
    pts = [(0.06, -0.30), (-0.13, 0.04), (-0.01, 0.04), (-0.08, 0.30), (0.14, -0.06), (0.02, -0.06), (0.10, -0.30)]
    return [(ox + x * u, oy + y * u) for x, y in pts]


def foreground(scale):
    """Đám mây + tia sét trên nền trong suốt."""
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    cm = cloud_mask(scale)
    shadow = cm.filter(ImageFilter.GaussianBlur(N * 0.012))
    img.paste(Image.new("RGBA", (N, N), (0, 0, 0, 90)), (0, int(N * 0.012)), shadow)
    img.paste(vgradient((N, N), CLOUD_TOP, CLOUD_BOTTOM).convert("RGBA"), (0, 0), cm)
    d = ImageDraw.Draw(img)
    p = bolt(scale)
    d.line(p + [p[0], p[1]], fill=WHITE, width=int(N * 0.045 * scale), joint="curve")   # viền trắng đều quanh tia sét
    d.polygon(p, fill=RED)
    return img


def background():
    return vgradient((N, N), NAVY_TOP, NAVY_BOTTOM).convert("RGBA")


def down(img, size=1024):
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    # Biểu tượng đầy đủ (Windows, iOS): nền xanh đậm bo góc + đám mây, tia sét
    full = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, N - 1, N - 1), radius=int(N * 0.22), fill=255)
    full.paste(background(), (0, 0), mask)
    full.alpha_composite(foreground(1.0))
    down(full).save(os.path.join(OUT, "icon.png"))
    # iOS không nhận nền trong suốt: bản vuông kín nền
    sq = background()
    sq.alpha_composite(foreground(1.0))
    down(sq).convert("RGB").save(os.path.join(OUT, "icon-only.png"))
    # Android adaptive icon: tiền cảnh nằm trong vùng an toàn 66%, nền riêng
    # Capacitor Assets tự thêm lề 16,7% quanh tiền cảnh: vẽ gần bằng biểu tượng đầy đủ
    down(foreground(1.05)).save(os.path.join(OUT, "icon-foreground.png"))
    down(background()).convert("RGB").save(os.path.join(OUT, "icon-background.png"))
    # Màn hình chờ 2732x2732: nền tối của AI Workspace, biểu tượng ở giữa
    splash = Image.new("RGB", (2732, 2732), (6, 11, 19))
    logo = down(full, 640)
    splash.paste(logo, ((2732 - 640) // 2, (2732 - 640) // 2), logo)
    splash.save(os.path.join(OUT, "splash.png"))
    splash.save(os.path.join(OUT, "splash-dark.png"))
    print("Đã ghi", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
