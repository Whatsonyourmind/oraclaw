# OraClaw LangChain Integration

> **This directory is a redirect.** The LangChain tools live at [`mission-control/integrations/langchain/`](../../mission-control/integrations/langchain/).

## Source

- **Tool wrappers:** [`mission-control/integrations/langchain/oraclaw_tools.py`](../../mission-control/integrations/langchain/oraclaw_tools.py)

## Usage

```python
from oraclaw_tools import OraBanditTool, OraSolverTool, OraForecastTool

# Each tool wraps the OraClaw REST API
bandit = OraBanditTool(base_url="https://oraclaw-api.onrender.com")
result = bandit.run(arms=[...], algorithm="ucb1")
```
