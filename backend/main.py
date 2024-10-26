from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import sqlite3
import uvicorn
from ocr import OCRProcessor
import json
from scripts.rag_pipeline import *
from database.db import *
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import RedirectResponse

ocr = OCRProcessor()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

'''
THIS CODE IS SHIT, DONT FOLLOW THIS CODE JUST COOK UP SOMETHING USING FASTAPI. IF NOT POSSIBLE THEN PIVOT TO FLASK. BUT NOT DJANGO.
DJANGO TOO HARD
'''

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Use ["http://localhost:8000"] to restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

create_database()

def populate_data_from_json(db_path, json_file_path):
    """Populate the SQLite database with data from the parsed_maritime_data.json."""
    
    # Open and load the JSON file
    with open(json_file_path, 'r') as f:
        data = json.load(f)

    # Extract the parsed reports and communication messages
    parsed_reports = data.get('parsed_reports', [])
    parsed_comm_messages = data.get('parsed_comm_messages', [])
    
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)

    # Insert each parsed report into the database
    for report in parsed_reports:
        insert_into_contacts(conn, report)
    
    # Insert each parsed communication message into the database (if applicable)
    for message in parsed_comm_messages:
        insert_into_contacts(conn, message)
    
    # Close the database connection
    conn.close()

    print("Data successfully populated into the database.")

# Usage example
db_path = './database/localdb/contacts.db'
json_file_path = './data/parsed_maritime_data.json'
populate_data_from_json(db_path, json_file_path)


with open(r'./data/parsed_maritime_data.json', 'r') as infile:
    parsed_data = json.load(infile)


class TextInput(BaseModel):
    text: str

@app.post("/api/post/textdata")
async def submit_text(data: TextInput):
    # Handle the text received here
    print(data.text)
    return {"received_text": data.text}

@app.get("/")
async def redirect_to_ops():
    return RedirectResponse(url="/ops")

@app.post("/api/post/file")
async def upload_file(file: UploadFile = File(...)):
    # Save the file content if needed
    contents = await file.read()
    return {"filename": file.filename, "content_size": len(contents)}

@app.get("/ops", response_class=HTMLResponse)
async def read_ops():
    with open("static/dashboard.html") as f:
        return HTMLResponse(content=f.read())


@app.get("/", response_class=HTMLResponse)
async def read_ops_norm():
    with open("static/landing.html") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/contacts", response_class=JSONResponse)
async def read_records():
    conn = sqlite3.connect('./database/localdb/contacts.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contacts_basic")
    records = cursor.fetchall()
    conn.close()
    
    # Convert tuples to lists
    records_as_lists = [list(record) for record in records]
    return records_as_lists

@app.get("/api/zones", response_class=JSONResponse)
async def read_records():
    conn = sqlite3.connect('./database/localdb/contacts.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM zones_basic")
    records = cursor.fetchall()
    conn.close()
    
    # Convert tuples to lists
    records_as_lists = [list(record) for record in records]
    return records_as_lists


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, debug=True)
