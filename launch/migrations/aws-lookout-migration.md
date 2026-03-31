# Migrating from AWS Lookout for Metrics to OraClaw

**AWS Lookout for Metrics was discontinued on October 15, 2025.** If you were using it for anomaly detection on time series data, this guide walks you through migrating to OraClaw's anomaly detection API.

---

## Feature Comparison

| Feature | AWS Lookout for Metrics | OraClaw Anomaly Detection |
|---------|------------------------|--------------------------|
| **Status** | Discontinued Oct 2025 | Active, growing |
| **Anomaly methods** | ML-based (proprietary) | Z-score, IQR, Streaming (Welford's) |
| **Setup time** | Hours (data sources, IAM, detectors) | Minutes (single API call) |
| **Training required** | Yes (learning period: hours to days) | No (stateless, instant results) |
| **Multivariate** | Yes | Per-metric (submit multiple calls) |
| **Data sources** | S3, RDS, Redshift, CloudWatch | Any (send data in request body) |
| **Latency** | Minutes (batch detection) | <25ms (real-time) |
| **Alerting** | SNS, Lambda | Webhook-ready (build your own) |
| **Cloud lock-in** | AWS only | Cloud-agnostic |
| **Self-host** | No | Yes (MIT licensed) |
| **Pricing** | ~$0.75/metric/month + data costs | Free tier or $9-$199/mo flat |

---

## Pricing Comparison

### AWS Lookout for Metrics (was)
- $0.75 per metric per month (first 1,000 metrics)
- $0.25 per metric per month (1,001-10,000)
- Plus data ingestion, S3 storage, Lambda trigger costs
- **Typical cost**: $500-$5,000/mo for production workloads

### OraClaw
- **Free**: 100 API calls/day, no signup
- **Starter**: $9/mo — 10,000 calls
- **Growth**: $49/mo — 100,000 calls
- **Scale**: $199/mo — 1,000,000 calls
- **Pay-per-call**: $0.02/call via x402 (USDC)

**Savings**: 80-95% cost reduction for typical workloads.

---

## Migration Steps

### Step 1: Identify Your Lookout Detectors

In AWS, you had anomaly detectors configured with:
- A dataset (S3, RDS, CloudWatch, etc.)
- Metrics to monitor
- Detection frequency (5min, 10min, 1hr, 1day)

With OraClaw, you simply send the data values directly in each API call. No detector setup, no data source configuration.

### Step 2: Replace the Detection Call

**Before (AWS SDK — Python):**

```python
import boto3

client = boto3.client('lookoutmetrics')

# Create detector (one-time setup)
client.create_anomaly_detector(
    AnomalyDetectorName='my-detector',
    AnomalyDetectorConfig={
        'AnomalyDetectorFrequency': 'PT5M'
    }
)

# Create dataset, attach data source, activate...
# (50+ lines of setup code)

# Then wait hours for the learning period...
# Then check for anomalies:
response = client.list_anomaly_group_summaries(
    AnomalyDetectorArn='arn:aws:lookoutmetrics:...',
    SensitivityThreshold=70
)
anomalies = response['AnomalyGroupSummaryList']
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

**After (OraClaw — npm SDK):**

```javascript
import { OraAnomaly } from '@oraclaw/anomaly';

const detector = new OraAnomaly({
  baseUrl: 'https://oraclaw-api.onrender.com'
});

const result = await detector.detect({
  data: [10, 12, 11, 13, 12, 11, 45, 12, 10, 13],
  method: 'zscore',
  threshold: 3.0
});

console.log(result.anomalies);
// [{ index: 6, value: 45, zScore: 3.42 }]
```

### Step 3: Choose Your Detection Method

OraClaw offers two batch methods:

**Z-Score (parametric)** — Best when data is roughly normally distributed:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "data": [your_metric_values],
    "method": "zscore",
    "threshold": 3.0
  }'
```

- `threshold`: Z-score cutoff (default 3.0 = ~99.7% confidence)
- Lower threshold = more sensitive (2.0 catches more anomalies)

**IQR (non-parametric)** — Best for skewed data or when you don't know the distribution:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "data": [your_metric_values],
    "method": "iqr",
    "threshold": 1.5
  }'
```

- `threshold`: IQR multiplier (default 1.5 = standard outlier fence)
- Returns Q1, Q3, IQR, and fence boundaries

### Step 4: Set Up Periodic Detection

AWS Lookout ran on a schedule. With OraClaw, you control the schedule:

**Using cron (Linux/Mac):**

```bash
# Check every 5 minutes
*/5 * * * * /path/to/check-anomalies.sh
```

**Using Node.js (setInterval or node-cron):**

```javascript
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
  const metrics = await getLatestMetrics(); // your data source

  const response = await fetch('https://oraclaw-api.onrender.com/api/v1/detect/anomaly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: metrics,
      method: 'zscore',
      threshold: 2.5
    })
  });

  const result = await response.json();
  if (result.anomalyCount > 0) {
    await sendAlert(result.anomalies); // Slack, email, PagerDuty, etc.
  }
});
```

### Step 5: Clean Up AWS Resources

Once OraClaw is running in production:

1. Deactivate any remaining Lookout detectors
2. Remove IAM roles/policies for Lookout
3. Delete S3 data source configurations
4. Remove CloudFormation/CDK stacks related to Lookout

---

## What's Different

### Simpler (by design)
- **No learning period**: OraClaw is stateless. Send data, get results instantly.
- **No data source setup**: No IAM roles, no S3 paths, no RDS connections. You query your own data and send the values.
- **No detector management**: No creating, activating, or monitoring detectors.

### What you'll need to build yourself
- **Data pipeline**: You need to collect and send metric values to OraClaw (Lookout pulled from your data sources automatically).
- **Alerting**: Lookout integrated with SNS/Lambda. With OraClaw, you call the API and handle alerts in your own code.
- **Dashboard**: Lookout had a console UI. OraClaw is API-only — use Grafana, Datadog, or your own UI.

### What's better
- **Speed**: <25ms vs. minutes of batch processing.
- **Cost**: 80-95% cheaper for typical workloads.
- **No lock-in**: Works from any cloud, any language, any platform.
- **Self-hostable**: MIT licensed — run it on your own infrastructure if needed.
- **Additional algorithms**: OraClaw includes 18 other algorithms (forecasting, optimization, risk, etc.) in the same API.

---

## FAQ

**Q: Can OraClaw monitor CloudWatch metrics directly?**
A: No. OraClaw is a stateless computation API. You fetch your CloudWatch metrics (via AWS SDK) and send the values to OraClaw for analysis. This is actually an advantage — it means OraClaw works with any data source.

**Q: Does OraClaw support multivariate anomaly detection?**
A: OraClaw detects anomalies per metric. For multivariate analysis, submit each metric separately and correlate results in your application logic.

**Q: What about the learning period?**
A: There is none. OraClaw computes anomalies statistically on the data you send. If you want historical context, include historical data in the `data` array alongside recent values.

**Q: Can I self-host OraClaw?**
A: Yes. OraClaw is MIT licensed. Clone the repo and deploy on your own infrastructure.

---

## Links

- OraClaw API: `https://oraclaw-api.onrender.com`
- Anomaly endpoint: `POST /api/v1/detect/anomaly`
- npm packages: `@oraclaw/anomaly`
- AWS deprecation notice: [AWS Lookout for Metrics EOL](https://docs.aws.amazon.com/lookoutmetrics/)
