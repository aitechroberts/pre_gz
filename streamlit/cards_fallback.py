"""
Opportunity card rendering functions.
Each opportunity type (GovWin Tracked, SAM.gov, etc.) has its own specialized renderer.
"""

import pandas as pd
import streamlit as st
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosAccessConditionFailedError

from data_access import cosmos_containers

# ─── URL validation and utility functions ────────────────────────────────────
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

def safe_link_button(label, url):
    """Create a link button with URL validation"""
    if is_valid_url(url):
        st.link_button(label, url)  # Remove key parameter - not supported
    else:
        st.caption("🔗 No source URL available")

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

# ─── Feedback saving functionality ────────────────────────────────────────────
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

# ─── Opportunity type-specific render functions ───────────────────────────────
def render_tracked_card(row, idx):
    """Render GovWin Tracked opportunity with all its rich data"""
    left, right = st.columns([3, 1])
    
    with left:
        st.markdown(f"**Agency:** {row.get('agency')}")
        st.markdown(f"**Source:** GovWin Tracked")
        st.markdown(f"**Status:** {row.get('status')}")
        
        # Primary NAICS
        if row.get('primaryNAICS') and isinstance(row['primaryNAICS'], dict):
            naics_id = row['primaryNAICS'].get('id', '')
            naics_title = row['primaryNAICS'].get('title', '')
            st.markdown(f"**Primary NAICS:** {naics_id} – {naics_title}")
        
        # Duration
        if row.get('duration'):
            st.markdown(f"**Duration:** {row.get('duration')}")
        
        # Contract Types (NEW - this is what we wanted!)
        if row.get("contractTypes") and isinstance(row["contractTypes"], list):
            contract_types = [ct.get("title", "") for ct in row["contractTypes"] if isinstance(ct, dict)]
            if contract_types:
                st.markdown(f"**Contract Types:** {', '.join(contract_types)}")
        
        # Competition Types (Set-Asides for GovWin)
        if row.get("competitionTypes") and isinstance(row["competitionTypes"], list):
            comp_types = [ct.get("title", "") for ct in row["competitionTypes"] if isinstance(ct, dict)]
            if comp_types:
                st.markdown(f"**Competition:** {', '.join(comp_types)}")
        
        # Type of Award
        if row.get('typeOfAward'):
            st.markdown(f"**Award Type:** {row.get('typeOfAward')}")
        
        # Primary Requirement
        if row.get('primaryRequirement'):
            st.markdown(f"**Primary Requirement:** {row.get('primaryRequirement')}")
        
        # Award Date
        if row.get('awardDate') and isinstance(row.get('awardDate'), dict):
            award_date = row['awardDate'].get('value', 'N/A')
            if award_date != 'N/A':
                award_parsed = pd.to_datetime(award_date, errors='coerce')
                if pd.notna(award_parsed):
                    st.markdown(f"**Award Date:** {award_parsed.strftime('%Y-%m-%d')}")
        
        # Solicitation Date
        if row.get('solicitationDate') and isinstance(row.get('solicitationDate'), dict):
            sol_date = row['solicitationDate'].get('value', 'N/A')
            if sol_date != 'N/A':
                sol_parsed = pd.to_datetime(sol_date, errors='coerce')
                if pd.notna(sol_parsed):
                    st.markdown(f"**Solicitation Date:** {sol_parsed.strftime('%Y-%m-%d')}")
        
        _render_common_fields(row)
    
    with right:
        _render_feedback_section(row, idx)

def render_sam_card(row, idx):
    """Render SAM.gov (FBO) opportunity"""
    left, right = st.columns([3, 1])
    
    with left:
        st.markdown(f"**Agency:** {row.get('agency')}")
        st.markdown(f"**Source:** SAM.gov")
        st.markdown(f"**Status:** {row.get('status')}")
        
        # PSC Code - show extracted code with description fallback
        psc_code = row.get('pscCode')
        psc_desc = row.get('classificationCodeDesc', 'N/A')
        if psc_code:
            st.markdown(f"**PSC:** {psc_code} - {psc_desc}")
        else:
            st.markdown(f"**PSC:** {psc_desc}")
            
        st.markdown(f"**NAICS:** {row.get('naicsCode', '')} – {row.get('naicsTitle', '')}")
        
        # Response Date (specific to SAM.gov)
        if row.get('responseDate') and isinstance(row.get('responseDate'), dict):
            response_date = row['responseDate'].get('value', 'N/A')
            st.markdown(f"**Response Deadline:** {response_date}")
        
        # Set-Asides (SAM.gov specific)
        if row.get('setAsides') and isinstance(row['setAsides'], list):
            set_asides = [sa.get('title', '') for sa in row['setAsides'] if isinstance(sa, dict)]
            if set_asides:
                st.markdown(f"**Set-Asides:** {', '.join(set_asides)}")
        
        _render_common_fields(row)
    
    with right:
        _render_feedback_section(row, idx)

def render_gsa_card(row, idx):
    """Render GSA eBuy/Task Order opportunity"""
    left, right = st.columns([3, 1])
    
    with left:
        st.markdown(f"**Agency:** {row.get('agency')}")
        st.markdown(f"**Source:** GSA eBuy/Task Orders")
        st.markdown(f"**Status:** {row.get('status')}")
        st.markdown(f"**NAICS:** {row.get('naicsCode', '')} – {row.get('naicsTitle', '')}")
        
        # Task order specific fields would go here
        # (parent contract vehicle, etc.)
        
        _render_common_fields(row)
    
    with right:
        _render_feedback_section(row, idx)

def render_generic_card(row, idx):
    """Fallback for unknown opportunity types"""
    left, right = st.columns([3, 1])
    
    with left:
        st.markdown(f"**Agency:** {row.get('agency')}")
        st.markdown(f"**Source:** {row.get('source', 'Unknown')}")
        st.markdown(f"**Status:** {row.get('status')}")
        st.markdown(f"**NAICS:** {row.get('naicsCode', '')} – {row.get('naicsTitle', '')}")
        
        # Show PSC if available
        psc_code = row.get('pscCode')
        if psc_code:
            st.markdown(f"**PSC:** {psc_code}")
        
        _render_common_fields(row)
    
    with right:
        _render_feedback_section(row, idx)

# ─── Common field rendering functions ─────────────────────────────────────────
def _render_common_fields(row):
    """Render fields common to all opportunity types"""
    # Common fields that appear for all types
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
    
    st.markdown(f"**Search Term:** `{row.get('searchTerm')}`")
    
    # Show all NAICS codes if available
    if row.get('allNAICSCodes') and isinstance(row['allNAICSCodes'], list):
        all_naics = [naics.get('id', '') for naics in row['allNAICSCodes'] if isinstance(naics, dict)]
        if len(all_naics) > 1:
            st.markdown(f"**All NAICS:** {', '.join(all_naics)}")
    
    # Smart tags with primary/secondary separation
    if row.get('smartTagObject'):
        primary_tags = [tag.get('name', '') for tag in row['smartTagObject'] if tag.get('isPrimary') == 1]
        secondary_tags = [tag.get('name', '') for tag in row['smartTagObject'] if tag.get('isPrimary') == 0]
        
        if primary_tags:
            st.markdown(f"**Primary Tags:** {', '.join(primary_tags)}")
        if secondary_tags:
            st.markdown(f"**Secondary Tags:** {', '.join(secondary_tags[:3])}")

    if row.get("description") and pd.notna(row.get("description")):
        st.markdown("**Description:**")
        desc = str(row["description"])
        st.write(desc[:600] + ("…" if len(desc) > 600 else ""))

    # Fixed sourceURL with validation
    safe_link_button("🔗 View on SAM/GovWin", row.get("sourceURL"))

def _render_feedback_section(row, idx):
    """Render the feedback section for all opportunity types"""
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

# ─── Main dispatcher with ChatGPT's pattern ──────────────────────────────────
CARD_RENDERERS = {
    "GovWin Tracked": render_tracked_card,
    "SAM.gov": render_sam_card,
    "GSA eBuy/Task Orders": render_gsa_card,
}

def render_card(row, idx):
    """Dispatch to the right renderer based on opportunity source"""
    source = row.get("source", "Unknown")
    renderer = CARD_RENDERERS.get(source, render_generic_card)
    renderer(row, idx)

def header_text(row):
    """Generate header text for opportunity expander"""
    title = row.get("title") or "Untitled"
    value = f"${row['contractValue']:,.0f}"
    source = row.get("source", "Unknown")
    return f"**{title}** – {value} – {source}"