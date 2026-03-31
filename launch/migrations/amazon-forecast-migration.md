# Migrating from Amazon Forecast to OraClaw

**Amazon Forecast is closed to new customers as of June 2024.** Existing customers can continue using it, but AWS recommends migrating to alternatives. This guide walks you through replacing Amazon Forecast with OraClaw's time series forecasting API.

---

## Feature Comparison

| Feature | Amazon Forecast | OraClaw Forecasting |
|---------|----------------|---------------------|
| **Status** | Closed to new customers | Active, growing |
| **Algorithms** | AutoML (DeepAR+, Prophet, NPTS, ARIMA, ETS, CNN-QR) | ARIMA (auto), Holt-Winters (triple exponential smoothing) |
| **Setup time** | Hours (S3, IAM, dataset groups, predictors) | Minutes (single API call) |
| **Training required** | Yes (predictor training: 20min-2hr) | No (stateless, instant results) |
| **Training data format** | CSV in S3 (specific schema) | JSON array in request body |
| **Confidence intervals** | Yes (quantiles: P10, P50, P90) | Yes (95% confidence bands) |
| **Seasonality** | Auto-detected | Configurable (seasonLength param) |
| **Latency** | Minutes (training) + seconds (inference) | <25ms (total) |
| **Batch forecasting** | Yes (export to S3) | Yes (batch API endpoint) |
| **Cloud lock-in** | AWS only | Cloud-agnostic |
| **Self-host** | No | Yes (MIT licensed) |
| **Pricing** | ~$0.60/1K forecasts + training + S3 | Free tier or $9-$199/mo flat |

---

## Pricing Comparison

### Amazon Forecast (current for existing customers)
- **Training**: $0.088 per training hour
- **Forecasts**: $0.60 per 1,000 forecast points
- **Data storage**: $0.088 per GB/month
- Plus S3 storage, IAM, Lambda for automation
- **Typical cost**: $500-$10,000/mo for production workloads

### OraClaw
- **Free**: 100 API calls/day, no signup
- **Starter**: $9/mo — 10,000 calls
- **Growth**: $49/mo — 100,000 calls
- **Scale**: $199/mo — 1,000,000 calls
- **Pay-per-call**: $0.05/call via x402 (USDC)

**Example**: 50K forecast calls/month
- Amazon Forecast: ~$30 forecasts + $50-$200 training + S3 + infra = ~$100-$300/mo
- OraClaw Growth: $49/mo (flat, includes anomaly detection + 17 other algorithms)

---

## Migration Steps

### Step 1: Understand Your Current Setup

In Amazon Forecast, you had:
- **Dataset Groups**: Collections of target time series, related time series, item metadata
- **Datasets**: CSV files in S3 with `timestamp`, `item_id`, `target_value` columns
- **Predictors**: Trained ML models (AutoML or manual algorithm selection)
- **Forecasts**: Generated predictions exported to S3

With OraClaw, you need: a JSON array of numbers. That's it.

### Step 2: Replace the Forecast Call

**Before (Amazon Forecast — Python):**

```python
import boto3

# One-time setup (simplified — actual setup is 50+ lines)
forecast_client = boto3.client('forecast')
query_client = boto3.client('forecastquery')

# Create dataset group, import data from S3, create predictor...
# Wait 20-120 minutes for training...

# Then query:
response = query_client.query_forecast(
    ForecastArn='arn:aws:forecast:us-east-1:123456789:forecast/my_forecast',
    Filters={
        'item_id': 'product_001'
    }
)

predictions = response['Forecast']['Predictions']
p50 = [p['Value'] for p in predictions['p50']]
p10 = [p['Value'] for p in predictions['p10']]
p90 = [p['Value'] for p in predictions['p90']]
```

**After (OraClaw — curl, ARIMA):**

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/predict/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "data": [120, 135, 148, 155, 170, 165, 180, 192, 188, 201, 215, 225,
             130, 142, 155, 162, 178, 173, 188, 200, 196, 210, 224, 235],
    "steps": 6,
    "method": "arima"
  }'
```

**Response:**

```json
{
  "forecast": [238.5, 245.2, 251.8, 258.1, 264.7, 271.3],
  "confidence": {
    "lower": [225.1, 228.4, 230.9, 233.2, 235.1, 236.8],
    "upper": [251.9, 262.0, 272.7, 283.0, 294.3, 305.8]
  },
  "model": "ARIMA(1,1,0)",
  "method": "arima",
  "inputLength": 24,
  "steps": 6
}
```

**After (OraClaw — curl, Holt-Winters for seasonal data):**

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/predict/forecast \
  -H "Content-Type: application/json" \
  -d '{
    "data": [120, 135, 148, 155, 170, 165, 180, 192, 188, 201, 215, 225,
             130, 142, 155, 162, 178, 173, 188, 200, 196, 210, 224, 235],
    "steps": 6,
    "method": "holt-winters",
    "seasonLength": 12
  }'
```

**After (OraClaw — JavaScript/TypeScript):**

```typescript
const response = await fetch('https://oraclaw-api.onrender.com/api/v1/predict/forecast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: monthlySalesData,  // array of numbers
    steps: 6,                // forecast 6 periods ahead
    method: 'arima'          // or 'holt-winters'
  })
});

const result = await response.json();

console.log('Forecast:', result.forecast);
console.log('Lower bound:', result.confidence.lower);
console.log('Upper bound:', result.confidence.upper);
console.log('Model:', result.model);
```

### Step 3: Choose Your Forecasting Method

OraClaw offers two methods:

**ARIMA (default)** — Best for general time series:

```json
{
  "data": [/* at least 20 data points */],
  "steps": 6,
  "method": "arima"
}
```

- Automatic order selection (auto-ARIMA)
- Handles trends and non-stationarity
- Requires minimum 20 data points

**Holt-Winters** — Best for seasonal data with fewer points:

```json
{
  "data": [/* at least 2 x seasonLength points */],
  "steps": 6,
  "method": "holt-winters",
  "seasonLength": 12
}
```

- Triple exponential smoothing (level + trend + seasonality)
- Requires minimum `2 x seasonLength` data points
- Set `seasonLength` to match your data (12 for monthly with yearly cycle, 7 for daily with weekly cycle, etc.)

### Step 4: Map Amazon Forecast Concepts to OraClaw

| Amazon Forecast Concept | OraClaw Equivalent |
|------------------------|-------------------|
| Dataset (CSV in S3) | `data` array in request body |
| Predictor (trained model) | Not needed (stateless) |
| Forecast horizon | `steps` parameter |
| Forecast frequency | Determined by your data spacing |
| AutoML algorithm selection | `method: "arima"` (auto order selection) |
| DeepAR+ | Use `method: "arima"` (statistical, not deep learning) |
| Prophet | Use `method: "holt-winters"` (similar decomposition) |
| ETS | Use `method: "holt-winters"` (Holt-Winters is a form of ETS) |
| P10/P50/P90 quantiles | `confidence.lower` / `forecast` / `confidence.upper` (95% bands) |
| Item-level forecasts | One API call per item |
| Related time series | Not supported (univariate only) |

### Step 5: Handle Multi-Item Forecasting

Amazon Forecast handled multiple items in one predictor. With OraClaw, forecast each item separately:

```javascript
const items = {
  product_001: [120, 135, 148, 155, 170, 165, 180, 192, 188, 201,
                215, 225, 130, 142, 155, 162, 178, 173, 188, 200],
  product_002: [80, 85, 90, 88, 95, 92, 100, 105, 102, 110,
                115, 120, 85, 90, 95, 93, 100, 97, 105, 110],
  product_003: [200, 210, 205, 220, 230, 225, 240, 250, 245, 260,
                270, 280, 210, 220, 215, 230, 240, 235, 250, 260]
};

const forecasts = await Promise.all(
  Object.entries(items).map(async ([itemId, data]) => {
    const res = await fetch('https://oraclaw-api.onrender.com/api/v1/predict/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, steps: 6, method: 'arima' })
    });
    return { itemId, forecast: await res.json() };
  })
);

forecasts.forEach(({ itemId, forecast }) => {
  console.log(`${itemId}: ${forecast.forecast.map(v => v.toFixed(1)).join(', ')}`);
});
```

### Step 6: Clean Up AWS Resources

Once OraClaw is running:

1. Delete Amazon Forecast predictors and forecasts
2. Delete dataset groups and datasets
3. Remove S3 data used for Forecast imports
4. Clean up IAM roles/policies for Forecast
5. Remove boto3/forecast SDK dependencies
6. Delete any Lambda functions that automated Forecast workflows

---

## What's Different

### Simpler (by design)
- **No training**: OraClaw fits the model on your data at request time. No 20-minute predictor training.
- **No data pipeline**: No S3 uploads, no CSV formatting, no dataset imports. Send a JSON array.
- **No infrastructure**: No IAM roles, no S3 buckets, no Lambda glue code.

### What you'll need to build yourself
- **Data collection**: Amazon Forecast pulled from S3 automatically. You'll need to query your own data source and pass the values to OraClaw.
- **Multi-item management**: Forecast managed multiple items in one predictor. With OraClaw, you call once per item.
- **Exogenous variables**: Amazon Forecast supported "related time series" (e.g., price, promotions, weather). OraClaw is univariate — you'll need to handle feature engineering separately.

### What's better
- **Speed**: <25ms per forecast vs. minutes of training + seconds of inference.
- **Cost**: 80-95% cheaper for typical workloads.
- **No lock-in**: Works from any cloud, any language.
- **Always available**: No "closed to new customers" risk. MIT licensed and self-hostable.
- **Bonus algorithms**: Same API gives you anomaly detection, optimization, risk analysis, bandits, and 14 more algorithms.

---

## FAQ

**Q: Amazon Forecast had DeepAR+ and CNN-QR. Is OraClaw's ARIMA as accurate?**
A: For most business forecasting (demand, revenue, capacity), ARIMA and Holt-Winters perform comparably to deep learning models, especially with <1000 data points. Deep learning excels when you have thousands of related time series (cold-start items, cross-series patterns). If you need that, consider Nixtla TimeGPT or a custom model alongside OraClaw.

**Q: Can I use holiday/event features?**
A: Not directly. OraClaw is univariate. You can pre-process your data to remove known holiday effects before sending, or use Holt-Winters with appropriate `seasonLength` to capture regular seasonal patterns.

**Q: What's the minimum data required?**
A: ARIMA needs at least 20 data points. Holt-Winters needs at least `2 x seasonLength` points (e.g., 24 points for monthly data with `seasonLength: 12`).

**Q: Can I get P10/P50/P90 quantiles like Amazon Forecast?**
A: OraClaw returns 95% confidence bands (`confidence.lower` and `confidence.upper`) around the point forecast. The point forecast is equivalent to P50. The bands approximate P2.5 and P97.5.

---

## Links

- OraClaw API: `https://oraclaw-api.onrender.com`
- Forecast endpoint: `POST /api/v1/predict/forecast`
- npm packages: `@oraclaw/forecast`
- AWS notice: [Amazon Forecast — closed to new customers](https://docs.aws.amazon.com/forecast/)
