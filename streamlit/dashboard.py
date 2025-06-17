import os
from datetime import datetime, timedelta
from typing import Dict, List

import pandas as pd
import streamlit as st
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosAccessConditionFailedError

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
        "opps": db.get_container_client("opportunities"),
    }

# ─── Get filter options from actual data ─────────────────────────────────────
def merge_with_preferred(actual_values, preferred_values):
    """Merge preferred values with actual data values, preferred first"""
    # Remove duplicates while preserving order
    merged = []
    seen = set()
    
    # Add preferred values first
    for val in preferred_values:
        if val not in seen and val in actual_values:
            merged.append(val)
            seen.add(val)
    
    # Add remaining actual values
    for val in actual_values:
        if val not in seen:
            merged.append(val)
            seen.add(val)
    
    return merged

@st.cache_data(ttl=300)  # Cache for 5 minutes
def get_filter_options():
    """Get available filter values from the database"""
    try:
        container = cosmos_containers()["opps"]
        
        # Query for unique values - simplified queries for better performance
        queries = {
            "naics": "SELECT DISTINCT c.primaryNAICS.id FROM c WHERE IS_DEFINED(c.primaryNAICS.id)",
            "psc": "SELECT DISTINCT c.classificationCodeDesc FROM c WHERE IS_DEFINED(c.classificationCodeDesc)",
            "status": "SELECT DISTINCT c.status FROM c WHERE IS_DEFINED(c.status)",
            "sources": "SELECT DISTINCT c.sourcePlatform FROM c WHERE IS_DEFINED(c.sourcePlatform)",
            "procurement": "SELECT DISTINCT c.procurement FROM c WHERE IS_DEFINED(c.procurement)"
        }
        
        options = {}
        for key, query in queries.items():
            try:
                results = list(container.query_items(query, enable_cross_partition_query=True))
                if key == "naics":
                    options[key] = sorted([r["id"] for r in results if r.get("id")])
                elif key == "psc":
                    options[key] = sorted([r["classificationCodeDesc"] for r in results if r.get("classificationCodeDesc")])
                elif key == "status":
                    options[key] = sorted([r["status"] for r in results if r.get("status")])
                elif key == "sources":
                    options[key] = sorted([r["sourcePlatform"] for r in results if r.get("sourcePlatform")])
                elif key == "procurement":
                    options[key] = sorted([r["procurement"] for r in results if r.get("procurement")])
            except Exception as e:
                st.warning(f"Could not load {key} options: {e}")
                options[key] = []
        
        return options
    except Exception as e:
        st.error(f"Could not load filter options: {e}")
        return {"naics": [], "psc": [], "status": [], "sources": [], "procurement": []}
def build_query(start: datetime, end: datetime, flt: Dict) -> tuple[str, List[Dict]]:
    # Use publish date (originalPostedDt or createdDate)
    where = [
        "((IS_DEFINED(c.originalPostedDt) AND c.originalPostedDt >= @start AND c.originalPostedDt <= @end) OR "
        "(IS_DEFINED(c.createdDate) AND c.createdDate >= @start AND c.createdDate <= @end))"
    ]
    params = [
        {"name": "@start", "value": start.isoformat()},
        {"name": "@end",   "value": end.isoformat()},
    ]

    # helper for OR-within
    def _add_OR(col_expr: str, items: list[str], tag: str):
        if not items:
            return
        ors = []
        for i, v in enumerate(items):
            ors.append(col_expr.format(i=i))
            params.append({"name": f"@{tag}{i}", "value": v})
        where.append(f"({' OR '.join(ors)})")

    _add_OR("c.sourcePlatform = @src{i}", flt["src"], "src")
    _add_OR("CONTAINS(UPPER(c.govEntity.title), UPPER(@agency{i}))", flt["agency"], "agency")
    _add_OR("c.primaryNAICS.id = @naics{i}", flt["naics"], "naics")
    _add_OR("CONTAINS(c.classificationCodeDesc, @psc{i})", flt["psc"], "psc")
    _add_OR("c.status = @status{i}", flt["status"], "status")
    _add_OR("c.procurement = @procurement{i}", flt["procurement"], "procurement")

    return f"SELECT * FROM c WHERE {' AND '.join(where)}", params

# ─── Load opportunities ───────────────────────────────────────────────────────
def fetch_opps(start: datetime, end: datetime, flt: Dict) -> pd.DataFrame:
    q, p = build_query(start, end, flt)
    items = cosmos_containers()["opps"].query_items(
        q, parameters=p, enable_cross_partition_query=True
    )
    df = pd.DataFrame(list(items))
    if df.empty:
        return df

    # Unify "posted" date so you can sort / show one column
    df["postedDate"] = pd.to_datetime(
        df.get("originalPostedDt").fillna(df.get("createdDate")), 
        errors="coerce"
    )

    # Flatten nested bits we care about
    df["agency"]     = df["govEntity"].apply(lambda g: g.get("title") if isinstance(g, dict) else None)
    df["naicsCode"]  = df["primaryNAICS"].apply(lambda n: n.get("id") if isinstance(n, dict) else None)
    df["naicsTitle"] = df["primaryNAICS"].apply(lambda n: n.get("title") if isinstance(n, dict) else None)

    # unify contract value - fix the fillna issue
    df["contractValue"] = pd.to_numeric(df.get("contractValue", pd.Series()), errors="coerce").fillna(
        pd.to_numeric(df.get("oppValue", pd.Series()), errors="coerce")
    ).fillna(0)
    # dates - handle both naming conventions
    for c in ["createdDate", "updateDate", "ingestedAt", "ingested_at"]:
        if c in df:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    return df

# ─── Feedback saver ───────────────────────────────────────────────────────────
def save_fb(opp_id: str, rel: str, pur: str):
    if rel == pur == "Unrated":
        return
    
    container = cosmos_containers()["opps"]
    try:
        # Read for etag (optimistic concurrency)
        doc = container.read_item(item=opp_id, partition_key=opp_id)
        
        # Build patch operations
        ops = []
        if rel != "Unrated":
            ops.append({"op": "add", "path": "/relevant", "value": rel})
        if pur != "Unrated":
            ops.append({"op": "add", "path": "/pursued", "value": pur})
        
        # Patch with etag check (safer & cheaper than upsert)
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
    st.header("🔍 Filters (24 h default)")

    now  = datetime.utcnow()
    from_dt = st.date_input("From", now.date() - timedelta(days=1), max_value=now.date())
    to_dt   = st.date_input("To",   now.date(),                     max_value=now.date())

    # Load dynamic filter options
    with st.spinner("Loading filter options..."):
        filter_options = get_filter_options()
    
    # Your preferred values (will appear first in lists)
    preferred_naics = ["541611", "561611", "541214"]
    preferred_psc = ["R408", "R703"]
    preferred_status = ["Pre-RFP", "Post-RFP"]
    
    # Create dynamic filter lists with preferred values first
    source_options = filter_options.get("sources", ["SAM.gov", "GSA eBuy"])
    naics_options = merge_with_preferred(filter_options.get("naics", []), preferred_naics)
    psc_options = merge_with_preferred(filter_options.get("psc", []), preferred_psc)
    status_options = merge_with_preferred(filter_options.get("status", []), preferred_status)
    procurement_options = filter_options.get("procurement", [])
    
    # Filter widgets with counts
    src = st.multiselect("Source platform", source_options)
    agency_txt = st.text_area("Agencies (one per line)", help="Max 100 agencies")
    naics = st.multiselect(f"NAICS ({len(naics_options)} available)", naics_options, help="Your target NAICS codes are listed first")
    psc = st.multiselect(f"PSC ({len(psc_options)} available)", psc_options, help="Your target PSC codes are listed first")
    status = st.multiselect(f"Status ({len(status_options)} available)", status_options)
    procurement = st.multiselect(f"Procurement Phase ({len(procurement_options)} available)", procurement_options)

    st.divider()
    st.subheader("📊 Sort Options")
    
    # Dynamic sort options based on available data
    base_sort_options = ["postedDate", "contractValue", "updateDate"]
    if "ingestedAt" in st.session_state.get("df", pd.DataFrame()).columns:
        base_sort_options.append("ingestedAt")
    elif "ingested_at" in st.session_state.get("df", pd.DataFrame()).columns:
        base_sort_options.append("ingested_at")
    
    sort_by = st.selectbox("Sort by", base_sort_options)
    sort_dir = st.radio("Direction", ["Descending", "Ascending"])

    run = st.button("Apply", type="primary", use_container_width=True)

# ─── Fetch & cache ────────────────────────────────────────────────────────────
if run or "df" not in st.session_state:
    with st.spinner("Loading…"):
        # Process agency list with limits
        agency_list = [a.strip() for a in agency_txt.splitlines() if a.strip()][:100]
        
        st.session_state.df = fetch_opps(
            datetime.combine(from_dt, datetime.min.time()),
            datetime.combine(to_dt,   datetime.max.time()),
            {"src":src, "agency":agency_list, "naics":naics, "psc":psc, "status":status, "procurement":procurement}
        )

df = st.session_state.get("df", pd.DataFrame())
# ─── UI when empty ────────────────────────────────────────────────────────────
if df.empty:
    st.info("No opportunities for the chosen window / filters.")
    st.stop()

# ─── Summary metrics ──────────────────────────────────────────────────────────
col1, col2, col3 = st.columns(3)
col1.metric("Opportunities", f"{len(df):,}")
col2.metric("Total Value",  f"${df['contractValue'].sum():,.0f}")
col3.metric("Avg. Value",   f"${df['contractValue'].mean():,.0f}")

st.divider()

# ─── Search-within results ────────────────────────────────────────────────────
search = st.text_input("Search within results")
if search:
    mask = df.apply(lambda r: search.lower() in str(r).lower(), axis=1)
    df = df[mask]

# ─── Sort ▸ by user selection ─────────────────────────────────────────────────
ascending = sort_dir == "Ascending"
df = df.sort_values(sort_by, ascending=ascending)

# ─── Opportunity cards with feedback ─────────────────────────────────────────
for idx, row in df.iterrows():
    title = row.get("title") or "Untitled"
    value = f"${row['contractValue']:,.0f}"
    src   = row.get("sourcePlatform", "Unknown")

    with st.expander(f"**{title}**  –  {value}  –  {src}"):
        left, right = st.columns([3,1])

        with left:
            st.markdown(f"**Agency:** {row.get('agency')}")
            st.markdown(f"**Status:** {row.get('status')}")
            st.markdown(f"**Procurement Phase:** {row.get('procurement', 'N/A')}")
            st.markdown(f"**PSC:** {row.get('classificationCodeDesc','N/A')}")
            st.markdown(f"**NAICS:** {row.get('naicsCode','')} – {row.get('naicsTitle')}")
            st.markdown(f"**Posted:** {row.get('postedDate')}")
            st.markdown(f"**Solicitation #:** {row.get('solicitationNumber','N/A')}")
            
            # Show response deadline if available
            if row.get('responseDate') and isinstance(row.get('responseDate'), dict):
                response_date = row['responseDate'].get('value', 'N/A')
                st.markdown(f"**Response Deadline:** {response_date}")
            
            st.markdown(f"**Search Term:** `{row.get('searchTerm')}`")
            
            # Show smart tags if available
            if row.get('smartTagObject'):
                tags = [tag.get('name', '') for tag in row['smartTagObject'] if tag.get('name')]
                if tags:
                    st.markdown(f"**Service Tags:** {', '.join(tags[:5])}")  # Show first 5 tags

            if row.get("description") and pd.notna(row.get("description")):
                st.markdown("**Description:**")
                desc = str(row["description"])
                st.write(desc[:600] + ("…" if len(desc) > 600 else ""))

            if row.get("sourceURL"):
                st.link_button("🔗 View on SAM/GovWin", row["sourceURL"])

        with right:
            st.markdown("### Feedback")
            
            # Get current canonical values and map to display options
            current_rel = row.get("relevant", "Unrated")
            current_pur = row.get("pursued", "Unrated")
            
            # Display options with emojis
            rel_options = ["Unrated", "✅ Yes", "❌ No"]
            pur_options = ["Unrated", "🚀 Yes", "💤 No"]
            
            # Map canonical values to display indices
            rel_map = {"Unrated": 0, "Yes": 1, "No": 2}
            pur_map = {"Unrated": 0, "Yes": 1, "No": 2}
            
            rel_index = rel_map.get(current_rel, 0)
            pur_index = pur_map.get(current_pur, 0)
            
            rel = st.radio("Relevant?", rel_options, index=rel_index, key=f"rel_{row['id']}")
            pur = st.radio("Pursued?", pur_options, index=pur_index, key=f"pur_{row['id']}")
            
            if st.button("Save", key=f"save_{row['id']}", use_container_width=True):
                # Convert display values to canonical values
                canon_rel = {"✅ Yes": "Yes", "❌ No": "No"}.get(rel, "Unrated")
                canon_pur = {"🚀 Yes": "Yes", "💤 No": "No"}.get(pur, "Unrated")
                
                # Save to Cosmos with error handling
                if save_fb(str(row["id"]), canon_rel, canon_pur):
                    # Update dataframe in place only if save succeeded
                    if canon_rel != "Unrated":
                        st.session_state.df.at[idx, "relevant"] = canon_rel
                    if canon_pur != "Unrated":
                        st.session_state.df.at[idx, "pursued"] = canon_pur
                    
                    st.success("Saved!")

st.caption(f"Last refresh: {datetime.utcnow():%Y-%m-%d %H:%M UTC}")