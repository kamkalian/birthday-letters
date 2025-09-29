from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import pdfkit
import base64
from jinja2 import Environment, FileSystemLoader
from datetime import datetime
import csv
from typing import Optional, Dict, Any, List

from pydantic import BaseModel

app = FastAPI()

# Template-Umgebung einrichten
env = Environment(loader=FileSystemLoader('templates'))

app.mount("/static", StaticFiles(directory="static"), name="static")


class DataModel(BaseModel):
    file_path: str
    encoding: Optional[str] = None
    delimiter: Optional[str] = None
    year: Optional[int] = None


class PreviewRequest(BaseModel):
    file_path: str
    encoding: Optional[str] = None
    delimiter: Optional[str] = None
    n_rows: int = 5


def salutation_list(briefanrede: str):
    if any(word in briefanrede for word in ["Liebe Frau", "Lieber Herr"]):
        return ["erhalten Sie", "Ihnen", "Ihr", "Ihren"]
    if "Liebe" in briefanrede:
        return ["erhälst Du", "Dir", "Dein", "Deinen"]


def image_to_base64(path):
    with open(path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


def detect_file_encoding(file_path: str, sample_size: int = 131072) -> str:
    candidates = [
        'utf-8-sig',
        'utf-8',
        'cp1252',
        'latin-1',
        'iso-8859-1',
        'utf-16',
        'utf-16-le',
        'utf-16-be',
    ]
    try:
        with open(file_path, 'rb') as f:
            raw = f.read(sample_size)
        for enc in candidates:
            try:
                raw.decode(enc)
                return enc
            except Exception:
                continue
    except Exception:
        pass
    return 'utf-8'


def detect_csv_delimiter(file_path: str, encoding: str) -> str:
    try:
        with open(file_path, 'rb') as f:
            raw = f.read(65536)
        text = raw.decode(encoding, errors='replace')
        dialect = csv.Sniffer().sniff(text, delimiters=[',', ';', '\t', '|', ':'])
        return dialect.delimiter
    except Exception:
        return ';'


def read_csv_safely(file_path: str, encoding: Optional[str], delimiter: Optional[str]) -> pd.DataFrame:
    used_encoding = encoding or detect_file_encoding(file_path)
    used_delimiter = delimiter or detect_csv_delimiter(file_path, used_encoding)
    errors: List[str] = []
    for enc in [used_encoding, 'utf-8', 'cp1252', 'latin1']:
        for sep in [used_delimiter, ';', ',', '\t', '|']:
            try:
                df = pd.read_csv(file_path, encoding=enc, header=0, delimiter=sep, engine='python')
                if df.shape[1] == 1:
                    continue
                # Header minimal säubern: BOM und Whitespaces
                cleaned = []
                for c in df.columns:
                    s = str(c).replace('\ufeff', '').strip()
                    s = ' '.join(s.split())
                    cleaned.append(s)
                df.columns = cleaned
                df.attrs['used_encoding'] = enc
                df.attrs['used_delimiter'] = sep
                return df
            except Exception as e:
                errors.append(f"enc={enc} sep={sep}: {e}")
                continue
    raise HTTPException(status_code=400, detail={
        "message": "CSV konnte nicht zuverlässig eingelesen werden.",
        "attempts": errors[:10],
    })


def required_columns_present(df: pd.DataFrame, required: List[str]) -> Dict[str, bool]:
    # Exakte Übereinstimmung (nach minimaler Header-Säuberung)
    cols = set(map(str, df.columns))
    return {name: (name in cols) for name in required}


@app.post("/create_pdf")
async def create_upload_file(data: DataModel):
    watermark_image = image_to_base64("static/images/birthday_watermark.png")
    logo_image = image_to_base64("static/images/logo.jpg")
    signature_image = image_to_base64("static/images/signature.png")

    df = read_csv_safely(data.file_path, data.encoding, data.delimiter)

    required = [
        "Geburtsdatum",
        "Briefanrede",
        "Vorname",
        "Nachname",
        "Straße",
        "Postleitzahl",
        "Ort",
    ]
    presence = required_columns_present(df, required)
    missing = [col for col, ok in presence.items() if not ok]
    if missing:
        raise HTTPException(status_code=400, detail={
            "message": f"Fehlende Pflichtspalten: {', '.join(missing)}",
            "columns": list(df.columns),
            "used_encoding": df.attrs.get('used_encoding'),
            "used_delimiter": df.attrs.get('used_delimiter'),
        })

    try:
        df["Geburtsdatum"] = pd.to_datetime(df["Geburtsdatum"], format='%d.%m.%Y', errors='raise')
    except Exception:
        df["Geburtsdatum"] = pd.to_datetime(df["Geburtsdatum"], dayfirst=True, errors='coerce')
        if df["Geburtsdatum"].isna().any():
            raise HTTPException(status_code=400, detail={
                "message": "Spalte 'Geburtsdatum' konnte nicht als Datum erkannt werden (Format erwartet: TT.MM.JJJJ)",
            })

    template = env.get_template('letter_template.html')

    all_html = ""
    total_rows = len(df)
    year = data.year or datetime.now().year

    for index, row in df.iterrows():
        last_page = (index == len(df) - 1)
        row_dict = row.to_dict()
        # Geburtsdatum in das ausgewählte Jahr übertragen (z. B. 29.02. -> 28.02. bei Nicht-Schaltjahr)
        birthday_in_year = None
        try:
            if isinstance(row_dict.get("Geburtsdatum"), pd.Timestamp):
                bd: pd.Timestamp = row_dict["Geburtsdatum"]
                try:
                    birthday_in_year = bd.replace(year=year)
                except ValueError:
                    # 29. Februar in einem Nicht-Schaltjahr -> 28. Februar
                    if bd.month == 2 and bd.day == 29:
                        birthday_in_year = bd.replace(year=year, month=2, day=28)
            # Fallback, falls oben nicht gesetzt
            if birthday_in_year is None and "Geburtsdatum" in row_dict and row_dict["Geburtsdatum"]:
                try:
                    bd_dt = pd.to_datetime(row_dict["Geburtsdatum"], dayfirst=True, errors='coerce')
                    if pd.notna(bd_dt):
                        try:
                            birthday_in_year = bd_dt.replace(year=year)
                        except ValueError:
                            if bd_dt.month == 2 and bd_dt.day == 29:
                                birthday_in_year = bd_dt.replace(year=year, month=2, day=28)
                except Exception:
                    pass
        except Exception:
            birthday_in_year = None
        row_dict["GeburtsdatumInJahr"] = birthday_in_year
        all_html += template.render(
            row=row_dict,
            index=index,
            total=total_rows,
            year=year,
            salutation_list=salutation_list(row_dict["Briefanrede"]),
            watermark_image=watermark_image,
            logo_image=logo_image,
            signature_image=signature_image,
            last_page=last_page
        )

    pdf_options = {
        'encoding': 'UTF-8',
        'page-size': 'A4',
        'margin-top': '0mm',
        'margin-right': '0mm',
        'margin-bottom': '0mm',
        'margin-left': '0mm',
        'enable-local-file-access': None,
    }

    output_pdf = "output.pdf"
    pdfkit.from_string(all_html, output_pdf, options=pdf_options)

    return FileResponse(output_pdf, media_type='application/pdf', filename=output_pdf)


@app.post("/preview_csv")
async def preview_csv(req: PreviewRequest) -> Dict[str, Any]:
    detected_encoding = detect_file_encoding(req.file_path)
    encoding = req.encoding or detected_encoding
    detected_delim = detect_csv_delimiter(req.file_path, encoding)
    delimiter = req.delimiter or detected_delim

    df = read_csv_safely(req.file_path, encoding, delimiter)
    sample = df.head(max(1, min(50, req.n_rows))).to_dict(orient='records')

    required = [
        "Geburtsdatum",
        "Briefanrede",
        "Vorname",
        "Nachname",
        "Straße",
        "Postleitzahl",
        "Ort",
    ]
    presence = required_columns_present(df, required)

    return {
        "detected_encoding": detected_encoding,
        "detected_delimiter": detected_delim,
        "used_encoding": df.attrs.get('used_encoding', encoding),
        "used_delimiter": df.attrs.get('used_delimiter', delimiter),
        "columns": list(df.columns),
        "rows": sample,
        "required_columns": presence,
        "required_columns_order": required,
        "row_count_estimate": int(df.shape[0]),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)