# GovWin IQ API Connection Test
# Test script for connecting to and pulling data from GovWin IQ API

import requests
import json
import pandas as pd
from datetime import datetime
import time

class GovWinAPITester:
    def __init__(self, base_url=None, api_key=None, username=None, password=None):
        """
        Initialize the API tester with credentials
        
        Args:
            base_url (str): Base URL for GovWin IQ API
            api_key (str): API key if using key-based auth
            username (str): Username if using basic auth
            password (str): Password if using basic auth
        """
        self.base_url = base_url or "https://api.govwin.com"  # Replace with actual base URL
        self.api_key = api_key
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.setup_authentication()
    
    def setup_authentication(self):
        """Setup authentication headers based on provided credentials"""
        if self.api_key:
            # API Key authentication
            self.session.headers.update({
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            })
        elif self.username and self.password:
            # Basic authentication
            self.session.auth = (self.username, self.password)
            self.session.headers.update({
                'Content-Type': 'application/json'
            })
        else:
            print("Warning: No authentication credentials provided")
    
    def test_connection(self):
        """Test basic API connectivity"""
        print("Testing API Connection...")
        print(f"Base URL: {self.base_url}")
        
        try:
            # Try a basic endpoint (adjust based on actual API)
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                print("✅ Connection successful!")
                return True
            else:
                print(f"❌ Connection failed with status: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def get_available_endpoints(self):
        """Try to discover available endpoints"""
        print("\nDiscovering available endpoints...")
        
        # Common endpoint patterns to test
        common_endpoints = [
            "/api/v1/opportunities",
            "/api/opportunities",
            "/opportunities",
            "/api/v1/contracts",
            "/api/contracts", 
            "/contracts",
            "/api/v1/vendors",
            "/api/vendors",
            "/vendors",
            "/api/v1/agencies",
            "/api/agencies",
            "/agencies"
        ]
        
        available_endpoints = []
        
        for endpoint in common_endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                response = self.session.get(url, timeout=5)
                
                if response.status_code in [200, 401, 403]:  # 401/403 means endpoint exists but needs auth
                    available_endpoints.append({
                        'endpoint': endpoint,
                        'status': response.status_code,
                        'url': url
                    })
                    print(f"✅ Found: {endpoint} (Status: {response.status_code})")
                
            except requests.exceptions.RequestException:
                continue
        
        return available_endpoints
    
    def test_data_pull(self, endpoint, params=None, limit=5):
        """
        Test pulling data from a specific endpoint
        
        Args:
            endpoint (str): API endpoint to test
            params (dict): Query parameters
            limit (int): Limit number of records for testing
        """
        print(f"\nTesting data pull from: {endpoint}")
        
        if params is None:
            params = {}
        
        # Add common limiting parameters
        if limit:
            params.update({
                'limit': limit,
                'per_page': limit,
                'count': limit
            })
        
        try:
            url = f"{self.base_url}{endpoint}"
            response = self.session.get(url, params=params, timeout=30)
            
            print(f"Request URL: {response.url}")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"✅ Data retrieved successfully!")
                    print(f"Response type: {type(data)}")
                    
                    if isinstance(data, dict):
                        print(f"Keys in response: {list(data.keys())}")
                        
                        # Look for common data containers
                        for key in ['data', 'results', 'items', 'records']:
                            if key in data and isinstance(data[key], list):
                                print(f"Found {len(data[key])} records in '{key}' field")
                                if data[key]:
                                    print(f"Sample record keys: {list(data[key][0].keys())}")
                                break
                    
                    elif isinstance(data, list):
                        print(f"Retrieved {len(data)} records")
                        if data:
                            print(f"Sample record keys: {list(data[0].keys())}")
                    
                    return data
                    
                except json.JSONDecodeError:
                    print(f"✅ Data retrieved but not JSON format")
                    print(f"Content type: {response.headers.get('content-type')}")
                    print(f"Response length: {len(response.text)} characters")
                    return response.text
            
            else:
                print(f"❌ Request failed with status: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return None
    
    def convert_to_dataframe(self, data, data_key=None):
        """Convert API response to pandas DataFrame"""
        try:
            if isinstance(data, dict):
                # Try to find the data array
                if data_key and data_key in data:
                    records = data[data_key]
                else:
                    # Look for common data container keys
                    for key in ['data', 'results', 'items', 'records']:
                        if key in data and isinstance(data[key], list):
                            records = data[key]
                            break
                    else:
                        # If no container found, try to use the dict itself
                        records = [data]
            
            elif isinstance(data, list):
                records = data
            else:
                print("Cannot convert data to DataFrame - unsupported format")
                return None
            
            df = pd.DataFrame(records)
            print(f"✅ Created DataFrame with {len(df)} rows and {len(df.columns)} columns")
            print(f"Columns: {list(df.columns)}")
            
            return df
            
        except Exception as e:
            print(f"❌ Error converting to DataFrame: {e}")
            return None

# Example usage and testing
def run_api_tests():
    """Run comprehensive API tests"""
    print("=" * 60)
    print("GovWin IQ API Connection Test")
    print("=" * 60)
    
    # Initialize tester - UPDATE THESE VALUES
    tester = GovWinAPITester(
        base_url="https://api.govwin.com",  # Replace with actual URL
        api_key="YOUR_API_KEY_HERE",       # Replace with your API key
        # username="your_username",        # Alternative: use username/password
        # password="your_password"
    )
    
    # Test 1: Basic connection
    connection_ok = tester.test_connection()
    
    if not connection_ok:
        print("\n⚠️  Connection test failed. Please check:")
        print("- Base URL is correct")
        print("- API credentials are valid")
        print("- Network connectivity")
        return
    
    # Test 2: Discover endpoints
    endpoints = tester.get_available_endpoints()
    
    if not endpoints:
        print("\n⚠️  No endpoints discovered. You may need to:")
        print("- Check API documentation for correct endpoint paths")
        print("- Verify authentication is working")
    
    # Test 3: Try to pull data from discovered endpoints
    for endpoint_info in endpoints[:3]:  # Test first 3 endpoints
        endpoint = endpoint_info['endpoint']
        data = tester.test_data_pull(endpoint, limit=3)
        
        if data:
            # Try to convert to DataFrame
            df = tester.convert_to_dataframe(data)
            if df is not None and not df.empty:
                print(f"\nSample data from {endpoint}:")
                print(df.head())
                print(f"\nData types:")
                print(df.dtypes)
    
    print("\n" + "=" * 60)
    print("API Testing Complete!")
    print("=" * 60)

# Run the tests
if __name__ == "__main__":
    run_api_tests()

# Additional helper functions for specific testing

def test_specific_endpoint(base_url, api_key, endpoint, params=None):
    """Quick test of a specific endpoint"""
    tester = GovWinAPITester(base_url=base_url, api_key=api_key)
    return tester.test_data_pull(endpoint, params)

def explore_data_structure(data, max_depth=3, current_depth=0):
    """Recursively explore data structure"""
    if current_depth >= max_depth:
        return
    
    if isinstance(data, dict):
        for key, value in data.items():
            print("  " * current_depth + f"'{key}': {type(value).__name__}")
            if isinstance(value, (dict, list)) and len(str(value)) < 200:
                explore_data_structure(value, max_depth, current_depth + 1)
    
    elif isinstance(data, list) and data:
        print("  " * current_depth + f"List with {len(data)} items")
        print("  " * current_depth + f"First item type: {type(data[0]).__name__}")
        if isinstance(data[0], dict):
            explore_data_structure(data[0], max_depth, current_depth + 1)

# Example of how to use for specific testing
"""
# Example: Test a specific opportunities endpoint
data = test_specific_endpoint(
    base_url="https://api.govwin.com",
    api_key="your_key_here",
    endpoint="/api/v1/opportunities",
    params={'status': 'active', 'limit': 10}
)

if data:
    explore_data_structure(data)
"""