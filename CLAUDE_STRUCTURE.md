# GovWin Dashboard Project Structure (v2)

## Directory Layout

```
govwin-dashboard/
├── govwin-ingest/              # Azure Function
│   ├── function_app.py         # Timer-triggered function
│   ├── pyproject.toml          # Poetry dependencies
│   ├── poetry.lock             # Locked dependencies
│   ├── local.settings.json     # Local config (gitignored)
│   └── host.json               # Function runtime config
│
├── streamlit/                  # Dashboard
│   ├── app.py                  # Streamlit app
│   ├── pyproject.toml          # Poetry dependencies
│   ├── poetry.lock             # Locked dependencies
│   ├── Dockerfile              # Container config
│   ├── .streamlit/
│   │   └── config.toml         # Streamlit config
│   └── secrets.toml            # Local secrets (gitignored)
│
├── scripts/
│   └── deploy-azure.sh         # One-click deployment
│
└── README.md
```

## Quick Start with Poetry

### 1. Install Poetry

```bash
# macOS/Linux/WSL
curl -sSL https://install.python-poetry.org | python3 -

# Windows (PowerShell)
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | py -
```

### 2. Set up Function project

```bash
cd govwin-ingest
poetry install
poetry shell  # Activate virtual environment

# Test locally
func start
```

### 3. Set up Streamlit project

```bash
cd streamlit
poetry install
poetry shell

# Test locally
streamlit run app.py
```

### 4. Deploy to Azure

```bash
# Make script executable
chmod +x scripts/deploy-azure.sh

# Run deployment
./scripts/deploy-azure.sh

# Deploy function code
cd govwin-ingest
poetry export -f requirements.txt --output requirements.txt --without-hashes
func azure functionapp publish <function-name>
```

## Key Differences from v1

1. **No Service Bus** - Direct timer → API → Cosmos flow
2. **No Redis** - Cosmos handles all caching needs
3. **Simple partition key** - Just use opportunity ID
4. **Poetry for dependencies** - Better dependency management
5. **Managed Identity ready** - Just swap the keys when ready

## Environment Variables

### Function App
- `COSMOS_URL`: Your Cosmos DB endpoint
- `COSMOS_KEY`: Primary key (use Managed Identity in production)
- `GOVWIN_CLIENT_ID`: OAuth client ID
- `GOVWIN_CLIENT_SECRET`: OAuth client secret
- `GOVWIN_USERNAME`: GovWin username
- `GOVWIN_PASSWORD`: GovWin password
- `SEARCH_TERMS`: Pipe-delimited search terms

### Streamlit
- `COSMOS_URL`: Same Cosmos DB endpoint
- `COSMOS_KEY`: Same key (or read-only key)

## Testing

### Manual trigger for Function
```bash
# Test single search term
curl -X POST http://localhost:7071/api/trigger?term=Personnel%20Security

# Test full run
curl -X POST http://localhost:7071/api/trigger
```

### Initialize Cosmos DB
```bash
curl -X POST http://localhost:7071/api/init
```

## Cost Optimization

- Function App: ~$0 (Consumption plan, runs once daily)
- Cosmos DB: ~$24/month (400 RU/s, can scale down)
- Container App: ~$10/month (0.5 vCPU, 1GB RAM)
- **Total: ~$35/month**

## Monitoring

View Function logs:
```bash
func azure functionapp logstream <function-name>
```

View Container App logs:
```bash
az containerapp logs show -n <app-name> -g <resource-group>
```