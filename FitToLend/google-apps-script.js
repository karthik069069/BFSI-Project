/**
 * FitToLend - Google Apps Script Web App Connector
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new) and name your sheet (e.g. "FitToLend Financial Records").
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in Code.gs and replace with this entire script.
 * 4. Click Deploy > New deployment.
 * 5. Select type: "Web app".
 * 6. Set Description: "FitToLend Webhook".
 * 7. Set Execute as: "Me".
 * 8. Set Who has access: "Anyone" (crucial for web app POST requests).
 * 9. Click Deploy, authorize access, and copy the "Web app URL".
 * 10. Paste the URL into the Settings modal in FitToLend!
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000); // 10 second lock to avoid concurrent write clashes

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure header row exists
    ensureHeaders(sheet);
    
    // Parse incoming payload
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else {
      data = e.parameter || {};
    }

    var timestamp = new Date().toISOString();
    var module = data.module || "General";
    var income = data.income ? "₹" + Number(data.income).toLocaleString('en-IN') : "-";
    var obligations = data.obligations ? "₹" + Number(data.obligations).toLocaleString('en-IN') : "-";
    var loanAmount = data.loanAmount ? "₹" + Number(data.loanAmount).toLocaleString('en-IN') : "-";
    var tenure = data.tenure ? data.tenure + " yrs" : "-";
    var interestRate = data.rate ? data.rate + "%" : "-";
    var creditScore = data.creditScore || data.score || "-";
    var eligibleAmount = data.eligibleAmount ? "₹" + Number(data.eligibleAmount).toLocaleString('en-IN') : "-";
    var emi = data.emi ? "₹" + Number(data.emi).toLocaleString('en-IN') : "-";
    var status = data.status || data.category || "Completed";
    var details = typeof data.details === "object" ? JSON.stringify(data.details) : (data.details || data.summary || "-");

    // Append new row
    sheet.appendRow([
      timestamp,
      module,
      income,
      obligations,
      loanAmount,
      tenure,
      interestRate,
      creditScore,
      eligibleAmount,
      emi,
      status,
      details
    ]);

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Record successfully appended to Google Sheet.",
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "FitToLend Google Sheets Webhook is active and accepting POST requests."
  })).setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet) {
  var headers = [
    "Timestamp",
    "Module",
    "Monthly Income",
    "Monthly Obligations",
    "Requested Loan Amount",
    "Tenure",
    "Interest Rate",
    "Credit Score",
    "Eligible Loan Amount",
    "Monthly EMI",
    "Status / Grade",
    "Notes & Factor Details"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0e1526");
    headerRange.setFontColor("#2ad9a8");
    sheet.setFrozenRows(1);
  }
}
