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


    def test_order_cells_keep_excel_row_numbers_and_independent_do_columns(self):
        rows = [
            [label for label, _ in excel.ORDER_HEADERS],
            ["00012", "25/01/2026", 1, "Cabang A", "", ""],
            ["00013", "25/01/2026", 2, "Cabang A", "serial", ""],
            [],
            ["00014", "25/01/2026", 3, "Cabang A", "", "00009"],
            ["", "31/02/2026", 2, "Cabang A", "x", ""],
        ]
        sheet = excel.worksheet(rows).replace(
            '<c r="E3" t="inlineStr"><is><t xml:space="preserve">serial</t></is></c>',
            '<c r="E3" t="n"><v>46053</v></c>',
        )
        book = self.rewrite(self.make_file(), lambda name, data: (
            sheet.encode() if name.endswith('sheet1.xml') else data
        ))
        orders = excel.read_order_workbook(book)

        self.assertEqual([order["baris"] for order in orders], [2, 3, 5, 6])
        self.assertEqual(orders[0]["no_req_klien"], "00012")
        self.assertEqual(orders[0]["tanggal_req_klien"], "2026-01-25")
        self.assertEqual((orders[0]["tanggal_do"], orders[0]["no_do"]), ("", ""))
        self.assertEqual((orders[1]["tanggal_do"], orders[1]["no_do"]), ("2026-01-31", ""))
        self.assertEqual((orders[2]["tanggal_do"], orders[2]["no_do"]), ("", "00009"))
        self.assertEqual(orders[3]["no_req_klien"], "")
        self.assertEqual(set(orders[3]["errors"]), {"tanggal_req_klien", "tanggal_do"})

    def test_order_template_has_import_headers_and_text_columns(self):
        template = excel.write_order_template()
        [(_, header, _)] = excel.read_sheet_rows(template, "Order")
        self.assertEqual([value for value, _, _ in header.values()],
                         [label for label, _ in excel.ORDER_HEADERS])
        with zipfile.ZipFile(io.BytesIO(template)) as archive:
            sheet = excel.ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
            styles = excel.ET.fromstring(archive.read("xl/styles.xml"))
        formats = styles.find(f"{excel.NS}cellXfs")
        text_columns = [column.get("min") for column in sheet.findall(f"{excel.NS}cols/{excel.NS}col")
                        if column.get("style") and formats[int(column.get("style"))].get("numFmtId") == "49"]
        self.assertEqual(text_columns, ["1", "6"])

        populated = excel.worksheet([[], ["00012", "25/11/2026", 2, "Cabang A", "", "00009"]])
        row = populated[populated.index('<row r="2">'):populated.index("</sheetData>")]
        filled_template = self.rewrite(template, lambda name, data: (
            data.replace(b"</sheetData>", row.encode() + b"</sheetData>")
            if name.endswith("sheet1.xml") else data
        ))
        [order] = excel.read_order_workbook(filled_template)
        self.assertEqual((order["no_req_klien"], order["tanggal_req_klien"], order["no_do"], order["errors"]),
                         ("00012", "2026-11-25", "00009", {}))


if __name__ == "__main__":
    unittest.main()
