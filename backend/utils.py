import os
import re
import json

def read_maritime_data(file_path):
    """Read maritime data from a markdown file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist.")
    
    with open(file_path, 'r') as file:
        return file.read()

def parse_maritime_data(data):
    # Initialize the structured data dictionary
    parsed_data = {
        "maritime_reports": [],
        "geographical_data": []
    }

    # Split the data into sections based on known headings
    sections = data.split("###")
    for section in sections:
        section = section.strip()
        if section.startswith("1.1"):
            # Maritime Reports
            reports = re.findall(r"Date: (.+?)\nTime: (.+?)\nLocation: (.+?)\nReport: (.+?)(?=\n\n|\Z)", section, re.DOTALL)
            for report in reports:
                parsed_data["maritime_reports"].append({
                    "date": report[0].strip(),
                    "time": report[1].strip(),
                    "location": report[2].strip(),
                    "report": report[3].strip()
                })
        
        elif section.startswith("1.4"):
            # Geographical Data
            geo_data_match = re.search(r"(\{.*?\})", section, re.DOTALL)
            if geo_data_match:
                geo_data_json = geo_data_match.group(1)
                try:
                    geo_data = json.loads(geo_data_json)
                    parsed_data["geographical_data"].append(geo_data)
                except json.JSONDecodeError as e:
                    print(f"JSON decoding error: {e}")
                    print("Geo Data JSON:", geo_data_json)

    return parsed_data

def extract_information(parsed_data):
    """Extract relevant information from parsed data."""
    extracted_info = []

    for report in parsed_data["maritime_reports"]:
        # Extracting relevant information using regex
        heading_match = re.search(r"Heading (\d+°)", report["report"])
        speed_match = re.search(r"speed (\d+) knots", report["report"])
        coordinates_match = re.search(r"at (\d+°\d+\'[NS]), (\d+°\d+\'[EW])", report["report"])

        info = {
            "date": report["date"],
            "time": report["time"],
            "location": report["location"],
            "heading": heading_match.group(1) if heading_match else None,
            "speed": speed_match.group(1) if speed_match else None,
            "coordinates": {
                "lat": coordinates_match.group(1) if coordinates_match else None,
                "lon": coordinates_match.group(2) if coordinates_match else None
            }
        }

        # Check for potential threats
        if "unidentified" in report["report"].lower() or "restricted" in report["report"].lower():
            info["alert"] = "Potential threat detected!"

        extracted_info.append(info)

    return extracted_info

def process_directory(directory_path):
    """Process all markdown files in the specified directory."""
    all_extracted_info = []

    for filename in os.listdir(directory_path):
        if filename.endswith('.md'):
            file_path = os.path.join(directory_path, filename)
            data = read_maritime_data(file_path)
            parsed_data = parse_maritime_data(data)
            extracted_info = extract_information(parsed_data)
            all_extracted_info.extend(extracted_info)

    return all_extracted_info

# Main execution
if __name__ == "__main__":
    directory_path = 'data/Maritime Situational Awareness'  # Update this path
    all_data = process_directory(directory_path)

    # Print the extracted information for verification
    print(json.dumps(all_data, indent=4))