import importlib.util
import io
from pathlib import Path
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("timeline_excel", ROOT / "timeline-excel.py")
excel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(excel)


class TimelineExcelTests(unittest.TestCase):
    def make_file(self, **changes):
        row = {"deskripsi": "Lisensi router", "tanggal_mulai": "2026-01-01",
               "tanggal_akhir": "2026-12-31", "status": "Aktif", **changes}
        return excel.write_workbook({"rows": [row], "projects": []})

    def rewrite(self, raw, change):
        output = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(raw)) as source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
            for name in source.namelist():
                target.writestr(name, change(name, source.read(name)))
        return output.getvalue()

    def test_round_trip_without_project(self):
        record = excel.read_workbook(self.make_file())[0]
        self.assertEqual(record["proyek_id"], "")
        self.assertEqual(record["deskripsi"], "Lisensi router")
        self.assertEqual(record["tanggal_mulai"], "2026-01-01")
        self.assertEqual(record["baris"], 2)

    def test_text_preserves_formula_like_strings_and_zeroes(self):
        for value in ["=SUM(A1:A2)", "+628123", "0000123", "<img>&\"'", "Baris 1\nBaris 2"]:
            with self.subTest(value=value):
                self.assertEqual(excel.read_workbook(self.make_file(deskripsi=value))[0]["deskripsi"], value)

    def test_template_has_separate_project_and_instruction_sheets(self):
        raw = excel.write_workbook({"rows": [], "projects": [{"id": 9, "nama_proyek": "Pilihan", "jenis_proyek": "Sewa"}]})
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(len([n for n in archive.namelist() if n.startswith("xl/worksheets/")]), 3)
            self.assertIn(b"Pilihan", archive.read("xl/worksheets/sheet2.xml"))
        with self.assertRaisesRegex(ValueError, "belum berisi data"):
            excel.read_workbook(raw)

    def test_native_excel_date_and_1904_epoch(self):
        raw = self.make_file()
        old = b'<c r="F2" t="inlineStr"><is><t xml:space="preserve">2026-01-01</t></is></c>'
        raw = self.rewrite(raw, lambda name, content: content.replace(old, b'<c r="F2"><v>46023</v></c>') if name.endswith('sheet1.xml') else content)
        self.assertEqual(excel.read_workbook(raw)[0]["tanggal_mulai"], "2026-01-01")
        raw = self.rewrite(raw, lambda name, content: content.replace(b'<sheets>', b'<workbookPr date1904="1"/><sheets>') if name == 'xl/workbook.xml' else content)
        self.assertEqual(excel.read_workbook(raw)[0]["tanggal_mulai"], "2030-01-02")

    def test_shared_strings(self):
        raw = self.make_file()
        old = b'<c r="E2" t="inlineStr"><is><t xml:space="preserve">Lisensi router</t></is></c>'
        raw = self.rewrite(raw, lambda name, content: content.replace(old, b'<c r="E2" t="s"><v>0</v></c>') if name.endswith('sheet1.xml') else content)
        output = io.BytesIO(raw)
        with zipfile.ZipFile(output, "a") as archive:
            archive.writestr('xl/sharedStrings.xml', f'<sst xmlns="{excel.NS[1:-1]}"><si><t>Shared &amp; text</t></si></sst>')
        self.assertEqual(excel.read_workbook(output.getvalue())[0]['deskripsi'], "Shared & text")

    def test_formula_rejected(self):
        raw = self.rewrite(self.make_file(), lambda name, content: content.replace(b'<c r="E2"', b'<c r="E2"')
                           .replace(b'<is><t xml:space="preserve">Lisensi router', b'<f>SUM(A1:A2)</f><is><t xml:space="preserve">Lisensi router')
                           if name.endswith('sheet1.xml') else content)
        with self.assertRaisesRegex(ValueError, "ganti rumus"):
            excel.read_workbook(raw)

    def test_required_headers_and_duplicate_headers(self):
        for replacement in [b"Deskripsi lain", b"Tanggal Mulai"]:
            raw = self.rewrite(self.make_file(), lambda name, content: content.replace(b'>Deskripsi<', b'>' + replacement + b'<') if name.endswith('sheet1.xml') else content)
            with self.assertRaises(ValueError):
                excel.read_workbook(raw)

    def test_corrupt_large_and_entity_files_rejected(self):
        for raw in [b"", b"not a zip", b"x" * (excel.MAX_FILE + 1)]:
            with self.assertRaises(Exception):
                excel.read_workbook(raw)
        raw = self.rewrite(self.make_file(), lambda name, content: b'<!DOCTYPE worksheet [<!ENTITY x "x">]>' + content if name.endswith('sheet1.xml') else content)
        with self.assertRaisesRegex(ValueError, "XML"):
            excel.read_workbook(raw)

    def test_import_row_limit(self):
        raw = excel.write_workbook({"rows": [{"deskripsi": "x", "tanggal_mulai": "2026-01-01", "tanggal_akhir": "2026-12-31"}] * 2001})
        with self.assertRaisesRegex(ValueError, "2000"):
            excel.read_workbook(raw)

    def test_oversized_cell_rejected(self):
        with self.assertRaisesRegex(ValueError, "2000 karakter"):
            excel.read_workbook(self.make_file(deskripsi="x" * 2001))

    def test_macro_file_rejected(self):
        buffer = io.BytesIO(self.make_file())
        with zipfile.ZipFile(buffer, "a") as archive:
            archive.writestr('xl/vbaProject.bin', b'fake')
        with self.assertRaisesRegex(ValueError, "macro"):
            excel.read_workbook(buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
