from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import pdfkit
import base64
from jinja2 import Environment, FileSystemLoader
import os
from datetime import datetime

from pydantic import BaseModel


app = FastAPI()

# Template-Umgebung einrichten
env = Environment(loader=FileSystemLoader('templates'))

app.mount("/static", StaticFiles(directory="static"), name="static")

class DataModel(BaseModel):
    file_path: str

def salutation_list(briefanrede: str):
    if any(word in briefanrede for word in ["Liebe Frau", "Lieber Herr"]):
        return ["erhalten Sie", "Ihnen", "Ihr", "Ihren"]
    if "Liebe" in briefanrede:
        return ["erhälst Du", "Dir", "Dein", "Deinen"]
    
def image_to_base64(path):
    with open(path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

@app.post("/create_pdf")
async def create_upload_file(data: DataModel):

    watermark_image = image_to_base64("static/images/birthday_watermark.png")
    logo_image = image_to_base64("static/images/logo.jpg")
    signature_image = image_to_base64("static/images/signature.png")

    # Excel-Datei einlesen
    df = pd.read_csv(data.file_path, encoding="cp1252", header=0, delimiter=";")
    df["Geburtsdatum"] = pd.to_datetime(df["Geburtsdatum"], format='%d.%m.%Y')

    # Template laden
    template = env.get_template('letter_template.html')

    all_html = ""
    total_rows = len(df)
    year = datetime.now().year
    
    for index, row in df.iterrows():
        last_page = False
        if index == len(df) - 1:
            last_page = True
        row_dict = row.to_dict()
        all_html += template.render(
            row=row_dict,
            index=index,
            total=total_rows, 
            year=year,
            salutation_list=salutation_list(row_dict["Briefanrede"]),
            watermark_image=watermark_image,
            logo_image=logo_image,
            signature_image=signature_image,
            last_page=last_page)
    
    # PDF erstellen
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)