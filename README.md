# FitToLend: AI Loan Eligibility Checker (BFSI Capstone)

An AI-powered BFSI (Banking, Financial Services & Insurance) web platform that
brings four personal-finance tools into one dark glassmorphism interface.

## Submission Links

| Item | Link |
|------|------|
| Source code | [`fittolend.html`](./fittolend.html) (this repository) |
| Project report | [`FitToLend_Project_Report.docx`](./FitToLend_Project_Report.docx) |
| Demo video | **https://drive.google.com/drive/folders/1Ymyg40SbyL0dvm4BzX-C0h3prW8K1H6X?usp=sharing** |

## Modules

1. **Loan Eligibility Checker**: estimates the eligible amount, EMI and a confidence score from income, obligations, age, employment, credit score and existing loans, with an explanation of each factor.
2. **Credit Score Analyzer**: analyzes a known score, or estimates one (300 to 900) from payment history, utilization, credit age, accounts and inquiries.
3. **EMI Calculator**: live EMI, total interest, principal vs interest ring chart and a year-by-year amortization table.
4. **AI Financial Tips**: personalized guidance and follow-up Q&A built from your saved results.

## How it works

- **Eligibility:** FOIR bands by income (40% to 65%), tenure capped by retirement age (60 salaried, 65 self-employed), credit-score multiplier (0.55 to 1.0) and a 15% reduction for 4+ active loans.
- **EMI:** `EMI = P x r x (1+r)^n / ((1+r)^n - 1)`, where `r = annual rate / 12 / 100`.
- **Credit estimate:** weighted factors: payment history 35%, utilization 30%, credit age 15%, account mix 10%, inquiries 10%.

## Tech stack

HTML5, CSS3 (glassmorphism, responsive), vanilla JavaScript, Claude AI integration for AI tips, and session-based secure storage for saved calculations.

## How to run

Open `fittolend.html` in any modern browser. All calculators work fully offline.

> The AI responses and saved-records features need the Claude-hosted environment.
> When the file is opened locally, AI Tips falls back to built-in rule-based advice.

## Disclaimer

All results are indicative estimates, not official credit bureau or bank figures,
and not licensed financial advice.

## Author

Karthik
