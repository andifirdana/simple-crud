import io
import json
import math
import os
import subprocess
import sys
import warnings

import pypdfium2 as pdfium
from PIL import Image, ImageOps


MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 10
MAX_PIXELS = 16_000_000

# Batas awal agar teks tidak dipotong diam-diam
# saat masuk ke model lokal.
MAX_TEXT_BYTES = 20_000

Image.MAX_IMAGE_PIXELS = MAX_PIXELS

warnings.simplefilter(
    "error",
    Image.DecompressionBombWarning,
)


def ocr(image):
    if image.width * image.height > MAX_PIXELS:
        raise ValueError(
            "Resolusi gambar terlalu besar untuk OCR lokal."
        )

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="PNG",
    )

    result = subprocess.run(
        [
            "tesseract",
            "stdin",
            "stdout",
            "-l",
            os.environ.get(
                "OCR_LANG",
                "ind+eng",
            ),
            "--psm",
            "3",
        ],
        input=buffer.getvalue(),
        capture_output=True,
        timeout=35,
        env={
            **os.environ,
            "OMP_THREAD_LIMIT": "1",
        },
    )

    if result.returncode != 0:
        raise ValueError(
            "OCR gagal. Pastikan Tesseract serta "
            "bahasa ind dan eng sudah terpasang."
        )

    return result.stdout.decode(
        "utf-8",
        errors="replace",
    ).strip()


def extract(raw):
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError(
            "File kosong atau melebihi 20 MB."
        )

    sections = []
    content_found = False

    if b"%PDF-" in raw[:1024]:
        pdf = pdfium.PdfDocument(raw)

        try:
            if not 1 <= len(pdf) <= MAX_PAGES:
                raise ValueError(
                    "OCR lokal dibatasi maksimal "
                    "10 halaman per dokumen."
                )

            for index in range(len(pdf)):
                page = pdf[index]

                try:
                    textpage = page.get_textpage()

                    try:
                        digital = (
                            textpage
                            .get_text_bounded()
                            .strip()
                        )

                    finally:
                        textpage.close()

                    scale = 200 / 72

                    width, height = page.get_size()

                    pixels = (
                        math.ceil(width * scale)
                        * math.ceil(height * scale)
                    )

                    if pixels > MAX_PIXELS:
                        raise ValueError(
                            "Ukuran halaman PDF terlalu "
                            "besar untuk OCR lokal."
                        )

                    bitmap = page.render(
                        scale=scale
                    )

                    try:
                        image = (
                            bitmap
                            .to_pil()
                            .convert("RGB")
                        )

                        try:
                            scanned = ocr(image)

                        finally:
                            image.close()

                    finally:
                        bitmap.close()

                    content_found = (
                        content_found
                        or bool(
                            digital.strip()
                            or scanned.strip()
                        )
                    )

                    sections.append(
                        f"[HALAMAN {index + 1}]\n"
                        f"TEKS DIGITAL:\n{digital}\n"
                        f"HASIL OCR:\n{scanned}"
                    )

                    current_text = "\n\n".join(
                        sections
                    )

                    if (
                        len(
                            current_text.encode("utf-8")
                        )
                        > MAX_TEXT_BYTES
                    ):
                        raise ValueError(
                            "Teks dokumen melebihi "
                            "kapasitas awal AI lokal. "
                            "Pisahkan dokumen."
                        )

                finally:
                    page.close()

        finally:
            pdf.close()

    else:
        with Image.open(
            io.BytesIO(raw)
        ) as original:
            if (
                original.width * original.height
                > MAX_PIXELS
            ):
                raise ValueError(
                    "Resolusi gambar terlalu "
                    "besar untuk OCR lokal."
                )

            if (
                getattr(
                    original,
                    "n_frames",
                    1,
                )
                != 1
            ):
                raise ValueError(
                    "Gunakan gambar tunggal atau PDF, "
                    "bukan gambar animasi."
                )

            oriented = ImageOps.exif_transpose(
                original
            )

            image = oriented.convert("RGB")

            try:
                image_text = ocr(image)

                content_found = bool(
                    image_text.strip()
                )

                sections.append(image_text)

            finally:
                image.close()
                oriented.close()

    text = "\n\n".join(
        sections
    ).strip()

    if not content_found:
        raise ValueError(
            "Teks dokumen tidak terbaca."
        )

    if (
        len(text.encode("utf-8"))
        > MAX_TEXT_BYTES
    ):
        raise ValueError(
            "Teks dokumen melebihi kapasitas "
            "awal AI lokal. Pisahkan dokumen."
        )

    return text


def main():
    try:
        raw = sys.stdin.buffer.read(
            MAX_BYTES + 1
        )

        text = extract(raw)

        print(
            json.dumps(
                {"text": text},
                ensure_ascii=False,
            )
        )

    except ValueError as error:
        print(
            json.dumps(
                {"error": str(error)},
                ensure_ascii=False,
            )
        )

    except subprocess.TimeoutExpired:
        print(
            json.dumps({
                "error":
                    "OCR terlalu lama. Gunakan "
                    "dokumen yang lebih kecil."
            })
        )

    except Exception:
        print(
            json.dumps({
                "error":
                    "Dokumen tidak dapat dibaca. "
                    "Periksa format file, proteksi "
                    "PDF, dan instalasi OCR."
            })
        )


if __name__ == "__main__":
    main()