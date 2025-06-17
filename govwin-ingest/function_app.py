import os
import logging
import datetime as dt
import requests
import azure.functions as func
from azure.cosmos import CosmosClient

app = func.FunctionApp()

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

@app.schedule(schedule="0 0 6 * * *", arg_name="timer", run_on_startup=True, use_monitor=True)
def pull_daily(timer: func.TimerRequest):
    logger = logging.getLogger("pull_daily")
    logger.info("🚀 Starting ingest at %s", dt.datetime.utcnow().isoformat())

    token = _get_token()
    headers = {"Authorization": f"Bearer {token}"}
    # by default get last 24 h; override via local.settings if needed
    date_from = (dt.datetime.utcnow() - dt.timedelta(days=7)).strftime("%Y-%m-%d")
    search_terms = [s.strip() for s in os.getenv("SEARCH_TERMS", "").split(",") if s.strip()]

    container = _cosmos_container()
    total_upserts = 0
    for term in search_terms:
        params = {
            "q":                   term,
            "oppSelectionDateFrom": date_from,              # last 24 h or override
            "market":              "Federal",               # SAM/GSA runs here
            "oppType":             "FBO,BID",               # SAM Notices + Bid alerts
            # "naics":               "541611,561611,541214",  # your NAICS filters
            # "classificationCodes": "R408,R703",             # your PSC filters
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
                    resp = requests.get(
                        contracts_url,
                        headers=headers,
                        params={"max": 100, "offset": 0},
                        timeout=30,
                    )
                    resp.raise_for_status()
                    contracts_list = resp.json().get("Contracts", [])
                    total_value = sum(c.get("fedPrimeObligationAmt", 0) for c in contracts_list)

                # 3️⃣ If still None, leave it null in Cosmos
                opp["contractValue"] = total_value

                # Augment with metadata for Streamlit
                opp["searchTerm"] = term
                opp["oppType"]    = params["oppType"]
                opp["relevant"]   = None
                opp["pursued"]    = None

                logger.info(
                    "   ⬆️ Upserting opp id=%s (type=%s, contractValue=%s)",
                    opp_id, opp_type, total_value
                )
                container.upsert_item(opp)
                total_upserts += 1


    logger.info(
        "✅ Ingest complete: processed %d terms, upserted %d records (started at %s)",
        len(search_terms),
        total_upserts,
        dt.datetime.utcnow().isoformat(),
    )
