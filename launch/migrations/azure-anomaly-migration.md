# Migrating from Azure Anomaly Detector to OraClaw

**Azure Anomaly Detector is retiring on October 1, 2026.** Microsoft recommends migrating before that date. This guide walks you through replacing it with OraClaw's anomaly detection API.

---

## Feature Comparison

| Feature | Azure Anomaly Detector | OraClaw Anomaly Detection |
|---------|----------------------|--------------------------|
| **Status** | Retiring Oct 2026 | Active, growing |
| **Anomaly methods** | SR-CNN (spectral residual) | Z-score, IQR, Streaming (Welford's) |
| **Univariate** | Yes | Yes |
| **Multivariate** | Yes (MVAD) | Per-metric (submit multiple calls) |
| **Setup time** | Hours (Azure subscription, Cognitive Services resource, keys) | Minutes (single API call) |
| **Training required** | Yes (multivariate: model training) | No (stateless, instant) |
| **Latency** | 200ms-2s (API call + model inference) | <25ms |
| **SDK languages** | C#, Python, Java, JavaScript | Any (REST API) + npm SDK |
| **Cloud lock-in** | Azure only | Cloud-agnostic |
| **Self-host** | No | Yes (MIT licensed) |
| **Pricing** | $0.314/1K transactions (S0 tier) | Free tier or $9-$199/mo flat |

---

## Pricing Comparison

### Azure Anomaly Detector (current)
- **S0 tier**: $0.314 per 1,000 transactions
- Plus Azure subscription costs, Cognitive Services resource
- **Typical cost**: $300-$3,000/mo for production workloads
- **Hidden costs**: Azure networking, Key Vault for secrets, monitoring

### OraClaw
- **Free**: 100 API calls/day, no signup
- **Starter**: $9/mo — 10,000 calls
- **Growth**: $49/mo — 100,000 calls
- **Scale**: $199/mo — 1,000,000 calls
- **Pay-per-call**: $0.02/call via x402 (USDC)

**Example**: 100K detections/month
- Azure: ~$31.40/mo + infrastructure
- OraClaw Growth: $49/mo (flat, includes 18 other algorithms)

---

## Migration Steps

### Step 1: Map Your Azure Resources

In Azure, you had:
- A Cognitive Services resource (or standalone Anomaly Detector resource)
- API key and endpoint URL
- Possibly trained multivariate models

With OraClaw, you need: nothing. Just send HTTP requests.

### Step 2: Replace Univariate Detection

**Before (Azure SDK — Python):**

```python
from azure.ai.anomalydetector import AnomalyDetectorClient
from azure.core.credentials import AzureKeyCredential
from azure.ai.anomalydetector.models import (
    UnivariateDetectionOptions,
    TimeSeriesPoint,
)
from datetime import datetime, timedelta

client = AnomalyDetectorClient(
    endpoint="https://my-resource.cognitiveservices.azure.com/",
    credential=AzureKeyCredential("your-api-key")
)

series = [
    TimeSeriesPoint(timestamp=datetime(2024, 1, 1) + timedelta(hours=i), value=v)
    for i, v in enumerate([10, 12, 11, 13, 12, 11, 45, 12, 10, 13])
]

request = UnivariateDetectionOptions(
    series=series,
    granularity="hourly",
    sensitivity=95
)

response = client.detect_univariate_entire_series(request)

for i, is_anomaly in enumerate(response.is_anomaly):
    if is_anomaly:
        print(f"Anomaly at index {i}: {series[i].value}")
```

**After (OraClaw — curl):**

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "data": [10, 12, 11, 13, 12, 11, 45, 12, 10, 13],
    "method": "zscore",
    "threshold": 3.0
  }'
```

**Response:**

```json
{
  "method": "zscore",
  "anomalies": [
    { "index": 6, "value": 45, "zScore": 3.42 }
  ],
  "stats": {
    "mean": 14.9,
    "stdDev": 10.22,
    "threshold": 3.0
  },
  "totalPoints": 10,
  "anomalyCount": 1
}
```

**After (OraClaw — JavaScript/TypeScript):**

```typescript
const response = await fetch('https://oraclaw-api.onrender.com/api/v1/detect/anomaly', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [10, 12, 11, 13, 12, 11, 45, 12, 10, 13],
    method: 'zscore',
    threshold: 3.0
  })
});

const result = await response.json();
console.log(`Found ${result.anomalyCount} anomalies`);
result.anomalies.forEach(a => {
  console.log(`  Index ${a.index}: value=${a.value}, zScore=${a.zScore}`);
});
```

### Step 3: Replace Multivariate Detection (MVAD)

Azure's MVAD trained a model on multiple correlated metrics. OraClaw is stateless, so the migration pattern is:

1. Send each metric separately to OraClaw
2. Correlate anomalies in your application

```javascript
const metrics = {
  cpu: [45, 48, 47, 92, 46, 44],
  memory: [60, 62, 61, 88, 59, 61],
  latency: [12, 14, 13, 45, 11, 12]
};

const results = await Promise.all(
  Object.entries(metrics).map(async ([name, data]) => {
    const res = await fetch('https://oraclaw-api.onrender.com/api/v1/detect/anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, method: 'zscore', threshold: 2.5 })
    });
    return { name, result: await res.json() };
  })
);

// Find correlated anomalies (same index flagged across multiple metrics)
const anomalyIndices = {};
results.forEach(({ name, result }) => {
  result.anomalies.forEach(a => {
    anomalyIndices[a.index] = anomalyIndices[a.index] || [];
    anomalyIndices[a.index].push(name);
  });
});

// Indices flagged in 2+ metrics are likely correlated anomalies
Object.entries(anomalyIndices)
  .filter(([_, metrics]) => metrics.length >= 2)
  .forEach(([index, metrics]) => {
    console.log(`Correlated anomaly at index ${index}: ${metrics.join(', ')}`);
  });
```

### Step 4: Map Sensitivity to Threshold

Azure Anomaly Detector used a `sensitivity` parameter (0-99, higher = more sensitive).

OraClaw uses `threshold` (Z-score cutoff or IQR multiplier):

| Azure Sensitivity | OraClaw Z-Score Threshold | OraClaw IQR Threshold | Meaning |
|-------------------|--------------------------|----------------------|---------|
| 95-99 (high) | 2.0 | 1.0 | Catch more anomalies (more false positives) |
| 80-94 (medium) | 2.5 | 1.5 | Balanced |
| 50-79 (standard) | 3.0 | 1.5 | Standard outlier detection |
| 0-49 (low) | 3.5+ | 2.0+ | Only extreme anomalies |

### Step 5: Handle Change Points / Last Point Detection

Azure had `detect_univariate_last_point` for real-time single-point detection. With OraClaw, include recent history plus the new point:

```bash
# Include last N points + the new point
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "data": [10, 12, 11, 13, 12, 11, 13, 10, 12, 55],
    "method": "zscore",
    "threshold": 3.0
  }'

# If the last index is in the anomalies array, the new point is anomalous
```

### Step 6: Clean Up Azure Resources

Once OraClaw is running:

1. Delete the Cognitive Services / Anomaly Detector resource
2. Remove any trained multivariate models
3. Revoke API keys
4. Update Azure RBAC / IAM policies
5. Remove Azure SDK dependencies from your project

---

## What's Different

### Simpler (by design)
- **No Azure subscription required**: No resource provisioning, no API keys to manage.
- **No model training**: OraClaw is stateless. No training data, no model management.
- **No SDK dependency**: Just HTTP POST. Works from any language, any platform.

### What you'll need to build yourself
- **Multivariate correlation**: Azure MVAD did this automatically. With OraClaw, you detect per-metric and correlate in your code (see Step 3 above).
- **Change point detection**: Azure had a dedicated endpoint. With OraClaw, include history in each call.
- **Time series alignment**: Azure handled timestamp-based series. OraClaw takes raw number arrays — you handle the time alignment.

### What's better
- **Speed**: <25ms vs. 200ms-2s per call.
- **Cost**: Predictable flat pricing vs. per-transaction billing.
- **No lock-in**: Not tied to Azure. Deploy anywhere.
- **Self-hostable**: MIT licensed.
- **Bonus algorithms**: Same API gives you forecasting (ARIMA, Holt-Winters), optimization, risk analysis, and 15 more algorithms.

---

## FAQ

**Q: Azure Anomaly Detector used SR-CNN (Spectral Residual + CNN). Is OraClaw as accurate?**
A: Different approach. Azure used deep learning, which excels at complex patterns but requires training. OraClaw uses statistical methods (Z-score, IQR) that work instantly without training. For most anomaly detection use cases (metric spikes, drops, outliers), statistical methods perform comparably. If you need deep learning, consider combining OraClaw with a custom model.

**Q: What about the Azure Metrics Advisor?**
A: Azure Metrics Advisor (a higher-level service built on Anomaly Detector) is also being affected. OraClaw replaces the detection layer. For root cause analysis and incident management, you'll need additional tooling.

**Q: Can I use OraClaw from C# / .NET?**
A: Yes. OraClaw is a REST API — any language that can make HTTP POST requests works. There's no C#-specific SDK yet, but `HttpClient` calls are straightforward.

---

## Links

- OraClaw API: `https://oraclaw-api.onrender.com`
- Anomaly endpoint: `POST /api/v1/detect/anomaly`
- npm packages: `@oraclaw/anomaly`
- Azure retirement notice: [Azure Anomaly Detector retirement](https://learn.microsoft.com/en-us/azure/ai-services/anomaly-detector/)
