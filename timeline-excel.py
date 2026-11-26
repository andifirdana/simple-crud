"""Read/write bounded XLSX files using the Python standard library only."""

import datetime as dt
import io
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
HEADERS = [
    ("ID Timeline", "id_timeline"), ("ID Proyek", "proyek_id"),
    ("Nama Proyek", "nama_proyek"), ("Jenis Proyek", "jenis_proyek"),
    ("Deskripsi", "deskripsi"), ("Tanggal Mulai", "tanggal_mulai"),
    ("Tanggal Akhir", "tanggal_akhir"), ("Status", "status"),
    ("Sumber", "sumber_timeline"), ("No Req Klien", "no_req_klien"),
    ("Lokasi", "nama_cabang"), ("Produk", "item_produk"), ("Qty", "quantity"),
]
ORDER_HEADERS = [
    ("No Req Klien", "no_req_klien"), ("Tanggal Req Klien", "tanggal_req_klien"),
    ("Quantity", "quantity"), ("Lokasi", "lokasi"),
    ("Tanggal DO", "tanggal_do"), ("No DO", "no_do"),
]
MAX_FILE = 10 * 1024 * 1024
MAX_XML = 32 * 1024 * 1024
MAX_EXPANDED = 50 * 1024 * 1024
MAX_ROWS = 2000


def column_name(index):
    result = ""
    while index:
        index, digit = divmod(index - 1, 26)
        result = chr(65 + digit) + result
    return result


def xml_text(value):
    text = "" if value is None else str(value)
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", text):
        raise ValueError("Teks mengandung karakter yang tidak didukung Excel.")
    return escape(text, {'"': "&quot;", "'": "&apos;"})


def worksheet(rows, *, widths=(24,) * 13, text_columns=(), money_columns=(), number_columns=()):
    columns = []
    for index, width in enumerate(widths, 1):
        style = ' style="2"' if index in text_columns else ''
        columns.append(f'<col min="{index}" max="{index}" width="{width}" customWidth="1"{style}/>')
    parts = [f'<worksheet xmlns="{NS[1:-1]}">',
             '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" '
             'topLeftCell="A2" state="frozen"/></sheetView></sheetViews>',
             '<cols>' + ''.join(columns) + '</cols>',
             '<sheetData>']
    for row_index, row in enumerate(rows, 1):
        parts.append(f'<row r="{row_index}">')
        for col_index, value in enumerate(row, 1):
            cell = f'{column_name(col_index)}{row_index}'
            numeric = col_index in money_columns or col_index in number_columns
            if row_index > 1 and numeric and isinstance(value, (int, float)):
                style = ' s="3"' if col_index in money_columns else ''
                parts.append(f'<c r="{cell}"{style}><v>{value}</v></c>')
                continue
            # Inline strings keep leading zeroes and prevent formula injection.
            style = ' s="1"' if row_index == 1 else ""
            parts.append(f'<c r="{cell}" t="inlineStr"{style}>'
                         f'<is><t xml:space="preserve">{xml_text(value)}</t></is></c>')
        parts.append('</row>')
    parts.append('</sheetData></worksheet>')
    return ''.join(parts)


def write_workbook(payload):
    timeline = [[label for label, _ in HEADERS]]
    timeline.extend([[row.get(key, "") for _, key in HEADERS] for row in payload.get("rows", [])])
    projects = [["ID Proyek", "Nama Proyek", "Jenis Proyek"]]
    projects.extend([[p["id"], p["nama_proyek"], p.get("jenis_proyek", "")]
                     for p in payload.get("projects", [])])
    instructions = [["Petunjuk", "Keterangan"],
                    ["Upload", "Isi sheet Timeline. Maksimal 2000 baris dan 10 MB per file."],
                    ["Proyek opsional", "ID Proyek dan Nama Proyek boleh kosong. Assign melalui Edit di halaman Jangka Waktu."],
                    ["Pilih proyek", "Isi ID dari sheet Pilihan Proyek, atau nama proyek yang cocok persis dan tidak ambigu."],
                    ["Kolom wajib", "Deskripsi, Tanggal Mulai, Tanggal Akhir."],
                    ["Tanggal", "Gunakan YYYY-MM-DD, contoh 2026-12-31. Tanggal Excel juga diterima."],
                    ["Status", "Aktif, Berakhir, Diperpanjang, atau Selesai. Kosong berarti Aktif."],
                    ["Jenis Proyek", "Boleh diisi untuk data tanpa proyek. Setelah assign mengikuti jenis proyek yang dipilih."],
                    ["Data baru", "Upload menambah data baru. ID Timeline harus kosong. File unduhan data adalah arsip, bukan template upload."],
                    ["Kolom sewa", "Sumber, No Req Klien, Lokasi, Produk, dan Qty adalah informasi unduhan data sewa. Kosongkan saat upload."],
                    ["Pengulangan", "Baris upload yang sama dari pengguna yang sama tidak ditambahkan dua kali."],
                    ["Contoh Deskripsi", "Perpanjangan lisensi perangkat"],
                    ["Contoh Tanggal Mulai", "2026-01-01"],
                    ["Contoh Tanggal Akhir", "2026-12-31"]]
    sheets = [("Timeline", timeline), ("Pilihan Proyek", projects), ("Petunjuk", instructions)]
    return write_sheets([(name, worksheet(rows)) for name, rows in sheets])


def write_order_template():
    headers = [[label for label, _ in ORDER_HEADERS]]
    instructions = [
        ["Kolom", "Cara mengisi"],
        ["Order baru", "Wajib isi No Req Klien, Tanggal Req Klien, Quantity, dan Lokasi."],
        ["Update order", "Isi No Req Klien dan kolom yang ingin diubah. Pilih order tujuan di preview jika nomornya sama."],
        ["Opsional", "Tanggal DO dan No DO boleh diisi secara terpisah atau dikosongkan."],
        ["Tanggal", "Gunakan tanggal Excel atau DD/MM/YYYY, misalnya 25/11/2026."],
        ["Quantity", "Gunakan bilangan bulat positif."],
        ["Lokasi", "Gunakan nama yang tersedia pada daftar Lokasi di form Order."],
        ["Nomor", "Kolom No Req Klien dan No DO berformat Teks agar nol di depan tetap tersimpan."],
        ["Unggah", f"Isi sheet Order mulai baris 2. Maksimal {MAX_ROWS} baris dan 10 MB per file."],
    ]
    return write_sheets([
        ("Order", worksheet(headers, widths=(24,) * len(ORDER_HEADERS), text_columns=(1, 6))),
        ("Petunjuk", worksheet(instructions, widths=(20, 90))),
    ])


def write_sheets(sheets):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                    for i in range(1, len(sheets) + 1)) + '</Types>')
        archive.writestr('_rels/.rels',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>')
        archive.writestr('xl/workbook.xml',
            f'<workbook xmlns="{NS[1:-1]}" xmlns:r="{REL[1:-1]}"><sheets>' +
            ''.join(f'<sheet name="{xml_text(name)}" sheetId="{i}" r:id="rId{i}"/>'
                    for i, (name, _) in enumerate(sheets, 1)) + '</sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            ''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                    for i in range(1, len(sheets) + 1)) +
            '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>')
        archive.writestr('xl/styles.xml',
            f'<styleSheet xmlns="{NS[1:-1]}">'
            '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0.00"/></numFmts>'
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
            '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4">'
            '<xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
        for i, (_, sheet_xml) in enumerate(sheets, 1):
            archive.writestr(f'xl/worksheets/sheet{i}.xml', sheet_xml)
    return buffer.getvalue()


def write_projection(payload):
    months = payload['bulan']
    report = [["Nama Proyek", "Jenis Proyek", "Nama Proyek (Proyeksi)", "Kenaikan (%)", *months, "Total"]]
    details = [["Nama Proyek", "Jenis Proyek", "Nama Proyek (Proyeksi)", "Bulan", "Tanggal Proyeksi", "Termin",
                "Nominal Awal", "Nominal Proyeksi"]]
    for project in payload['rows']:
        identitas = [project['nama_proyek'], project['jenis_proyek'], project['nama_proyek_proyeksi']]
        cells = project['bulan']
        report.append([*identitas, project['persentase_kenaikan'],
                       *[cell['nominal'] if cell else None for cell in cells], project['total']])
        for month, cell in zip(months, cells):
            if cell:
                details.extend([*identitas, month, entry['tanggal'], entry['nama'], entry['nominal_awal'], entry['nominal']]
                               for entry in cell['termin'])
    report.append(["Total Proyeksi", "", "", "", *([None] * len(months)), payload['ringkasan']['total']])
    return write_sheets([
        ("Proyeksi Pendapatan", worksheet(report, widths=(42, 23, 42, 18) + (22,) * 13,
                                          money_columns=range(5, 18), number_columns=(4,))),
        ("Rincian Termin", worksheet(details, widths=(42, 23, 42, 18, 24, 30, 24, 24), money_columns=(7, 8))),
    ])


def read_sheet_rows(raw, preferred_sheet):
    if not raw or len(raw) > MAX_FILE:
        raise ValueError("File Excel kosong atau melebihi 10 MB.")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if (len(entries) > 200 or len({e.filename for e in entries}) != len(entries)
                or sum(e.file_size for e in entries) > MAX_EXPANDED
                or any(e.file_size > MAX_XML or e.flag_bits & 1 for e in entries)):
            raise ValueError("Ukuran isi atau struktur file Excel tidak didukung.")
        if any(e.filename.lower().endswith('vbaproject.bin') for e in entries):
            raise ValueError("File dengan macro tidak didukung.")

        def read_xml(name):
            content = archive.read(name)
            markup = content.upper().replace(b'\0', b'')
            if b'<!DOCTYPE' in markup or b'<!ENTITY' in markup:
                raise ValueError("Struktur XML pada file tidak didukung.")
            return ET.fromstring(content)

        book = read_xml('xl/workbook.xml')
        props = book.find(f'{NS}workbookPr')
        date1904 = props is not None and props.get('date1904') in ('1', 'true')
        relationships = read_xml('xl/_rels/workbook.xml.rels')
        targets = {r.get('Id'): r for r in relationships}
        sheets = list(book.findall(f'{NS}sheets/{NS}sheet'))
        if not sheets:
            raise ValueError(f"Sheet {preferred_sheet} tidak ditemukan.")
        sheet = next((s for s in sheets if s.get('name', '').strip().casefold() == preferred_sheet.casefold()), sheets[0])
        relation = targets.get(sheet.get(f'{REL}id'))
        if relation is None or relation.get('TargetMode') == 'External':
            raise ValueError("Sheet Excel tidak valid.")
        target = relation.get('Target', '')
        path = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'xl/' + target)
        if not path.startswith('xl/'):
            raise ValueError("Lokasi sheet Excel tidak valid.")
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(t.text or '' for t in si.iter(f'{NS}t'))
                      for si in read_xml('xl/sharedStrings.xml').findall(f'{NS}si')]
        sheet_xml = read_xml(path)
        for row_index, row in enumerate(sheet_xml.findall(f'{NS}sheetData/{NS}row'), 1):
            row_number = row.get('r')
            values = {}
            for cell in row.findall(f'{NS}c'):
                ref = re.fullmatch(r'([A-Z]+)([1-9]\d*)', cell.get('r', ''))
                if not ref:
                    raise ValueError("Koordinat sel Excel tidak valid.")
                row_number = row_number or ref.group(2)
                col = 0
                for letter in ref.group(1):
                    col = col * 26 + ord(letter) - 64
                if col > 100:
                    raise ValueError(f"Terlalu banyak kolom pada sheet {preferred_sheet}.")
                value = cell.findtext(f'{NS}v', '')
                kind = cell.get('t', 'n')
                error = None
                if kind == 's':
                    index = int(value)
                    if not 0 <= index < len(shared):
                        raise ValueError("Referensi teks pada sel Excel tidak valid.")
                    value = shared[index]
                elif kind == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.iter(f'{NS}t'))
                elif kind == 'e':
                    error = "terdapat sel error."
                if cell.find(f'{NS}f') is not None:
                    error = "ganti rumus dengan nilai sebelum upload."
                elif len(value) > 2000:
                    error = "isi sel maksimal 2000 karakter."
                    value = value[:2000]
                values[col] = (value.strip(), kind, error)
            yield int(row_number or row_index), values, date1904


def excel_serial_date(value, date1904):
    serial = float(value)
    if not date1904 and int(serial) == 60:
        raise ValueError("Tanggal Excel 1900-02-29 tidak valid.")
    base = dt.datetime(1904, 1, 1) if date1904 else dt.datetime(1899, 12, 30)
    if not date1904 and serial < 60:
        base = dt.datetime(1899, 12, 31)
    return (base + dt.timedelta(days=serial)).date().isoformat()


def read_workbook(raw):
    header_map = {label.casefold(): key for label, key in HEADERS}
    header_map.update({key: key for _, key in HEADERS})
    headers = None
    records = []
    total_text_bytes = 0
    for row_number, values, date1904 in read_sheet_rows(raw, 'Timeline'):
        for _, _, error in values.values():
            if error:
                raise ValueError(f"Baris {row_number}: {error}")
        if not any(value for value, _, _ in values.values()):
            continue
        if headers is None:
            headers = {col: header_map.get(value.casefold()) for col, (value, _, _) in values.items()}
            known = [key for key in headers.values() if key]
            if len(known) != len(set(known)):
                raise ValueError("Header Excel tidak boleh berulang.")
            if not {'deskripsi', 'tanggal_mulai', 'tanggal_akhir'}.issubset(known):
                raise ValueError("Gunakan template: header Deskripsi, Tanggal Mulai, dan Tanggal Akhir wajib ada.")
            continue
        record = {'baris': row_number}
        for col, key in headers.items():
            if not key:
                continue
            value, kind, _ = values.get(col, ('', 's', None))
            if key in ('tanggal_mulai', 'tanggal_akhir') and value:
                if kind == 'n':
                    value = excel_serial_date(value, date1904)
                elif re.fullmatch(r'\d{2}/\d{2}/\d{4}', value):
                    value = dt.datetime.strptime(value, '%d/%m/%Y').date().isoformat()
                elif kind == 'd':
                    value = value[:10]
            record[key] = value
        total_text_bytes += sum(len(str(value).encode('utf-8')) for value in record.values())
        if total_text_bytes > 8 * 1024 * 1024:
            raise ValueError("Isi teks terlalu besar. Pisahkan data menjadi beberapa file.")
        records.append(record)
        if len(records) > MAX_ROWS:
            raise ValueError("Maksimal 2000 baris per upload.")
    if not records:
        raise ValueError("Sheet Timeline belum berisi data untuk diupload.")
    return records


def order_date(value, kind, date1904):
    if kind == 'n':
        return excel_serial_date(value, date1904)
    if kind == 'd':
        return dt.datetime.fromisoformat(value).date().isoformat()
    if re.fullmatch(r'\d{2}/\d{2}/\d{4}', value):
        return dt.datetime.strptime(value, '%d/%m/%Y').date().isoformat()
    raise ValueError("Tanggal tidak valid.")


def read_order_workbook(raw):
    columns = {label.casefold(): key for label, key in ORDER_HEADERS}
    labels = {key: label for label, key in ORDER_HEADERS}
    headers = {}
    records = []
    total_text_bytes = 0
    for row_number, values, date1904 in read_sheet_rows(raw, 'Order'):
        if not any(value or error for value, _, error in values.values()):
            continue
        if not headers:
            for col, (value, _, error) in values.items():
                key = columns.get(value.casefold())
                if error:
                    raise ValueError(f"Baris {row_number}, kolom {column_name(col)}: {error}")
                if not key:
                    continue
                if key in headers.values():
                    raise ValueError(f"Baris {row_number}: header {labels[key]} berulang.")
                headers[col] = key
            missing = [label for label, key in ORDER_HEADERS if key not in headers.values()]
            if missing:
                raise ValueError(f"Baris {row_number}: header belum lengkap. Tambahkan {', '.join(missing)}.")
            continue

        record = {'baris': row_number, 'errors': {}}
        for col, key in headers.items():
            value, kind, error = values.get(col, ('', 's', None))
            if not error and value and key in ('tanggal_req_klien', 'tanggal_do'):
                try:
                    value = order_date(value, kind, date1904)
                except (ValueError, OverflowError):
                    error = "Tanggal tidak valid. Gunakan tanggal Excel atau format DD/MM/YYYY."
            if not error and value and key == 'quantity' and kind in ('b', 'd'):
                error = "Quantity harus bilangan bulat positif."
            if error:
                record['errors'][key] = error
            record[key] = value
        if not record['errors'] and not any(record[key] for key in labels):
            continue
        total_text_bytes += sum(len(record[key].encode('utf-8')) for key in labels)
        if total_text_bytes > 8 * 1024 * 1024:
            raise ValueError("Isi teks terlalu besar. Pisahkan data menjadi beberapa file.")
        records.append(record)
        if len(records) > MAX_ROWS:
            raise ValueError("Maksimal 2000 baris per upload.")
    if not records:
        raise ValueError("Sheet Order belum berisi data untuk diupload.")
    return records


def main():
    try:
        if sys.argv[1:] == ['export']:
            payload = json.loads(sys.stdin.buffer.read(40 * 1024 * 1024))
            sys.stdout.buffer.write(write_workbook(payload))
        elif sys.argv[1:] == ['template-order']:
            sys.stdout.buffer.write(write_order_template())
        elif sys.argv[1:] == ['export-proyeksi-pendapatan']:
            payload = json.loads(sys.stdin.buffer.read(40 * 1024 * 1024))
            sys.stdout.buffer.write(write_projection(payload))
        elif sys.argv[1:] == ['import']:
            records = read_workbook(sys.stdin.buffer.read(MAX_FILE + 1))
            sys.stdout.write(json.dumps(records, ensure_ascii=False))
        elif sys.argv[1:] == ['import-order']:
            records = read_order_workbook(sys.stdin.buffer.read(MAX_FILE + 1))
            sys.stdout.write(json.dumps(records, ensure_ascii=False))
        else:
            raise ValueError("Operasi Excel tidak valid.")
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else "File Excel rusak atau formatnya tidak didukung."
        sys.stderr.write(json.dumps({'error': message}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
