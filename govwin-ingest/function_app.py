import os
import logging
import datetime as dt
import requests
import re
import azure.functions as func
from azure.cosmos import CosmosClient

app = func.FunctionApp()

LOOKBACK_DAYS = 2

def _get_token() -> str:
    resp = requests.post(
        "https://services.govwin.com/neo-ws/oauth/token",
        data={
            "client_id":     os.getenv("GOVWIN_CLIENT_ID"),
            "client_secret": os.getenv("GOVWIN_CLIENT_SECRET"),
            "grant_type":    "password",
            "username":      os.getenv("GOVWIN_USERNAME"),
            "password":      os.getenv("GOVWIN_PASSWORD"),
            "scope":         "read",
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

def _cosmos_container():
    client = CosmosClient(
        url=os.getenv("COSMOS_URL"),
        credential=os.getenv("COSMOS_KEY"),
        consistency_level="Session",
    )
    return client.get_database_client("govwin").get_container_client("opportunities")

def _extract_psc_code(classification_desc: str) -> str:
    """
    Extract PSC code from classificationCodeDesc.
    
    Examples:
    "R406 - Support- Professional: Program Management/Support" -> "R406"
    "Z1ND - Maintenance of Real Property" -> "Z1ND" 
    "R408 - Support- Professional: Policy Review/Development" -> "R408"
    
    Returns None if no valid PSC code found.
    """
    if not classification_desc or not isinstance(classification_desc, str):
        return None
    
    # PSC codes are typically 4 characters at the start, followed by space/dash
    # Pattern: Letter followed by 3 alphanumeric characters at the start
    match = re.match(r'^([A-Z][A-Z0-9]{3})\s*[-\s]', classification_desc.strip())
    if match:
        return match.group(1)
    
    # Fallback: try to extract any 4-char alphanumeric code at the start
    match = re.match(r'^([A-Z0-9]{4})\s*[-\s]', classification_desc.strip())
    if match:
        return match.group(1)
    
    return None

@app.schedule(schedule="0 0 6 * * *", arg_name="timer", run_on_startup=True, use_monitor=True)
def pull_daily(timer: func.TimerRequest):
    logger = logging.getLogger("pull_daily")
    logger.info("🚀 Starting ingest at %s", dt.datetime.utcnow().isoformat())

    token = _get_token()
    headers = {"Authorization": f"Bearer {token}"}
    # by default get last 1 day; override via local.settings if needed
    date_from = (dt.datetime.utcnow() - dt.timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    search_terms = [s.strip() for s in os.getenv("SEARCH_TERMS", "").split(",") if s.strip()]

    container = _cosmos_container()
    total_upserts = 0
    psc_extractions = 0  # Count successful PSC extractions
    
    for term in search_terms:
        params = {
            "q":                   term,
            "oppSelectionDateFrom": date_from,              
            "market":              "Federal",               
            "oppType":             "FBO,TNS,OPP",   
            "max":                 100,
            "offset":              0,
        }
        url = "https://services.govwin.com/neo-ws/opportunities"
        while True:
            logger.info("🔎 Fetching GOVWIN for term %r…", term)
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json().get("opportunities", [])
            logger.info("   → GOVWIN returned %d opportunities", len(data))
            if not data:
                break
            for opp in data:
                opp_id   = opp["id"]
                opp_type = opp.get("type", "").lower()

                # 1️⃣ Try the simple top-level value first
                total_value = opp.get("oppValue") or opp.get("value")

                # 2️⃣ If there was no top-level value AND it's an FBO, fetch contracts
                if total_value is None and opp_type == "fbo":
                    contracts_url = f"https://services.govwin.com/neo-ws/opportunities/{opp_id}/contracts"
                    contracts_resp = requests.get(  # ← Fixed: Use different variable name
                        contracts_url,
                        headers=headers,
                        params={"max": 100, "offset": 0},
                        timeout=30,
                    )
                    contracts_resp.raise_for_status()
                    contracts_list = contracts_resp.json().get("Contracts", [])
                    total_value = sum(c.get("fedPrimeObligationAmt", 0) for c in contracts_list)

                # 3️⃣ If still None, leave it null in Cosmos
                opp["contractValue"] = total_value

                # 4️⃣ Create combined NAICS list (primary + additional)
                all_naics_codes = []
                primary_naics = opp.get("primaryNAICS")
                if primary_naics:
                    all_naics_codes.append(primary_naics)
                
                additional_naics = opp.get("additionalNaics", [])
                if additional_naics:
                    all_naics_codes.extend(additional_naics)
                    logger.info(f"   📋 Found {len(additional_naics)} additional NAICS for {opp_id}")
                
                opp["allNAICSCodes"] = all_naics_codes

                # 5️⃣ Extract PSC code from classificationCodeDesc (NEW!)
                classification_desc = opp.get("classificationCodeDesc")
                if classification_desc:
                    psc_code = _extract_psc_code(classification_desc)
                    if psc_code:
                        opp["pscCode"] = psc_code
                        psc_extractions += 1
                        logger.info(f"   📋 Extracted PSC code '{psc_code}' from '{classification_desc[:50]}...'")
                    else:
                        logger.warning(f"   ⚠️  Could not extract PSC from '{classification_desc[:50]}...'")
                else:
                    opp["pscCode"] = None

                # 6️⃣ Map source based on opportunity type
                source_mapping = {
                    "fbo": "SAM.gov",
                    "tns": "GSA eBuy/Task Orders", 
                    "opp": "GovWin Tracked",
                    "trackedopp": "GovWin Tracked",  # ← Fixed: Handle both variants
                    "bid": "State/Local Bids",
                    "top": "Opportunity Manager"
                }
                opp["source"] = source_mapping.get(opp_type, "Unknown")

                # 7️⃣ Add user-requested fields with better names
                opp["setAsides"] = opp.get("competitionTypes", [])

                # 8️⃣ Augment with metadata for Streamlit
                opp["searchTerm"] = term
                opp["ingestedAt"] = dt.datetime.utcnow().isoformat() 
                opp["relevant"]   = None
                opp["pursued"]    = None

                logger.info(
                    "   ⬆️ Upserting opp id=%s (type=%s, source=%s, contractValue=%s, naicsCount=%d, pscCode=%s)",
                    opp_id, opp_type, opp.get("source"), total_value, len(all_naics_codes), opp.get("pscCode", "None")
                )
                container.upsert_item(opp)
                total_upserts += 1
            params["offset"] += len(data)

    logger.info(
        "✅ Ingest complete: processed %d terms, upserted %d records, extracted %d PSC codes (started at %s)",
        len(search_terms),
        total_upserts,
        psc_extractions,
        dt.datetime.utcnow().isoformat(),
    )