# test_streamlit.py
import streamlit as st
from azure.cosmos import CosmosClient

st.title("Cosmos DB Connection Test")

try:
    url = st.secrets["COSMOS_URL"]
    key = st.secrets["COSMOS_KEY"]
    
    client = CosmosClient(url, key)
    db = client.get_database_client("govwin")
    container = db.get_container_client("opportunities")
    
    # Test query
    query = "SELECT COUNT(1) as count FROM c"
    result = list(container.query_items(query, enable_cross_partition_query=True))
    
    st.success(f"✅ Connected! Found {result[0]['count']} opportunities")
    
except Exception as e:
    st.error(f"❌ Connection failed: {e}")