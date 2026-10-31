# Writes fake-camera.y4m: a drawn portrait (blinking, swaying a little) that Chrome plays as
# its camera, so face checks and other camera screens run in the capture browser.
# Needs Pillow (pip install pillow). Run once: python3 make-camera.py
from PIL import Image, ImageDraw, ImageFilter
import math
W, H, N = 640, 480, 80

def frame(t):
    im = Image.new('RGB', (W, H), (214, 206, 196)); d = ImageDraw.Draw(im)
    for y in range(H):
        c = int(222 - y * 0.06); d.line([(0, y), (W, y)], fill=(c, c - 6, c - 14))
    d.rectangle([430, 40, 610, 230], fill=(232, 238, 242), outline=(190, 186, 180), width=6)
    d.line([(520, 40), (520, 230)], fill=(190, 186, 180), width=5); d.line([(430, 135), (610, 135)], fill=(190, 186, 180), width=5)
    cx = 320 + int(6 * math.sin(t / 6))
    d.ellipse([cx - 190, 330, cx + 190, 620], fill=(34, 62, 120))
    d.polygon([(cx - 38, 330), (cx + 38, 330), (cx, 392)], fill=(236, 236, 236))
    d.rectangle([cx - 34, 280, cx + 34, 345], fill=(120, 78, 52))
    d.ellipse([cx - 92, 110, cx + 92, 320], fill=(132, 86, 58))
    d.chord([cx - 96, 96, cx + 96, 250], 180, 360, fill=(28, 22, 20))
    d.ellipse([cx - 104, 195, cx - 80, 245], fill=(122, 78, 52)); d.ellipse([cx + 80, 195, cx + 104, 245], fill=(122, 78, 52))
    for ex in (cx - 36, cx + 36):
        if t % 40 < 3: d.line([(ex - 14, 214), (ex + 14, 214)], fill=(30, 20, 18), width=4)
        else: d.ellipse([ex - 15, 204, ex + 15, 224], fill=(245, 242, 238)); d.ellipse([ex - 7, 206, ex + 7, 222], fill=(40, 28, 22))
    d.line([(cx - 54, 192), (cx - 20, 188)], fill=(30, 22, 20), width=6); d.line([(cx + 20, 188), (cx + 54, 192)], fill=(30, 22, 20), width=6)
    d.line([(cx, 222), (cx - 8, 262), (cx + 6, 264)], fill=(100, 64, 44), width=4)
    d.arc([cx - 34, 262, cx + 34, 300], 15, 165, fill=(90, 40, 36), width=5)
    return im.filter(ImageFilter.GaussianBlur(0.6))

with open('fake-camera.y4m', 'wb') as f:
    f.write(f'YUV4MPEG2 W{W} H{H} F25:1 Ip A1:1 C420jpeg\n'.encode())
    for t in range(N):
        y, cb, cr = frame(t).convert('YCbCr').split()
        f.write(b'FRAME\n'); f.write(y.tobytes()); f.write(cb.resize((W // 2, H // 2)).tobytes()); f.write(cr.resize((W // 2, H // 2)).tobytes())
print('fake-camera.y4m written')
