import os
import math
import numpy as np
import imageio.v2 as imageio
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join("server", "uploads")
os.makedirs(OUT, exist_ok=True)

try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 30)
    small_font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 17)
except OSError:
    font = ImageFont.load_default()
    small_font = ImageFont.load_default()

W, H = 640, 360
FPS, SECONDS = 20, 5

themes = [
    ("demo-anime.mp4", "ANIME MOTION", (110, 35, 180), (20, 170, 220)),
    ("demo-cinematic.mp4", "CINEMATIC", (15, 35, 70), (220, 110, 45)),
    ("demo-aesthetic.mp4", "SOFT AESTHETIC", (230, 130, 160), (80, 150, 180)),
    ("demo-neon.mp4", "NEON NIGHTS", (120, 15, 120), (10, 210, 190)),
    ("demo-nature.mp4", "AFTER THE RAIN", (15, 100, 90), (120, 180, 210)),
    ("demo-velocity.mp4", "VELOCITY", (20, 30, 100), (220, 40, 80)),
]

for filename, title, c1, c2 in themes:
    path = os.path.join(OUT, filename)
    print("Creating:", filename)

    with imageio.get_writer(
        path,
        fps=FPS,
        codec="libx264",
        pixelformat="yuv420p",
        macro_block_size=16,
        ffmpeg_log_level="error"
    ) as writer:
        for frame_no in range(FPS * SECONDS):
            t = frame_no / (FPS * SECONDS)
            y, x = np.mgrid[0:H, 0:W]
            wave = (np.sin(x / 75 + t * 2 * math.pi) +
                    np.cos(y / 65 - t * 2 * math.pi)) / 4 + 0.5

            arr = np.zeros((H, W, 3), dtype=np.uint8)
            for ch in range(3):
                arr[:, :, ch] = np.clip(
                    c1[ch] * (1 - wave) + c2[ch] * wave, 0, 255
                ).astype(np.uint8)

            img = Image.fromarray(arr, "RGB")
            draw = ImageDraw.Draw(img, "RGBA")

            # Animated light rings
            for i in range(7):
                cx = int(W * (0.15 + i * 0.12 + 0.035 * math.sin(t * 2 * math.pi + i)))
                cy = int(H * (0.3 + 0.2 * math.cos(t * 2 * math.pi + i * 0.7)))
                radius = 18 + int(10 * (1 + math.sin(t * 2 * math.pi + i)))
                draw.ellipse(
                    (cx-radius, cy-radius, cx+radius, cy+radius),
                    outline=(255, 255, 255, 95), width=2
                )

            # Title panel
            draw.rounded_rectangle((28, 120, W-28, 230), radius=18,
                                   fill=(0, 0, 0, 95),
                                   outline=(255, 255, 255, 70), width=1)
            box = draw.textbbox((0, 0), title, font=font)
            text_w = box[2] - box[0]
            draw.text(((W-text_w)//2, 148), title, font=font,
                      fill=(255, 255, 255, 255))
            draw.text((32, 320), "EDITVAULT  /  DEMO PREVIEW",
                      font=small_font, fill=(255, 255, 255, 220))

            writer.append_data(np.asarray(img))

    print("Saved:", path)

print("\nDone! All six demo videos were created.")
