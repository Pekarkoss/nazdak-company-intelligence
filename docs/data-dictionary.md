# Data Dictionary

| Metric | Definition / Formula | Source | Null Behavior |
| :--- | :--- | :--- | :--- |

| Last Price | Latest available trading/closing price | Alpha Vantage (Global Quote) | N/A |

| Daily Change % | (Last Price / Previous Close - 1) * 100 | Alpha Vantage (Global Quote) | N/A |

| Revenue TTM | Sum of revenue from the last 4 reported quarters | Alpha Vantage (Income Statement) | N/A |

| Revenue Growth | (Last 4Q Revenue / Previous 4Q Revenue) - 1 | Computed | N/A |

| Gross Profit Margin | Gross Profit TTM / Revenue TTM | Computed | N/A if Revenue=0 |

| Operating Margin | Operating Income TTM / Revenue TTM | Computed | N/A if Revenue=0 |

| Net Profit Margin | Net Income TTM / Revenue TTM | Computed | N/A if Revenue=0 |

| Free Cash Flow | Operating Cash Flow - Capital Expenditures | Alpha Vantage (Cash Flow) | N/A |

| Total Debt | Short-term + Long-term interest-bearing debt | Alpha Vantage (Balance Sheet) | N/A |

| P/E Ratio | Market Capitalization / Net Income TTM | Computed | N/A if Net Income <= 0 |
