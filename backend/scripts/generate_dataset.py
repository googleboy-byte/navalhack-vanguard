import re
import json
from rag_pipeline import process_message_rag_pipeline
    
def clean_text(text):
    return text.replace("\u00c2\u00b0", "°")

# Extracting data from reports
def extract_from_reports(reports):
    parsed_reports = []
    
    for report in reports:
        structured_report = {
            "date": report.get("Date"),
            "time": report.get("Time"),
            "location": report.get("Location"),
            "vessel_name": extract_vessel_name(report.get("Report")),
            "coordinates": extract_coordinates(report.get("Report")),
            "heading": extract_heading(report.get("Report")),
            "speed": extract_speed(report.get("Report")),
            "message": report.get("Report"),
            "alert": process_message_rag_pipeline(report.get("Report"), "status/priority of the message into the following categories: urgent/immediate/top secret/secret/confidential/routine/secret, if its urgent or immediate return 1 else 0"), 
            "imo_number": extract_imo_number(report.get("Report")),
            "priority": process_message_rag_pipeline(report.get("Report"), "status/priority of the message into the following categories: urgent/immediate/top secret/secret/confidential/routine/secret"),
        }

        parsed_reports.append(structured_report)
        parsed_reports.append(structured_report)
    
    return parsed_reports

# Extracting data from communication messages
def extract_from_comm_messages(comm_messages):
    parsed_messages = []
    
    for message in comm_messages:
        structured_message = {
            "from": message.get("FROM"),
            "to": message.get("TO"),
            "dtg": message.get("DTG"),
            "vessel_name": extract_vessel_name(message.get("MESSAGE")),
            "message": message.get("MESSAGE"),
            "alert": extract_priority(message.get("PRIORITY")),
            "priority": message.get("PRIORITY"),
            "coordinates": extract_coordinates(message.get("MESSAGE")),
            "additional_info": process_message_rag_pipeline(message.get("MESSAGE"), "relevant information summary") + extract_additional_info(message.get("MESSAGE"))
        }
        parsed_messages.append(structured_message)
    
    return parsed_messages

# Regular Expression Functions
def extract_coordinates(text):
    cleaned_text = clean_text(text)
    
    # Regular expression to capture latitude and longitude
    pattern = r"(\d{1,2}°\d{1,2}'[NS]),?\s*(\d{1,3}°\d{1,2}'[EW])"
    
    match = re.search(pattern, cleaned_text)
    
    if match:
        return {"latitude": match.group(1), "longitude": match.group(2)}
    return None

def extract_heading(text):
    pattern = r"Heading\s+(\d{1,3})°"
    match = re.search(pattern, text)
    return match.group(1) if match else None

def extract_speed(text):
    pattern = r"speed\s+(\d+)\s+knots"
    match = re.search(pattern, text)
    return match.group(1) if match else None

def extract_vessel_name(text):
    pattern = r'"([^"]+)"'
    match = re.search(pattern, text)
    return match.group(1) if match else None

def extract_imo_number(text):
    pattern = r"IMO number\s+(\d+)"
    match = re.search(pattern, text)
    return match.group(1) if match else None

def extract_priority(priority):
    if priority == "URGENT" or priority == "IMMEDIATE":
        return 1
    return 0

def extract_additional_info(text):
    text = text.lower()  # Lowercase the text for case-insensitive matching
    
    # Check for specific phrases for suspicious activity
    if "no suspicious activity" in text.lower() or "routine" in text.lower() or "legal" in text.lower():
        return "No suspicious activity"
    
    # Check for emergency situations or backup requests
    if "emergency" in text.lower() or "alert" in text.lower() or "backup" in text.lower() or "request" in text.lower():
        return "Emergency alert or backup requested"
    
    # Check for suspicious or illegal activity
    if "suspicious" in text.lower() or "smuggling" in text.lower() or "illegal" in text.lower():
        return "Suspicious activity detected"
    
    # If none of the conditions are met, return no additional info
    return "No additional info"

# Parsing the dataset
def parse_dataset(data):
    reports = data.get("reports", [])
    comm_messages = data.get("comm_messages", [])
    
    parsed_reports = extract_from_reports(reports)
    parsed_messages = extract_from_comm_messages(comm_messages)
    
    return {
        "parsed_reports": parsed_reports,
        "parsed_comm_messages": parsed_messages
    }

if __name__=='__main__':
    # Load the dataset from JSON
    with open(r'C:\Users\Agnij\Coding_projects\naval-vanguard\data\extracted_data.json', 'r') as f:
        data = json.load(f)

    # Parse the data
    parsed_data = parse_dataset(data)

    # Save the parsed data to a new JSON file
    with open(r'../data/parsed_maritime_data.json', 'w') as outfile:
        json.dump(parsed_data, outfile, indent=4)

    print("Data parsed successfully and saved to 'parsed_maritime_data.json'.")
