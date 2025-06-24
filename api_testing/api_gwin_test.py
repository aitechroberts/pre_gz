# Simple GovWin IQ API Connection Test
import requests
import json
import pandas as pd
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = "https://api.govwin.com"  # Replace with actual GovWin IQ API URL
API_KEY = os.getenv("GOVWIN_API_KEY")

def test_connection():
    """Test basic API connectivity"""
    print("Testing GovWin IQ API connection...")
    
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test with a basic endpoint - adjust as needed
        response = requests.get(f"{BASE_URL}/api/v1/opportunities", headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Connection successful!")
            return True
        else:
            print(f"❌ Connection failed: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return False

def pull_data(endpoint="/api/v1/opportunities", params=None):
    """Pull data from GovWin IQ API"""
    print(f"\nPulling data from: {endpoint}")
    
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    if params is None:
        params = {'limit': 10}  # Default to 10 records for testing
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Successfully retrieved data!")
            print(f"Response type: {type(data)}")
            
            # Show basic info about the data structure
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
            elif isinstance(data, list):
                print(f"Number of records: {len(data)}")
                if data:
                    print(f"Sample record keys: {list(data[0].keys())}")
            
            return data
        else:
            print(f"❌ Failed to retrieve data: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return None

def data_to_dataframe(data):
    """Convert API response to pandas DataFrame"""
    try:
        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict) and 'data' in data:
            df = pd.DataFrame(data['data'])
        else:
            print("Data format not recognized for DataFrame conversion")
            return None
        
        print(f"✅ Created DataFrame: {df.shape[0]} rows, {df.shape[1]} columns")
        return df
        
    except Exception as e:
        print(f"❌ Error creating DataFrame: {e}")
        return None

# Main testing
if __name__ == "__main__":
    print("GovWin IQ API Test")
    print("=" * 30)
    
    # Check if API key is loaded
    if not API_KEY:
        print("❌ No API key found. Please add GOVWIN_API_KEY to your .env file")
        exit()
    
    # Test connection
    if test_connection():
        # Pull some data
        data = pull_data()
        
        if data:
            # Convert to DataFrame
            df = data_to_dataframe(data)
            
            if df is not None:
                print(f"\nSample data:")
                print(df.head())
                print(f"\nColumns: {list(df.columns)}")