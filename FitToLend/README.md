# FitToLend — AI-Powered Financial Decision Platform

**FitToLend** is a high-performance BFSI (Banking, Financial Services & Insurance) single-page web platform designed to simplify and accelerate personal credit and loan decision-making.

Built with a dark glassmorphism aesthetic, real-time SVG financial telemetry, dual-layer AI reasoning (Claude, Gemini, and an Offline BFSI Expert Engine), and automatic Google Sheets persistence.

---

## 🌟 Key Features

1. **Loan Eligibility Checker**
   - **FOIR (Fixed Obligation to Income Ratio) Modeling**: Calculates dynamic debt affordability across income brackets (40% to 65% FOIR cap).
   - **Working-Age Tenure Adjustment**: Automatically checks retirement horizon (capped at 60 for salaried, 65 for self-employed/business).
   - **Multi-Factor Risk Appraisal**: Accounts for credit score multipliers, active liabilities count, and employment stability.
   - **Instant Telemetry**: Approval confidence gauge (0–100%) and factor breakdown cards (positive, neutral, negative).

2. **Credit Score Analyzer**
   - **Known Score Evaluation**: Analyzes bureau scores (300–900) across 5 standard tiers (Poor, Fair, Good, Very Good, Excellent).
   - **Behavioral Score Estimation**: Emulates credit bureau algorithms weighting:
     - Payment history (35%)
     - Credit utilization ratio (30%)
     - Credit history seasoning (15%)
     - Account mix (10%)
     - Hard inquiries (10%)
   - **Animated SVG Donut Gauge**: Smooth animated circular score dial with color transitions.

3. **EMI Calculator & Amortization Engine**
   - **Two-Way Synchronized Inputs**: Sliders linked to numeric fields for Principal, Rate, and Tenure.
   - **Years/Months Toggle**: Seamless unit conversions with boundary guards.
   - **Principal vs. Interest Donut**: Dynamic SVG ring showing repayment breakdown.
   - **Amortization Schedule**: Full year-by-year repayment table showing annual principal paid, interest paid, and remaining balance.

4. **AI Financial Tips & Interactive Q&A**
   - **Contextual Financial Synthesis**: Auto-loads figures from Loan, Credit, and EMI modules.
   - **Dual AI Engine Architecture**:
     - **Built-in BFSI Expert Engine**: 100% offline, zero latency, no API key needed. Generates rich actionable recommendations and answers conversational queries.
     - **Anthropic Claude API**: Direct browser connection to `claude-3-5-haiku` / `claude-3-5-sonnet`.
     - **Google Gemini API**: Direct connection to `gemini-1.5-flash` / `gemini-2.0-flash`.
   - **Interactive Q&A Thread**: Ask follow-up questions like *"Should I prepay my home loan or invest in an index fund?"*.

5. **Google Sheets Sync & Data Persistence**
   - **Google Apps Script Webhook**: Direct HTTP POST endpoint appends rows to your private Google Sheet in real-time.
   - **Local Storage Backup**: Retains past assessments in browser `localStorage`.
   - **1-Click CSV Export**: Download all session logs as a `.csv` spreadsheet at any time.

---

## 🚀 Quick Start

### Option 1: Direct Browser Launch
Simply double-click `index.html` or open it with Google Chrome, Edge, Safari, or Firefox:
```bash
# Windows PowerShell
Start-Process "index.html"
```

### Option 2: Local HTTP Server (Optional)
```bash
# Using Python
python -m http.server 3000

# Using Node / npx
npx serve .
```

---

## 📊 Google Sheets Integration Guide

To connect FitToLend to your own Google Sheet:

1. Create a new Google Sheet at [sheets.new](https://sheets.new).
2. Go to **Extensions** > **Apps Script**.
3. Replace the contents of `Code.gs` with the provided [`google-apps-script.js`](./google-apps-script.js).
4. Click **Deploy** > **New deployment**.
5. Choose **Web app** as the deployment type:
   - **Description**: `FitToLend Webhook`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(required for browser POST requests)*
6. Click **Deploy**, grant permissions, and copy the **Web app URL**.
7. In FitToLend, click **Settings** (top right) > paste the Web App URL into the **Google Apps Script Web App URL** input.
8. Click **Test Sheets Connection** and then **Save & Apply Changes**.

Every loan check, credit analysis, and saved EMI calculation will now automatically append to your private Google Sheet!

---

## 🤖 AI Provider Configuration

1. In FitToLend, click the **Settings** button in the top navigation or sidebar.
2. Select your preferred **AI Provider**:
   - **Built-in BFSI Expert Engine**: Default mode. Works offline without keys.
   - **Anthropic Claude API**: Enter your Anthropic API key (`sk-ant-...`).
   - **Google Gemini API**: Enter your Google Gemini API key (`AIzaSy...`).
3. Click **Save & Apply Changes**.
*(Note: Keys are stored only in your browser's private `localStorage` and never transmitted to any third party.)*

---

## 📁 Project Structure

```
ai-loan-eligibility-checker/
├── index.html               # Complete web app (HTML, CSS, JS, Glassmorphism UI)
├── google-apps-script.js    # Ready-to-deploy Google Sheets Apps Script code
└── README.md                # Documentation and setup guide
```
