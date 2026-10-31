#!/usr/bin/env python3
"""Build the REDACTED copies of the two FirstBank sample forms.

    python3 scripts/redact-forms.py "<folder holding AOF Individual.PDF and AOF Corporate.PDF>"

Writes fixtures-firstbank/redacted/AOF Individual (redacted).pdf and
AOF Corporate (redacted).pdf: every page re-rendered from pixels (110 dpi) with the
BVN, NIN, account / phone / staff / RC / TIN numbers, e-mails, handwritten notes and
signatures blacked out, so nothing of the original survives under a box. Names,
dates and addresses stay, as in the masked transcription the app reads them with.

The walkthrough shows these pages on screen (public/walkthrough). After rebuilding,
put the new SHA-256s in src/fixtures/redactedCopies.ts — the app finds a copy's
transcription through that map.

Needs pdftoppm (poppler), Pillow and macOS `sips` (this Pillow build has no JPEG
encoder, so pages are converted with sips and the PDF is written by hand).
"""
import glob, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw

DPI = 110
# Boxes in 60-dpi page pixels: page number -> [(x0, y0, x1, y1), ...]
BOXES = {
    'AOF Individual.PDF': {
        1: [(262, 14, 362, 104),    # handwritten existing-account note
            (332, 106, 468, 150),   # BVN / NIN
            (55, 492, 300, 512),    # phone
            (55, 512, 340, 532)],   # e-mail
        2: [(20, 190, 300, 212),    # ID number + issue date
            (85, 518, 230, 538),    # office phone
            (80, 628, 210, 650)],   # next-of-kin mobile
        3: [(10, 178, 330, 202)],   # e-mail
        8: [(150, 285, 235, 335)],  # account holder signature
        9: [(80, 318, 480, 368),    # checked by: name, staff number, signature
            (44, 398, 480, 492),    # authorised by: name, staff number, signature
            (120, 610, 430, 642)],  # officer signatures
        10: [(100, 612, 195, 652)], # authorised signature
    },
    'AOF Corporate.PDF': {
        1: [(288, 44, 388, 102),    # handwritten reference
            (33, 148, 177, 190),    # account number
            (310, 144, 464, 194),   # BVN / NIN
            (168, 256, 307, 284),   # registration number
            (93, 370, 428, 396),    # e-mail
            (93, 416, 237, 439),    # phone
            (93, 435, 337, 456)],   # TIN
        3: [(38, 310, 112, 347), (70, 176, 135, 207)],  # signatures
        7: [(293, 253, 382, 292)],  # signature
        8: [(76, 168, 272, 197),    # BVN
            (80, 203, 238, 232),    # NIN
            (70, 326, 262, 357),    # ID number
            (80, 438, 228, 467),    # phone
            (173, 536, 258, 580)],  # signature
        11: [(68, 126, 168, 160), (103, 396, 178, 427)],  # signatures
        12: [(73, 396, 332, 442),   # checked by: name, staff number, signature
             (38, 476, 302, 527),   # authorised by: name, staff number, signature
             (188, 622, 242, 657), (318, 618, 382, 662)],  # officer signatures
        13: [(86, 296, 472, 320),   # e-mail
             (86, 318, 240, 342),   # mobile
             (118, 486, 242, 542)], # signature
    },
    'sample filled AOP for Corporate Account.pdf': {   # Stanbic IBTC entity form
        1: [(300, 2, 490, 78),      # handwritten branch / account / RM codes
            (210, 162, 335, 184),   # RC number
            (150, 303, 345, 324),   # e-mail
            (148, 358, 265, 378),   # phone
            (148, 375, 295, 395)],  # TIN
        2: [(344, 192, 456, 326),   # director photo
            (55, 322, 410, 388),    # passport number, issue / expiry
            (55, 396, 275, 422),    # BVN
            (95, 538, 245, 562),    # phone
            (95, 558, 350, 584),    # e-mail
            (210, 578, 295, 620)],  # signature
        3: [(338, 150, 445, 286),   # director photo
            (15, 243, 405, 297),    # passport number, issue / expiry
            (35, 303, 210, 329),    # BVN
            (80, 428, 205, 452),    # phone
            (80, 445, 415, 467),    # e-mail
            (195, 483, 270, 517)],  # signature
        4: [(18, 275, 175, 330), (205, 258, 455, 334),   # signatures
            (95, 405, 205, 440), (355, 405, 425, 440),   # signatures
            (55, 518, 145, 548), (55, 582, 150, 618)],   # signatures
        5: [(195, 430, 485, 468),   # phones and e-mails
            (85, 620, 155, 660), (245, 620, 305, 660)],  # signatures
        6: [(35, 250, 155, 272), (215, 236, 405, 262),   # referee account / mobile
            (35, 466, 175, 487), (215, 448, 405, 474),   # referee account / mobile
            (35, 328, 125, 357), (35, 538, 125, 562)],   # signatures
        7: [(105, 310, 235, 334), (105, 340, 245, 362),  # user 1 mobile / e-mail
            (100, 403, 235, 424), (100, 416, 290, 437),  # user 2 mobile / e-mail
            (335, 318, 425, 372), (335, 398, 425, 432)], # signatures
        8: [(335, 190, 465, 252),   # mandate signatures
            (318, 398, 432, 448),   # approval signatures
            (345, 500, 475, 575)],  # verification signature
        12: [(345, 72, 455, 110), (315, 110, 460, 150)],  # signatures
    },
}


def build(src, boxes, out):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', str(DPI), '-png', src, f'{tmp}/p'], check=True)
        pages = []
        for f in sorted(glob.glob(f'{tmp}/p-*.png')):
            n = int(f.rsplit('-', 1)[1].split('.')[0])
            im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im); k = DPI / 60
            for (x0, y0, x1, y1) in boxes.get(n, []):
                d.rectangle((x0 * k - 2, y0 * k - 2, x1 * k + 2, y1 * k + 2), fill='black')
            png = f'{tmp}/r-{n:02d}.png'; im.save(png)
            jpg = png[:-4] + '.jpg'
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', png, '--out', jpg],
                           check=True, capture_output=True)
            pages.append((open(jpg, 'rb').read(), im.size))
    # A minimal PDF: one DCT image per page, sized in points at DPI.
    objs = [None, None]
    kids = []
    for data, (w, h) in pages:
        objs.append(b'<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB '
                    b'/BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n' % (w, h, len(data)) + data + b'\nendstream')
        img = len(objs)
        pw, ph = w * 72 / DPI, h * 72 / DPI
        cs = b'q %.2f 0 0 %.2f 0 0 cm /Im Do Q' % (pw, ph)
        objs.append(b'<< /Length %d >>\nstream\n' % len(cs) + cs + b'\nendstream')
        con = len(objs)
        objs.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Contents %d 0 R '
                    b'/Resources << /XObject << /Im %d 0 R >> >> >>' % (pw, ph, con, img))
        kids.append(len(objs))
    objs[0] = b'<< /Type /Catalog /Pages 2 0 R >>'
    objs[1] = b'<< /Type /Pages /Kids [%s] /Count %d >>' % (b' '.join(b'%d 0 R' % k for k in kids), len(kids))
    buf = bytearray(b'%PDF-1.4\n'); offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b'%d 0 obj\n' % i + o + b'\nendobj\n'
    x = len(buf)
    buf += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
    buf += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, x)
    open(out, 'wb').write(buf)
    print(out, len(buf))


if __name__ == '__main__':
    src_dir = sys.argv[1]
    only = sys.argv[2:]  # optional: just these source files
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'fixtures-firstbank', 'redacted')
    os.makedirs(out_dir, exist_ok=True)
    for name, boxes in BOXES.items():
        if only and name not in only: continue
        if not os.path.exists(os.path.join(src_dir, name)): continue
        if name.startswith('sample filled AOP'):   # the Stanbic IBTC entity form
            dest = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'redacted', 'Stanbic entity AOF - George Emore (redacted).pdf')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
        else:
            dest = os.path.join(out_dir, re.sub(r'\.pdf$', ' (redacted).pdf', name, flags=re.I))
        build(os.path.join(src_dir, name), boxes, dest)
