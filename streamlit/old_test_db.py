import os
from datetime import datetime, timedelta
from typing import Dict, List

import pandas as pd
import streamlit as st
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosAccessConditionFailedError

# ─── Parker Tide Default Filters ─────────────────────────────────────────────
PARKER_TIDE_NAICS = [
    "518210", "541199", "541211", "541214", "541219", "541330", "541519", 
    "541611", "541612", "541618", "541690", "541720", "541930", "541990", 
    "561110", "561311", "561312", "561320", "561410", "561421", "561431", 
    "561499", "561611", "611430"
]

PARKER_TIDE_PSC = [
    "R406", "R408", "R418", "R499", "R607", "R699", "R707"
]

# ─── Streamlit page config ────────────────────────────────────────────────────
st.set_page_config("GovWin 24-h Dashboard", "🏛️", layout="wide")

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
        "opps": db.get_container_client("testing"),
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
            "psc": "SELECT DISTINCT c.classificationCodeDesc FROM c WHERE IS_DEFINED(c.classificationCodeDesc)",
            "status": "SELECT DISTINCT c.status FROM c WHERE IS_DEFINED(c.status)",
            "sources": "SELECT DISTINCT c.source FROM c WHERE IS_DEFINED(c.source)",
            "procurement": "SELECT DISTINCT c.procurement FROM c WHERE IS_DEFINED(c.procurement)"
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
                    options[key] = sorted([r["classificationCodeDesc"] for r in results if r.get("classificationCodeDesc")])
                elif key == "status":
                    options[key] = sorted([r["status"] for r in results if r.get("status")])
                elif key == "sources":
                    options[key] = sorted([r["source"] for r in results if r.get("source")])
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

# ─── URL validation helper ────────────────────────────────────────────────────
def is_valid_url(url):
    """Check if URL is valid and not None/NaN"""
    if pd.isna(url) or url is None:
        return False
    if not isinstance(url, str):
        return False
    if not url.strip():
        return False
    # Basic URL validation
    return url.startswith(('http://', 'https://'))

# ─── Fixed link button with URL validation ───────────────────────────────────
def safe_link_button(label, url, key=None):
    """Create a link button with URL validation"""
    if is_valid_url(url):
        st.link_button(label, url)  # Remove key parameter - not supported
    else:
        st.caption("🔗 No source URL available")

# ─── Enhanced data processing ─────────────────────────────────────────────────
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
    
    # Date processing
    for c in ["createdDate", "updateDate", "ingestedAt", "ingested_at"]:
        if c in df:
            df[c] = pd.to_datetime(df[c], errors="coerce")
    
    return df

def build_query(start: datetime, end: datetime, flt: Dict, use_or_logic: bool = False) -> tuple[str, List[Dict]]:
    """Build query with AND or OR logic between filter categories"""
    # SIMPLIFIED: Since replacing all data, all records will have ingestedAt
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
    
    # Build each filter group
    if flt["src"]:
        src_filter = _add_filter_group("c.source = @src{i}", flt["src"], "src")
        if src_filter:
            filter_conditions.append(src_filter)
    
    if flt["agency"]:
        agency_filter = _add_filter_group("CONTAINS(UPPER(c.govEntity.title), UPPER(@agency{i}))", flt["agency"], "agency")
        if agency_filter:
            filter_conditions.append(agency_filter)
    
    # Enhanced NAICS filtering - check allNAICSCodes array
    if flt["naics"]:
        naics_conditions = []
        for i, naics_code in enumerate(flt["naics"]):
            naics_conditions.append(f"EXISTS(SELECT VALUE n FROM n IN c.allNAICSCodes WHERE n.id = @naics{i})")
            params.append({"name": f"@naics{i}", "value": naics_code})
        if naics_conditions:
            filter_conditions.append(f"({' OR '.join(naics_conditions)})")
    
    if flt["psc"]:
        psc_filter = _add_filter_group("CONTAINS(c.classificationCodeDesc, @psc{i})", flt["psc"], "psc")
        if psc_filter:
            filter_conditions.append(psc_filter)
    
    if flt["status"]:
        status_filter = _add_filter_group("c.status = @status{i}", flt["status"], "status")
        if status_filter:
            filter_conditions.append(status_filter)
    
    if flt["procurement"]:
        proc_filter = _add_filter_group("c.procurement = @procurement{i}", flt["procurement"], "procurement")
        if proc_filter:
            filter_conditions.append(proc_filter)
    
    # Combine filters with AND or OR logic
    if filter_conditions:
        if use_or_logic:
            combined_filters = f"({' OR '.join(filter_conditions)})"
        else:
            combined_filters = f"({' AND '.join(filter_conditions)})"
        where_clause = f"{date_filter} AND {combined_filters}"
    else:
        where_clause = date_filter
    
    return f"SELECT * FROM c WHERE {where_clause}", params

# ─── Load opportunities ───────────────────────────────────────────────────────
def fetch_opps(start: datetime, end: datetime, flt: Dict, use_or_logic: bool = False) -> pd.DataFrame:
    q, p = build_query(start, end, flt, use_or_logic)
    
    try:
        items = cosmos_containers()["opps"].query_items(
            q, parameters=p, enable_cross_partition_query=True
        )
        df = pd.DataFrame(list(items))
        if df.empty:
            return df

        # Enhanced data processing
        df = process_dataframe(df)

        # Unify "posted" date
        df["postedDate"] = pd.to_datetime(
            df.get("originalPostedDt").fillna(df.get("createdDate")), 
            errors="coerce"
        )

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

# ─── Copy to clipboard functionality ──────────────────────────────────────────
def copy_to_clipboard_button(text_to_copy: str, button_text: str = "📋 Copy", key: str = None):
    """Create a button that copies text to clipboard using JavaScript"""
    if st.button(button_text, key=key, help="Click to copy to clipboard"):
        # Use st.html to inject JavaScript for copying
        st.html(f"""
        <script>
        navigator.clipboard.writeText('{text_to_copy}').then(function() {{
            console.log('Copied to clipboard: {text_to_copy}');
        }});
        </script>
        """)
        st.success(f"Copied: {text_to_copy}")

# ─── Feedback saver ───────────────────────────────────────────────────────────
def save_fb(opp_id: str, rel: str, pur: str):
    if rel == pur == "Unrated":
        return
    
    container = cosmos_containers()["opps"]
    try:
        doc = container.read_item(item=opp_id, partition_key=opp_id)
        
        ops = []
        if rel != "Unrated":
            ops.append({"op": "add", "path": "/relevant", "value": rel})
        if pur != "Unrated":
            ops.append({"op": "add", "path": "/pursued", "value": pur})
        
        container.patch_item(
            item=opp_id, 
            partition_key=opp_id,
            patch_operations=ops,
            if_match=doc["_etag"]
        )
        return True
        
    except CosmosResourceNotFoundError:
        st.error("Opportunity not found – refresh data.")
        return False
    except CosmosAccessConditionFailedError:
        st.warning("Someone else updated this record first; refresh to see changes.")
        return False

# ─── Sidebar filters ──────────────────────────────────────────────────────────
with st.sidebar:
    st.header("🔍 Filters (New to Us)")
    st.caption("Filter by when we discovered opportunities, not when they were originally posted")

    now = datetime.utcnow()
    from_dt = st.date_input("From", now.date() - timedelta(days=1), max_value=now.date())
    to_dt = st.date_input("To", now.date(), max_value=now.date())

    # Filter Logic Toggle
    st.markdown("### 🔧 Filter Logic")
    use_or_logic = st.toggle(
        "Use OR between filter categories", 
        value=False,
        help="Default: AND between categories (e.g., Status=Active AND Source=SAM.gov). Toggle: OR between categories (e.g., Status=Active OR Source=SAM.gov)"
    )
    
    if use_or_logic:
        st.info("🔄 OR Logic: Show opportunities matching ANY filter category")
    else:
        st.info("🔗 AND Logic: Show opportunities matching ALL filter categories")

    # Load dynamic filter options
    with st.spinner("Loading filter options..."):
        filter_options = get_filter_options()
    
    # Preferred values for ordering (keeping original approach for other filters)
    preferred_status = ["Pre-RFP", "Post-RFP"]
    
    # Create dynamic filter lists with Parker Tide defaults for NAICS/PSC
    source_options = filter_options.get("sources", ["SAM.gov", "GSA eBuy/Task Orders"])
    naics_options = merge_with_preferred(filter_options.get("combined_naics", []), PARKER_TIDE_NAICS)
    psc_options = merge_with_preferred(filter_options.get("psc", []), PARKER_TIDE_PSC)
    status_options = merge_with_preferred(filter_options.get("status", []), preferred_status)
    procurement_options = filter_options.get("procurement", [])
    
    # Filter widgets
    src = st.multiselect("Source platform", source_options)
    agency_txt = st.text_area("Agencies (one per line)", help="Max 100 agencies")
    
    # Filter Parker Tide defaults to only include codes that exist in the database
    available_parker_naics = [code for code in PARKER_TIDE_NAICS if code in naics_options]
    available_parker_psc = [code for code in PARKER_TIDE_PSC if code in psc_options]
    
    # Show Parker Tide coverage info
    if available_parker_naics or available_parker_psc:
        st.info(f"🎯 Parker Tide Coverage: {len(available_parker_naics)}/{len(PARKER_TIDE_NAICS)} NAICS codes and {len(available_parker_psc)}/{len(PARKER_TIDE_PSC)} PSC codes have opportunities")
    
    # NAICS with available Parker Tide defaults pre-selected
    naics = st.multiselect(
        f"NAICS Codes ({len(naics_options)} available)", 
        naics_options,
        default=available_parker_naics,  # Only Parker Tide NAICS that exist in database
        help=f"✅ Pre-selected: {len(available_parker_naics)} Parker Tide relevant NAICS codes found in database. Searches ALL NAICS codes (primary + additional) for each opportunity"
    )
    
    # PSC with available Parker Tide defaults pre-selected
    psc = st.multiselect(
        f"PSC Codes ({len(psc_options)} available)", 
        psc_options,
        default=available_parker_psc,  # Only Parker Tide PSC that exist in database
        help=f"✅ Pre-selected: {len(available_parker_psc)} Parker Tide relevant PSC codes found in database"
    )
    
    # Other filters remain without defaults
    status = st.multiselect(f"Status ({len(status_options)} available)", status_options)
    procurement = st.multiselect(f"Procurement Phase ({len(procurement_options)} available)", procurement_options)

    # Reset buttons
    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🗂️ Reset to Defaults", help=f"Reset to {len(available_parker_naics)} NAICS and {len(available_parker_psc)} PSC Parker Tide defaults", use_container_width=True):
            # Clear relevant session state keys to trigger default reselection
            keys_to_clear = [key for key in st.session_state.keys() if 'naics' in key.lower() or 'psc' in key.lower()]
            for key in keys_to_clear:
                del st.session_state[key]
            st.rerun()
    with col2:
        if st.button("🧹 Clear All Filters", help="Clear all filter selections", use_container_width=True):
            # Clear all multiselect session state
            keys_to_clear = [key for key in st.session_state.keys() if any(term in key for term in ['multiselect', 'selectbox', 'radio'])]
            for key in keys_to_clear:
                del st.session_state[key]
            st.rerun()

    st.divider()
    st.subheader("📊 Sort Options")
    
    # Enhanced sort options with ingestedAt
    base_sort_options = ["ingestedAt", "postedDate", "contractValue", "updateDate"]
    
    sort_by = st.selectbox("Sort by", base_sort_options)
    sort_dir = st.radio("Direction", ["Descending", "Ascending"])

    run = st.button("Apply", type="primary", use_container_width=True)

# ─── Fetch & cache ────────────────────────────────────────────────────────────
if run or "df" not in st.session_state:
    with st.spinner("Loading…"):
        agency_list = [a.strip() for a in agency_txt.splitlines() if a.strip()][:100]
        
        st.session_state.df = fetch_opps(
            datetime.combine(from_dt, datetime.min.time()),
            datetime.combine(to_dt, datetime.max.time()),
            {"src": src, "agency": agency_list, "naics": naics, "psc": psc, "status": status, "procurement": procurement},
            use_or_logic
        )

df = st.session_state.get("df", pd.DataFrame())

# ─── UI when empty ────────────────────────────────────────────────────────────
if df.empty:
    st.info("No opportunities for the chosen window / filters.")
    st.stop()

# ─── Summary metrics ──────────────────────────────────────────────────────────
col1, col2, col3 = st.columns(3)
col1.metric("Opportunities", f"{len(df):,}")
col2.metric("Total Value", f"${df['contractValue'].sum():,.0f}")
col3.metric("Avg. Value", f"${df['contractValue'].mean():,.0f}")

st.divider()

# ─── Search-within results ────────────────────────────────────────────────────
search = st.text_input("Search within results")
if search:
    mask = df.apply(lambda r: search.lower() in str(r).lower(), axis=1)
    df = df[mask]

# ─── Sort ────────────────────────────────────────────────────────────────────
ascending = sort_dir == "Ascending"
df = df.sort_values(sort_by, ascending=ascending)

# ─── Opportunity cards with enhanced information ─────────────────────────────
for idx, row in df.iterrows():
    title = row.get("title") or "Untitled"
    value = f"${row['contractValue']:,.0f}"
    source = row.get("source", "Unknown")

    with st.expander(f"**{title}** – {value} – {source}"):
        left, right = st.columns([3, 1])

        with left:
            st.markdown(f"**Agency:** {row.get('agency')}")
            st.markdown(f"**Source:** {source}")
            st.markdown(f"**Status:** {row.get('status')}")
            st.markdown(f"**Procurement Phase:** {row.get('procurement', 'N/A')}")
            st.markdown(f"**PSC:** {row.get('classificationCodeDesc', 'N/A')}")
            st.markdown(f"**NAICS:** {row.get('naicsCode', '')} – {row.get('naicsTitle', '')}")
            
            # Show all NAICS codes if available
            if row.get('allNAICSCodes') and isinstance(row['allNAICSCodes'], list):
                all_naics = [naics.get('id', '') for naics in row['allNAICSCodes'] if isinstance(naics, dict)]
                if len(all_naics) > 1:
                    st.markdown(f"**All NAICS:** {', '.join(all_naics)}")
            
            # Show set-asides
            if row.get('setAsides') and isinstance(row['setAsides'], list):
                set_asides = [sa.get('title', '') for sa in row['setAsides'] if isinstance(sa, dict)]
                if set_asides:
                    st.markdown(f"**Set-Asides:** {', '.join(set_asides)}")
            
            st.markdown(f"**Posted:** {row.get('postedDate')}")
            
            # Show when we discovered this opportunity
            if row.get('ingestedAt'):
                ingested_date = pd.to_datetime(row['ingestedAt'], errors='coerce')
                if pd.notna(ingested_date):
                    st.markdown(f"**Discovered:** {ingested_date.strftime('%Y-%m-%d %H:%M UTC')}")
            
            # Solicitation number with copy functionality
            sol_num = row.get('solicitationNumber', 'N/A')
            col_sol1, col_sol2 = st.columns([3, 1])
            with col_sol1:
                st.markdown(f"**Solicitation #:** {sol_num}")
            with col_sol2:
                if sol_num != 'N/A':
                    copy_to_clipboard_button(sol_num, "📋", key=f"copy_{row['id']}")
            
            # Show response deadline
            if row.get('responseDate') and isinstance(row.get('responseDate'), dict):
                response_date = row['responseDate'].get('value', 'N/A')
                st.markdown(f"**Response Deadline:** {response_date}")
            
            st.markdown(f"**Search Term:** `{row.get('searchTerm')}`")
            
            # Show smart tags
            if row.get('smartTagObject'):
                tags = [tag.get('name', '') for tag in row['smartTagObject'] if tag.get('name')]
                if tags:
                    st.markdown(f"**Service Tags:** {', '.join(tags[:5])}")

            if row.get("description") and pd.notna(row.get("description")):
                st.markdown("**Description:**")
                desc = str(row["description"])
                st.write(desc[:600] + ("…" if len(desc) > 600 else ""))

            # Fixed sourceURL with validation
            safe_link_button("🔗 View on SAM/GovWin", row.get("sourceURL"), key=f"link_{row['id']}")

        with right:
            st.markdown("### Feedback")
            
            current_rel = row.get("relevant", "Unrated")
            current_pur = row.get("pursued", "Unrated")
            
            rel_options = ["Unrated", "✅ Yes", "❌ No"]
            pur_options = ["Unrated", "🚀 Yes", "💤 No"]
            
            rel_map = {"Unrated": 0, "Yes": 1, "No": 2}
            pur_map = {"Unrated": 0, "Yes": 1, "No": 2}
            
            rel_index = rel_map.get(current_rel, 0)
            pur_index = pur_map.get(current_pur, 0)
            
            rel = st.radio("Relevant?", rel_options, index=rel_index, key=f"rel_{row['id']}")
            pur = st.radio("Pursued?", pur_options, index=pur_index, key=f"pur_{row['id']}")
            
            if st.button("Save", key=f"save_{row['id']}", use_container_width=True):
                canon_rel = {"✅ Yes": "Yes", "❌ No": "No"}.get(rel, "Unrated")
                canon_pur = {"🚀 Yes": "Yes", "💤 No": "No"}.get(pur, "Unrated")
                
                if save_fb(str(row["id"]), canon_rel, canon_pur):
                    if canon_rel != "Unrated":
                        st.session_state.df.at[idx, "relevant"] = canon_rel
                    if canon_pur != "Unrated":
                        st.session_state.df.at[idx, "pursued"] = canon_pur
                    
                    st.success("Saved!")

st.caption(f"Dashboard refreshed: {datetime.utcnow():%Y-%m-%d %H:%M UTC} | Showing opportunities by discovery date")