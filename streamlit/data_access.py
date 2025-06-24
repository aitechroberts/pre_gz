"""
Data access layer for GovWin dashboard.
Handles Cosmos DB connections, querying, and data processing.
"""

import os
from datetime import datetime
from typing import Dict, List

import pandas as pd
import streamlit as st
from azure.cosmos import CosmosClient

# ─── Source name normalization ────────────────────────────────────────────────
SOURCE_ALIASES = {
    "govwin tracked opportunities": "GovWin Tracked",
    "govwin tracked": "GovWin Tracked", 
    "sam.gov": "SAM.gov",
    "gsa ebuy": "GSA eBuy/Task Orders",
    "task orders": "GSA eBuy/Task Orders",
}

def normalize_source(src_text: str) -> str:
    """Normalize source names for consistent filtering"""
    return SOURCE_ALIASES.get(src_text.lower(), src_text)

# ─── Cosmos helpers (cached) ──────────────────────────────────────────────────
@st.cache_resource(show_spinner=False)
def cosmos_client() -> CosmosClient:
    url = st.secrets.get("COSMOS_URL", os.getenv("COSMOS_URL"))
    key = st.secrets.get("COSMOS_KEY", os.getenv("COSMOS_KEY"))
    return CosmosClient(url, key)

@st.cache_resource(show_spinner=False)
def cosmos_containers():
    db = cosmos_client().get_database_client("govwin")
    return {
        "opps": db.get_container_client("opportunities"),
    }

# ─── Get filter options from actual data ─────────────────────────────────────
def merge_with_preferred(actual_values, preferred_values):
    """Merge preferred values with actual data values, preferred first"""
    merged = []
    seen = set()
    
    for val in preferred_values:
        if val not in seen and val in actual_values:
            merged.append(val)
            seen.add(val)
    
    for val in actual_values:
        if val not in seen:
            merged.append(val)
            seen.add(val)
    
    return merged

@st.cache_data(ttl=300)
def get_filter_options():
    """Get available filter values from the database"""
    try:
        container = cosmos_containers()["opps"]
        
        queries = {
            "naics": "SELECT DISTINCT c.primaryNAICS.id FROM c WHERE IS_DEFINED(c.primaryNAICS.id)",
            "all_naics": "SELECT DISTINCT n.id FROM c JOIN n IN c.allNAICSCodes WHERE IS_DEFINED(n.id)",
            "psc": "SELECT DISTINCT c.pscCode FROM c WHERE IS_DEFINED(c.pscCode)",  # Use extracted PSC codes
            "status": "SELECT DISTINCT c.status FROM c WHERE IS_DEFINED(c.status)",
            "sources": "SELECT DISTINCT c.source FROM c WHERE IS_DEFINED(c.source)",
            "procurement": "SELECT DISTINCT c.procurement FROM c WHERE IS_DEFINED(c.procurement) AND c.source != 'GovWin Tracked'"  # Exclude GovWin's custom phases
        }
        
        options = {}
        for key, query in queries.items():
            try:
                results = list(container.query_items(query, enable_cross_partition_query=True))
                if key in ["naics", "all_naics"]:
                    # Extract NAICS IDs
                    if key == "naics":
                        options[key] = sorted([r["id"] for r in results if r.get("id")])
                    else:  # all_naics
                        options[key] = sorted([r["id"] for r in results if r.get("id")])
                elif key == "psc":
                    options[key] = sorted([r["pscCode"] for r in results if r.get("pscCode")])
                elif key == "status":
                    options[key] = sorted([r["status"] for r in results if r.get("status")])
                elif key == "sources":
                    # Normalize source names for consistent display
                    raw_sources = [r["source"] for r in results if r.get("source")]
                    normalized_sources = list(set([normalize_source(src) for src in raw_sources]))
                    options[key] = sorted(normalized_sources)
                elif key == "procurement":
                    options[key] = sorted([r["procurement"] for r in results if r.get("procurement")])
            except Exception as e:
                st.warning(f"Could not load {key} options: {e}")
                options[key] = []
        
        # Merge NAICS options to get comprehensive list
        all_naics = sorted(list(set(options.get("naics", []) + options.get("all_naics", []))))
        options["combined_naics"] = all_naics
        
        return options
    except Exception as e:
        st.error(f"Could not load filter options: {e}")
        return {
            "combined_naics": [], 
            "psc": [], 
            "status": [], 
            "sources": ["SAM.gov", "GSA eBuy/Task Orders"], 
            "procurement": []
        }

# ─── Enhanced data processing with ChatGPT's date fix ────────────────────────
def process_dataframe(df):
    """Enhanced dataframe processing with better null handling"""
    if df.empty:
        return df
    
    # Ensure sourceURL is properly handled
    if 'sourceURL' in df.columns:
        df['sourceURL'] = df['sourceURL'].astype(str).replace(['nan', 'None', ''], None)
    
    # Contract value processing
    df["contractValue"] = pd.to_numeric(df.get("contractValue", pd.Series()), errors="coerce").fillna(
        pd.to_numeric(df.get("oppValue", pd.Series()), errors="coerce")
    ).fillna(0)
    
    # FIXED: Better date unification that handles missing columns
    posted = (
        df.get("originalPostedDt", pd.Series(dtype="object"))
          .combine_first(df.get("createdDate", pd.Series(dtype="object")))
    )
    df["postedDate"] = pd.to_datetime(posted, errors="coerce")
    
    # Other date processing
    for c in ["updateDate", "ingestedAt", "ingested_at"]:
        if c in df:
            df[c] = pd.to_datetime(df[c], errors="coerce")
    
    return df

def build_query(start: datetime, end: datetime, flt: Dict) -> tuple[str, List[Dict]]:
    """
    Build query with mixed AND/OR logic:
    - NAICS and PSC use OR logic (broad opportunity matching)
    - Source, Status, and Procurement use AND logic (restrictive filtering)
    """
    # Date filter
    date_filter = "c.ingestedAt >= @start AND c.ingestedAt <= @end"
    
    params = [
        {"name": "@start", "value": start.isoformat()},
        {"name": "@end",   "value": end.isoformat()},
    ]
    
    filter_conditions = []
    
    # Helper for OR-within each filter category
    def _add_filter_group(col_expr: str, items: list[str], tag: str):
        if not items:
            return None
        ors = []
        for i, v in enumerate(items):
            ors.append(col_expr.format(i=i))
            params.append({"name": f"@{tag}{i}", "value": v})
        return f"({' OR '.join(ors)})"
    
    # 1. OPPORTUNITY RELEVANCE (OR logic) - Cast wide net for relevant work
    relevance_conditions = []
    
    # NAICS filtering - check allNAICSCodes array
    if flt["naics"]:
        naics_conditions = []
        for i, naics_code in enumerate(flt["naics"]):
            naics_conditions.append(f"EXISTS(SELECT VALUE n FROM n IN c.allNAICSCodes WHERE n.id = @naics{i})")
            params.append({"name": f"@naics{i}", "value": naics_code})
        if naics_conditions:
            relevance_conditions.append(f"({' OR '.join(naics_conditions)})")
    
    # PSC filtering - exact match on PSC code
    if flt["psc"]:
        psc_filter = _add_filter_group("c.pscCode = @psc{i}", flt["psc"], "psc")
        if psc_filter:
            relevance_conditions.append(psc_filter)
    
    # Combine NAICS and PSC with OR (show opportunities with EITHER relevant NAICS OR relevant PSC)
    if relevance_conditions:
        combined_relevance = f"({' OR '.join(relevance_conditions)})"
        filter_conditions.append(combined_relevance)
    
    # 2. OPERATIONAL FILTERS (AND logic) - Narrow down by operational criteria
    
    # Source filtering (AND with relevance)
    if flt["src"]:
        normalized_sources = [normalize_source(src) for src in flt["src"]]
        src_filter = _add_filter_group("c.source = @src{i}", normalized_sources, "src")
        if src_filter:
            filter_conditions.append(src_filter)
    
    # Status filtering (AND with relevance)
    if flt["status"]:
        status_filter = _add_filter_group("c.status = @status{i}", flt["status"], "status")
        if status_filter:
            filter_conditions.append(status_filter)
    
    # Procurement filtering (AND with relevance)
    if flt["procurement"]:
        proc_filter = _add_filter_group("c.procurement = @procurement{i}", flt["procurement"], "procurement")
        if proc_filter:
            filter_conditions.append(proc_filter)
    
    # Combine all conditions with AND
    if filter_conditions:
        where_clause = f"{date_filter} AND {' AND '.join(filter_conditions)}"
    else:
        where_clause = date_filter
    
    return f"SELECT * FROM c WHERE {where_clause}", params

# ─── Load opportunities ───────────────────────────────────────────────────────
def fetch_opps(start: datetime, end: datetime, flt: Dict) -> pd.DataFrame:
    q, p = build_query(start, end, flt)
    
    try:
        items = cosmos_containers()["opps"].query_items(
            q, parameters=p, enable_cross_partition_query=True
        )
        df = pd.DataFrame(list(items))
        if df.empty:
            return df

        # Enhanced data processing with ChatGPT's fixes
        df = process_dataframe(df)

        # Flatten nested bits with better error handling
        df["agency"] = df["govEntity"].apply(
            lambda g: g.get("title") if isinstance(g, dict) else None
        )
        df["naicsCode"] = df["primaryNAICS"].apply(
            lambda n: n.get("id") if isinstance(n, dict) else None
        )
        df["naicsTitle"] = df["primaryNAICS"].apply(
            lambda n: n.get("title") if isinstance(n, dict) else None
        )

        return df
        
    except Exception as e:
        st.error(f"Error fetching opportunities: {e}")
        return pd.DataFrame()