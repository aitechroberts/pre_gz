"""
GovWin 24-h Dashboard - Main Streamlit Application
Displays government contracting opportunities with Parker Tide default filters.
"""

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

# Import our modules
from data_access import get_filter_options, merge_with_preferred, fetch_opps
from cards import render_card, header_text

# ─── Parker Tide Default Filters ─────────────────────────────────────────────
# Complete NAICS and PSC codes relevant to Parker Tide's services
# Based on pt_naics_psc.docx - includes consulting, technical, administrative services
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

# ─── Sidebar filters ──────────────────────────────────────────────────────────
with st.sidebar:
    st.header("🔍 Filters (New to Us)")
    st.caption("Filter by when we discovered opportunities, not when they were originally posted")

    now = datetime.utcnow()
    from_dt = st.date_input("From", now.date() - timedelta(days=1), max_value=now.date())
    to_dt = st.date_input("To", now.date(), max_value=now.date())

    # Filter Logic Explanation
    st.markdown("### 🔧 Filter Logic")
    st.info("🎯 **Smart Filtering**: NAICS and PSC use OR logic (broad opportunity matching), while Source, Status, and Procurement use AND logic (precise filtering)")
    
    with st.expander("How Smart Filtering Works"):
        st.markdown("""
        **Opportunity Relevance (OR Logic - Broad)**
        - Shows opportunities that match **ANY** selected NAICS code **OR ANY** selected PSC code
        - Casts a wide net to find all potentially relevant work
        
        **Operational Filters (AND Logic - Precise)**  
        - Narrows results by **ALL** selected Sources, Statuses, and Procurement Phases
        - Helps you focus on actionable opportunities
        
        **Example**: Select NAICS 541611 + 561611 and PSC R406 + R408, plus Source "SAM.gov" and Status "Pre-RFP"
        - **Result**: Shows Pre-RFP opportunities from SAM.gov that have either NAICS 541611 OR 561611 OR PSC R406 OR R408
        """)
    
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
    
    # Filter Parker Tide defaults to only include codes that exist in the database
    available_parker_naics = [code for code in PARKER_TIDE_NAICS if code in naics_options]
    available_parker_psc = [code for code in PARKER_TIDE_PSC if code in psc_options]
    
    # Show Parker Tide coverage info
    if available_parker_naics or available_parker_psc:
        st.info(f"🎯 Parker Tide Coverage: {len(available_parker_naics)}/{len(PARKER_TIDE_NAICS)} NAICS codes and {len(available_parker_psc)}/{len(PARKER_TIDE_PSC)} PSC codes have opportunities")
    
    # Filter widgets
    src = st.multiselect("Source platform", source_options, help="Uses AND logic - opportunities must match ALL selected sources")
    
    # NAICS with available Parker Tide defaults pre-selected
    naics = st.multiselect(
        f"NAICS Codes ({len(naics_options)} available)", 
        naics_options,
        default=available_parker_naics,  # Only Parker Tide NAICS that exist in database
        help=f"✅ Pre-selected: {len(available_parker_naics)} Parker Tide relevant NAICS codes found in database. Uses OR logic - shows opportunities matching ANY selected NAICS code."
    )
    
    # PSC with available Parker Tide defaults pre-selected
    psc = st.multiselect(
        f"PSC Codes ({len(psc_options)} available)", 
        psc_options,
        default=available_parker_psc,  # Only Parker Tide PSC that exist in database
        help=f"✅ Pre-selected: {len(available_parker_psc)} Parker Tide relevant PSC codes found in database. Uses OR logic - shows opportunities matching ANY selected PSC code."
    )
    
    # Other filters remain without defaults
    status = st.multiselect(f"Status ({len(status_options)} available)", status_options, help="Uses AND logic - opportunities must match ALL selected statuses")
    procurement = st.multiselect(f"Procurement Phase ({len(procurement_options)} available)", procurement_options, help="Only shows phases from SAM.gov and GSA eBuy opportunities. Uses AND logic - opportunities must match ALL selected phases")

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
        st.session_state.df = fetch_opps(
            datetime.combine(from_dt, datetime.min.time()),
            datetime.combine(to_dt, datetime.max.time()),
            {"src": src, "naics": naics, "psc": psc, "status": status, "procurement": procurement}
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

# ─── Main opportunity display loop with ChatGPT's approach ───────────────────
for idx, row in df.iterrows():
    with st.expander(header_text(row)):
        render_card(row, idx)

st.caption(f"Dashboard refreshed: {datetime.utcnow():%Y-%m-%d %H:%M UTC} | Showing opportunities by discovery date")