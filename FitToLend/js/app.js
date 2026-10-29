/* FitToLend - application logic: navigation, loan eligibility, credit score, EMI, AI tips, Google Sheets sync */
(function(){
  "use strict";

  /* ============ Configuration & Persistence ============ */
  const CONFIG_KEY = 'fit_to_lend_config';
  const STORAGE_KEY = 'fit_to_lend_records';

  function loadConfig(){
    try{
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {
        sheetUrl: '',
        aiProvider: 'smart-local', // 'smart-local' | 'claude' | 'gemini'
        apiKey: ''
      };
    }catch(e){
      return { sheetUrl: '', aiProvider: 'smart-local', apiKey: '' };
    }
  }

  function saveConfig(cfg){
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    updateConfigUI();
  }

  let currentConfig = loadConfig();

  function updateConfigUI(){
    const pill = document.getElementById('topbarStatusPill');
    const text = document.getElementById('statusPillText');
    const badge = document.getElementById('aiEngineBadge');

    if(currentConfig.sheetUrl){
      pill.classList.remove('offline');
      text.textContent = 'Sheets Synced';
    } else {
      pill.classList.add('offline');
      text.textContent = 'Local Mode (Sheets unlinked)';
    }

    if(currentConfig.aiProvider === 'claude'){
      badge.textContent = 'Claude AI';
      badge.className = 'badge badge-good';
    } else if(currentConfig.aiProvider === 'gemini'){
      badge.textContent = 'Gemini AI';
      badge.className = 'badge badge-good';
    } else {
      badge.textContent = 'Built-in BFSI Engine';
      badge.className = 'badge badge-warn';
    }
  }

  /* ============ Navigation ============ */
  const views = ["dashboard","loan","credit","emi","ai"];
  const titles = {
    dashboard:["Overview","Your snapshot across all four modules"],
    loan:["Loan Eligibility Checker","Estimate what you could qualify for"],
    credit:["Credit Score Analyzer","Understand and improve your score"],
    emi:["EMI Calculator","Plan your monthly repayments"],
    ai:["AI Financial Tips","Personalized guidance based on your numbers"]
  };
  function showView(name){
    views.forEach(v=>{
      document.getElementById('view-'+v).classList.toggle('active', v===name);
    });
    document.querySelectorAll('.navitem').forEach(n=>n.classList.toggle('active', n.dataset.view===name));
    document.getElementById('pageTitle').textContent = titles[name][0];
    document.getElementById('pageSub').textContent = titles[name][1];
    closeSidebar();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  document.querySelectorAll('[data-view]').forEach(el=>{
    el.addEventListener('click', ()=> showView(el.dataset.view));
  });

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  function openSidebar(){ sidebar.classList.add('open'); backdrop.classList.add('show'); }
  function closeSidebar(){ sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
  document.getElementById('menuBtn').addEventListener('click', openSidebar);
  backdrop.addEventListener('click', closeSidebar);

  /* ============ Settings Modal Handlers ============ */
  const settingsModal = document.getElementById('settingsModal');
  function openSettings(){
    document.getElementById('cfgSheetUrl').value = currentConfig.sheetUrl || '';
    document.getElementById('cfgAiProvider').value = currentConfig.aiProvider || 'smart-local';
    document.getElementById('cfgApiKey').value = currentConfig.apiKey || '';
    document.getElementById('sheetTestMsg').textContent = '';
    toggleApiKeyField();
    settingsModal.classList.add('open');
  }
  function closeSettings(){
    settingsModal.classList.remove('open');
  }
  function toggleApiKeyField(){
    const prov = document.getElementById('cfgAiProvider').value;
    document.getElementById('cfgApiKeyField').style.display = (prov === 'smart-local') ? 'none' : 'block';
  }

  document.getElementById('topbarSettingsBtn').addEventListener('click', openSettings);
  document.getElementById('sidebarSettingsBtn').addEventListener('click', openSettings);
  document.getElementById('topbarStatusPill').addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('cfgAiProvider').addEventListener('change', toggleApiKeyField);
  
  settingsModal.addEventListener('click', (e)=>{
    if(e.target === settingsModal) closeSettings();
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', ()=>{
    currentConfig.sheetUrl = document.getElementById('cfgSheetUrl').value.trim();
    currentConfig.aiProvider = document.getElementById('cfgAiProvider').value;
    currentConfig.apiKey = document.getElementById('cfgApiKey').value.trim();
    saveConfig(currentConfig);
    closeSettings();
  });

  // Test Google Sheets Connection
  document.getElementById('testSheetBtn').addEventListener('click', async ()=>{
    const url = document.getElementById('cfgSheetUrl').value.trim();
    const msgEl = document.getElementById('sheetTestMsg');
    if(!url){
      msgEl.textContent = 'Please enter a URL first.';
      msgEl.style.color = 'var(--red)';
      return;
    }
    msgEl.textContent = 'Testing webhook...';
    msgEl.style.color = 'var(--text-2)';
    try{
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'ConnectionTest', summary: 'FitToLend Webhook Verification Ping' })
      });
      msgEl.textContent = 'Ping dispatched successfully!';
      msgEl.style.color = 'var(--teal)';
    }catch(err){
      msgEl.textContent = 'Network error or invalid URL: ' + err.message;
      msgEl.style.color = 'var(--red)';
    }
  });

  /* ============ Formatters & Math Helpers ============ */
  const fmtINR = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const clamp = (n,lo,hi) => Math.max(lo, Math.min(hi,n));

  function setFieldError(id, invalid){
    const input = document.getElementById(id);
    const field = input.closest('.field');
    if(field) field.classList.toggle('invalid', invalid);
  }
  function validateField(id, condition){
    const invalid = !condition;
    setFieldError(id, invalid);
    return !invalid;
  }

  function animateCount(el){
    const target = parseFloat(el.dataset.count);
    const dur = 1100; const start = performance.now();
    function step(t){
      const p = clamp((t-start)/dur, 0, 1);
      const eased = 1 - Math.pow(1-p, 3);
      el.textContent = Math.round(target*eased).toLocaleString('en-IN');
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  document.querySelectorAll('[data-count]').forEach(animateCount);

  /* ============ Shared state & Storage ============ */
  const state = { loan:null, credit:null, emi:null };

  function loadLocalRecords(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      return [];
    }
  }

  function saveRecordLocally(record){
    const list = loadLocalRecords();
    list.unshift(record);
    if(list.length > 50) list.pop(); // keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  async function persistRecord(module, payload){
    const record = {
      id: module + '-' + Date.now(),
      module,
      timestamp: new Date().toISOString(),
      ...payload
    };

    // Save locally
    saveRecordLocally(record);

    // Save to Google Sheets if configured
    if(currentConfig.sheetUrl){
      try{
        fetch(currentConfig.sheetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        }).catch(()=>{});
      }catch(e){}
    }
  }

  function pushActivity(module, label, tag, tagClass){
    const list = document.getElementById('activityList');
    if(list.children.length===1 && list.children[0].textContent.startsWith('Nothing yet')){
      list.innerHTML='';
    }
    const row = document.createElement('div');
    row.className='activity-row';
    row.innerHTML = `<span class="tag ${tagClass}">${tag}</span> <span>${label}</span> <span class="when">Just now</span>`;
    list.prepend(row);
    while(list.children.length>6) list.removeChild(list.lastChild);
  }

  function updateAiHint(){
    const parts=[];
    if(state.loan) parts.push(`Loan: ${fmtINR(state.loan.eligibleAmount)} eligible at ${state.loan.rate}% for ${state.loan.tenure}y (${state.loan.status}).`);
    if(state.credit) parts.push(`Credit: ~${state.credit.score} (${state.credit.category}).`);
    if(state.emi) parts.push(`EMI: ${fmtINR(state.emi.emi)}/mo on ${fmtINR(state.emi.principal)}.`);
    document.getElementById('aiContextHint').textContent = parts.length ? parts.join(' | ') : 'No saved calculations yet — figures from the Loan, Credit and EMI modules will show up here automatically.';
    if(state.loan && !document.getElementById('aiIncome').value){
      document.getElementById('aiIncome').value = state.loan.income;
    }
  }

  /* CSV Export */
  function exportRecordsToCSV(){
    const records = loadLocalRecords();
    if(!records.length){
      alert('No calculation records found to export yet. Run a module first!');
      return;
    }
    const headers = ["Timestamp","Module","Monthly Income","Monthly Obligations","Loan Amount","Tenure","Rate","Credit Score","Eligible Amount","Monthly EMI","Status","Summary"];
    const rows = records.map(r => [
      `"${r.timestamp || ''}"`,
      `"${r.module || ''}"`,
      `"${r.income || ''}"`,
      `"${r.obligations || ''}"`,
      `"${r.loanAmount || r.principal || ''}"`,
      `"${r.tenure || ''}"`,
      `"${r.rate || ''}"`,
      `"${r.creditScore || r.score || ''}"`,
      `"${r.eligibleAmount || ''}"`,
      `"${r.emi || ''}"`,
      `"${r.status || r.category || ''}"`,
      `"${(r.summary || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FitToLend_Records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  document.getElementById('dashboardExportBtn').addEventListener('click', exportRecordsToCSV);
  document.getElementById('exportCsvBtn').addEventListener('click', exportRecordsToCSV);
  document.getElementById('clearLocalBtn').addEventListener('click', ()=>{
    if(confirm('Are you sure you want to clear all local calculation history?')){
      localStorage.removeItem(STORAGE_KEY);
      document.getElementById('activityList').innerHTML = '<div class="activity-row" style="color:var(--text-2); border-top:none;">Nothing yet — run a module to see it appear here.</div>';
      alert('Local history cleared.');
    }
  });

  /* ============ MODULE 1: LOAN ELIGIBILITY ============ */
  const loanForm = document.getElementById('loanForm');
  loanForm.addEventListener('submit', function(e){
    e.preventDefault();
    const income = parseFloat(document.getElementById('loanIncome').value);
    const obligations = parseFloat(document.getElementById('loanObligations').value) || 0;
    const amount = parseFloat(document.getElementById('loanAmount').value);
    const tenure = parseInt(document.getElementById('loanTenure').value);
    const rate = parseFloat(document.getElementById('loanRate').value);
    const credit = parseInt(document.getElementById('loanCredit').value);
    const age = parseInt(document.getElementById('loanAge').value);
    const existingCount = parseInt(document.getElementById('loanExistingCount').value);
    const employment = document.getElementById('loanEmployment').value;

    let ok = true;
    ok = validateField('loanIncome', income>0) && ok;
    ok = validateField('loanObligations', obligations>=0) && ok;
    ok = validateField('loanAmount', amount>0) && ok;
    ok = validateField('loanTenure', tenure>=1 && tenure<=30) && ok;
    ok = validateField('loanRate', rate>=1 && rate<=36) && ok;
    ok = validateField('loanCredit', credit>=300 && credit<=900) && ok;
    ok = validateField('loanAge', age>=18 && age<=70) && ok;
    ok = validateField('loanExistingCount', existingCount>=0 && existingCount<=10) && ok;
    ok = validateField('loanEmployment', !!employment) && ok;
    if(!ok) return;

    const result = computeLoanEligibility({income,obligations,amount,tenure,rate,credit,age,existingCount,employment});
    renderLoanResult(result);
    state.loan = { eligibleAmount: result.eligibleAmount, rate, tenure, status: result.statusLabel, income, obligations };
    updateAiHint();
    pushActivity('loan', `Loan eligibility: ${result.statusLabel} for ${fmtINR(result.eligibleAmount)}`, result.statusLabel, result.badgeClass);
    
    persistRecord('Loan_Eligibility', {
      income, obligations, loanAmount: amount, tenure, rate, creditScore: credit,
      eligibleAmount: result.eligibleAmount, emi: result.recommendedEmi,
      status: result.statusLabel,
      summary: `Eligible for ${fmtINR(result.eligibleAmount)} (${result.confidence}% confidence)`
    });
  });

  function computeLoanEligibility(d){
    const factors = [];

    // Employment gate
    if(d.employment==='unemployed'){
      return {
        statusLabel:'Not Eligible', badgeClass:'badge-bad',
        eligibleAmount:0, recommendedEmi:0, confidence:8,
        factors:[{type:'neg', text:'Lenders generally require a verifiable, ongoing income source to underwrite a loan.'}]
      };
    }

    // FOIR band by income
    let maxFOIR = 0.40;
    if(d.income>=100000) maxFOIR=0.65;
    else if(d.income>=50000) maxFOIR=0.55;
    else if(d.income>=20000) maxFOIR=0.45;
    const maxAffordableEmi = Math.max(0, d.income*maxFOIR - d.obligations);
    factors.push({type: maxAffordableEmi>0?'pos':'neg', text:`At ${(maxFOIR*100).toFixed(0)}% FOIR minus obligations, you can comfortably afford ~${fmtINR(maxAffordableEmi)}/month in EMI.`});

    // Retirement-age based max tenure
    const retirementAge = (d.employment==='self-prof' || d.employment==='self-biz') ? 65 : 60;
    const maxTenureByAge = Math.max(1, retirementAge - d.age);
    const effectiveTenure = Math.min(d.tenure, maxTenureByAge);
    if(effectiveTenure < d.tenure){
      factors.push({type:'neu', text:`Your requested ${d.tenure}-year tenure was capped to ${effectiveTenure} years to complete repayment by age ${retirementAge}.`});
    } else {
      factors.push({type:'pos', text:`Your requested ${d.tenure}-year tenure fits comfortably within your working career.`});
    }

    // Max eligible principal from affordable EMI
    const r = d.rate/12/100;
    const n = effectiveTenure*12;
    let maxPrincipal = r===0 ? maxAffordableEmi*n : maxAffordableEmi*(Math.pow(1+r,n)-1)/(r*Math.pow(1+r,n));

    // Credit score adjustment
    let creditMultiplier = 1;
    if(d.credit<650){ creditMultiplier=0.55; factors.push({type:'neg', text:`Credit score of ${d.credit} is below 650, which triggers risk premiums and reduced limits.`}); }
    else if(d.credit<700){ creditMultiplier=0.8; factors.push({type:'neu', text:`Credit score of ${d.credit} is fair — approvals may come with slightly higher rates.`}); }
    else if(d.credit<750){ creditMultiplier=0.92; factors.push({type:'pos', text:`Credit score of ${d.credit} is solid and qualifies for near-standard loan terms.`}); }
    else { creditMultiplier=1; factors.push({type:'pos', text:`Credit score of ${d.credit} is prime — you qualify for top-tier interest rates.`}); }
    maxPrincipal *= creditMultiplier;

    // Existing active loans
    if(d.existingCount>=4){ maxPrincipal*=0.85; factors.push({type:'neg', text:`${d.existingCount} active credit facilities raise debt-to-income sensitivity.`}); }
    else if(d.existingCount>=1){ factors.push({type:'neu', text:`${d.existingCount} active loan(s) factored into current obligations.`}); }

    // Employment stability
    if(d.employment==='self-prof' || d.employment==='self-biz'){
      factors.push({type:'neu', text:'Self-employed applicants typically require 2–3 years of ITRs and audited financial statements.'});
    } else {
      factors.push({type:'pos', text:'Salaried profile offers verifiable pay slips and stable credit appraisal.'});
    }

    const eligibleAmount = Math.max(0, Math.min(d.amount, maxPrincipal));
    const recommendedEmi = calcEMI(eligibleAmount, d.rate, effectiveTenure*12);

    let confidence = 0;
    confidence += clamp((d.credit-300)/600,0,1)*35;
    confidence += clamp(maxAffordableEmi>0 ? Math.min(1, maxAffordableEmi/(recommendedEmi||1)) : 0, 0,1)*30;
    confidence += clamp(effectiveTenure/d.tenure,0,1)*15;
    confidence += (d.employment==='govt' ? 10 : d.employment==='private' ? 8 : 6);
    confidence += clamp(1-(d.existingCount/10),0,1)*10;
    confidence = Math.round(clamp(confidence,5,98));

    let statusLabel, badgeClass;
    if(eligibleAmount >= d.amount*0.9 && d.credit>=650){ statusLabel='Eligible'; badgeClass='badge-good'; }
    else if(eligibleAmount >= d.amount*0.35){ statusLabel='Conditionally Eligible'; badgeClass='badge-warn'; }
    else { statusLabel='Not Eligible'; badgeClass='badge-bad'; }

    return { statusLabel, badgeClass, eligibleAmount, recommendedEmi, confidence, factors, effectiveTenure };
  }

  function renderLoanResult(r){
    document.getElementById('loanEmpty').style.display='none';
    const box = document.getElementById('loanResult');
    box.style.display='block';
    box.innerHTML = `
      <h2 class="ptitle">Assessment Result</h2>
      <span class="badge ${r.badgeClass}">${r.statusLabel}</span>
      <div class="kpi-row">
        <div class="kpi"><span>Eligible loan amount</span><b>${fmtINR(r.eligibleAmount)}</b></div>
        <div class="kpi"><span>Estimated EMI</span><b>${fmtINR(r.recommendedEmi)}</b></div>
      </div>
      <div class="hintline">Approval Confidence Index</div>
      <div class="meter"><i style="width:0%"></i></div>
      <div class="hintline" style="margin-top:4px;">${r.confidence}/100 — based on FOIR margin, credit score, retirement tenure cap and liabilities.</div>
      <div class="factor-list">
        ${r.factors.map(f=>`<div class="factor ${f.type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${f.type==='pos'?'<path d="M5 13l4 4L19 7"/>':f.type==='neg'?'<path d="M6 6l12 12M18 6L6 18"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'}</svg><span>${f.text}</span></div>`).join('')}
      </div>
    `;
    requestAnimationFrame(()=>{ box.querySelector('.meter i').style.width = r.confidence+'%'; });
  }

  /* ============ MODULE 2: CREDIT SCORE ANALYZER ============ */
  const segKnown = document.getElementById('segKnown');
  const segEstimate = document.getElementById('segEstimate');
  segKnown.addEventListener('click', ()=>{
    segKnown.classList.add('on'); segEstimate.classList.remove('on');
    document.getElementById('knownBlock').style.display='block';
    document.getElementById('estimateBlock').style.display='none';
  });
  segEstimate.addEventListener('click', ()=>{
    segEstimate.classList.add('on'); segKnown.classList.remove('on');
    document.getElementById('knownBlock').style.display='none';
    document.getElementById('estimateBlock').style.display='block';
  });
  const utilization = document.getElementById('utilization');
  utilization.addEventListener('input', ()=> document.getElementById('utilizationVal').textContent = utilization.value+'%');

  document.getElementById('creditForm').addEventListener('submit', function(e){
    e.preventDefault();
    let result;
    if(segKnown.classList.contains('on')){
      const score = parseInt(document.getElementById('knownScore').value);
      if(!validateField('knownScore', score>=300 && score<=900)) return;
      result = analyzeKnownScore(score);
    } else {
      const payHistory = document.getElementById('payHistory').value;
      const util = parseInt(utilization.value);
      const creditAge = parseFloat(document.getElementById('creditAge').value)||0;
      const accounts = parseInt(document.getElementById('accounts').value)||0;
      const inquiries = parseInt(document.getElementById('inquiries').value)||0;
      result = estimateCreditScore({payHistory, util, creditAge, accounts, inquiries});
    }
    renderCreditResult(result);
    state.credit = { score: result.score, category: result.category };
    updateAiHint();
    pushActivity('credit', `Credit score analysis: ${result.score} (${result.category})`, result.category, result.badgeClass);
    
    persistRecord('Credit_Analysis', {
      creditScore: result.score,
      status: result.category,
      summary: `Score evaluated at ${result.score} (${result.category})`
    });
  });

  function categoryFor(score){
    if(score<580) return {category:'Poor', badgeClass:'badge-bad'};
    if(score<670) return {category:'Fair', badgeClass:'badge-warn'};
    if(score<740) return {category:'Good', badgeClass:'badge-warn'};
    if(score<800) return {category:'Very Good', badgeClass:'badge-good'};
    return {category:'Excellent', badgeClass:'badge-good'};
  }
  function analyzeKnownScore(score){
    const cat = categoryFor(score);
    return {
      score, category:cat.category, badgeClass:cat.badgeClass,
      breakdown:null,
      tips: tipsForScore(score)
    };
  }
  function estimateCreditScore(d){
    const payMap = {ontime:100, minor:65, major:35, default:10};
    const payScore = payMap[d.payHistory];
    let utilScore; const u=d.util;
    if(u<=10) utilScore=100; else if(u<=30) utilScore=85; else if(u<=50) utilScore=60; else if(u<=75) utilScore=35; else utilScore=10;
    let ageScore; const a=d.creditAge;
    if(a>=7) ageScore=100; else if(a>=4) ageScore=80; else if(a>=2) ageScore=60; else if(a>=1) ageScore=40; else ageScore=20;
    let accScore; const ac=d.accounts;
    if(ac>=2 && ac<=5) accScore=100; else if(ac===1 || (ac>=6&&ac<=8)) accScore=70; else accScore=40;
    let inqScore; const iq=d.inquiries;
    if(iq===0) inqScore=100; else if(iq<=2) inqScore=80; else if(iq<=4) inqScore=50; else inqScore=20;

    const weighted = payScore*0.35 + utilScore*0.30 + ageScore*0.15 + accScore*0.10 + inqScore*0.10;
    const score = Math.round(300 + (weighted/100)*600);
    const cat = categoryFor(score);
    return {
      score, category:cat.category, badgeClass:cat.badgeClass,
      breakdown:[
        {label:'Payment history (35%)', pct:payScore, color:'var(--teal)'},
        {label:'Credit utilization (30%)', pct:utilScore, color:'var(--violet)'},
        {label:'Credit history age (15%)', pct:ageScore, color:'var(--amber)'},
        {label:'Account mix (10%)', pct:accScore, color:'#7fe8c8'},
        {label:'Recent inquiries (10%)', pct:inqScore, color:'var(--red)'}
      ],
      tips: tipsForScore(score, d)
    };
  }
  function tipsForScore(score, d){
    const tips=[];
    if(score<670) tips.push('Set all credit card bills and loan EMIs to autopay — payment history carries the single largest credit weight.');
    if(!d || d.util>30) tips.push('Keep credit card utilization strictly under 30% of your total credit limit (aiming for sub-10% prior to loan applications).');
    if(!d || d.creditAge<4) tips.push('Preserve your oldest active credit card account to maintain a healthy account seasoning age.');
    if(!d || d.inquiries>2) tips.push('Avoid multiple hard loan inquiries within short succession; spread out new applications by 6+ months.');
    if(score>=750) tips.push('Your prime score gives you strong leverage to negotiate fee waivers and competitive loan interest rates.');
    if(tips.length===0) tips.push('Maintain consistent low credit utilization and flawless repayment records.');
    return tips;
  }

  function renderCreditResult(r){
    document.getElementById('creditEmpty').style.display='none';
    const box = document.getElementById('creditResult');
    box.style.display='block';
    const pct = clamp((r.score-300)/600,0,1);
    const circumference = 2*Math.PI*58;
    const breakdownHtml = r.breakdown ? `
      <div class="bar-list" style="margin-top:22px;">
        ${r.breakdown.map(b=>`<div class="bar-item"><span>${b.label}<b>${b.pct}%</b></span><div class="track"><i style="width:${b.pct}%; background:${b.color};"></i></div></div>`).join('')}
      </div>` : '';
    box.innerHTML = `
      <h2 class="ptitle">Assessment Result</h2>
      <div class="ring-wrap">
        <div class="ring">
          <svg viewBox="0 0 140 140">
            <circle class="track" cx="70" cy="70" r="58"></circle>
            <circle class="prog" id="creditRing" cx="70" cy="70" r="58" stroke="#8c7cf0" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"></circle>
          </svg>
          <div class="ring-center"><b>${r.score}</b><span>of 900</span></div>
        </div>
        <div style="flex:1; min-width:160px;">
          <span class="badge ${r.badgeClass}">${r.category}</span>
          <p style="font-size:12.5px; color:var(--text-2); margin-top:10px; line-height:1.6;">Indicative proprietary estimate based on standard credit bureau weighting algorithms.</p>
        </div>
      </div>
      ${breakdownHtml}
      <div class="tips-list">
        ${r.tips.map(t=>`<div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z"/></svg><span>${t}</span></div>`).join('')}
      </div>
    `;
    requestAnimationFrame(()=>{
      const ring = document.getElementById('creditRing');
      ring.style.strokeDashoffset = circumference*(1-pct);
    });
  }

  /* ============ MODULE 3: EMI CALCULATOR ============ */
  function calcEMI(P, annualRatePct, months){
    if(P<=0 || months<=0) return 0;
    const r = annualRatePct/12/100;
    if(r===0) return P/months;
    return P*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1);
  }

  const emiAmount = document.getElementById('emiAmount');
  const emiAmountSlider = document.getElementById('emiAmountSlider');
  const emiRate = document.getElementById('emiRate');
  const emiRateSlider = document.getElementById('emiRateSlider');
  const emiTenure = document.getElementById('emiTenure');
  const emiTenureSlider = document.getElementById('emiTenureSlider');
  const segYears = document.getElementById('segYears');
  const segMonths = document.getElementById('segMonths');
  let tenureUnit = 'years';

  function syncPair(numInput, rangeInput){
    numInput.addEventListener('input', ()=>{ rangeInput.value = numInput.value; computeEmi(); });
    rangeInput.addEventListener('input', ()=>{ numInput.value = rangeInput.value; computeEmi(); });
  }
  syncPair(emiAmount, emiAmountSlider);
  syncPair(emiRate, emiRateSlider);
  syncPair(emiTenure, emiTenureSlider);

  segYears.addEventListener('click', ()=>{
    if(tenureUnit==='years') return;
    tenureUnit='years'; segYears.classList.add('on'); segMonths.classList.remove('on');
    emiTenure.value = Math.max(1, Math.round(emiTenure.value/12));
    emiTenureSlider.min=1; emiTenureSlider.max=30; emiTenureSlider.value=emiTenure.value;
    computeEmi();
  });
  segMonths.addEventListener('click', ()=>{
    if(tenureUnit==='months') return;
    tenureUnit='months'; segMonths.classList.add('on'); segYears.classList.remove('on');
    emiTenure.value = Math.round(emiTenure.value*12);
    emiTenureSlider.min=1; emiTenureSlider.max=360; emiTenureSlider.value=emiTenure.value;
    computeEmi();
  });

  let lastEmiResult = null;
  function computeEmi(){
    const P = clamp(parseFloat(emiAmount.value)||0, 0, 500000000);
    const rate = clamp(parseFloat(emiRate.value)||0, 0, 60);
    const tVal = parseFloat(emiTenure.value)||0;
    const months = tenureUnit==='years' ? Math.round(tVal*12) : Math.round(tVal);
    if(P<=0 || months<=0 || rate<0){ return; }

    const emi = calcEMI(P, rate, months);
    const totalPayment = emi*months;
    const totalInterest = totalPayment - P;
    const principalPct = clamp(P/totalPayment*100, 0, 100);
    const interestPct = 100-principalPct;

    document.getElementById('emiMonthlyBig').textContent = fmtINR(emi);
    document.getElementById('kpiEmi').textContent = fmtINR(emi);
    document.getElementById('kpiInterest').textContent = fmtINR(totalInterest);
    document.getElementById('kpiTotal').textContent = fmtINR(totalPayment);
    document.getElementById('emiPrincipalPct').textContent = principalPct.toFixed(1)+'%';
    document.getElementById('emiInterestPct').textContent = interestPct.toFixed(1)+'%';
    document.getElementById('emiPrincipalBar').style.width = principalPct+'%';
    document.getElementById('emiInterestBar').style.width = interestPct+'%';

    const circumference = 2*Math.PI*58;
    const ringP = document.getElementById('emiRingPrincipal');
    const ringI = document.getElementById('emiRingInterest');
    const pLen = circumference*(principalPct/100);
    ringP.setAttribute('stroke-dasharray', `${pLen} ${circumference-pLen}`);
    ringP.setAttribute('stroke-dashoffset', 0);
    const iLen = circumference*(interestPct/100);
    ringI.setAttribute('stroke-dasharray', `${iLen} ${circumference-iLen}`);
    ringI.setAttribute('stroke-dashoffset', -pLen);

    const guidanceEl = document.getElementById('kpiGuidance');
    guidanceEl.textContent = totalInterest > P ? 'Interest exceeds principal — consider shortening tenure or prepaying.' : 'Healthy interest-to-principal ratio.';

    // Amortization Table
    const years = Math.ceil(months/12);
    let balance = P;
    const body = document.getElementById('amortBody');
    body.innerHTML='';
    const r = rate/12/100;
    for(let y=1; y<=years; y++){
      let yearPrincipal=0, yearInterest=0;
      const monthsThisYear = Math.min(12, months-(y-1)*12);
      for(let m=0; m<monthsThisYear; m++){
        const interestPortion = balance*r;
        const principalPortion = emi-interestPortion;
        balance = Math.max(0, balance-principalPortion);
        yearInterest += interestPortion;
        yearPrincipal += principalPortion;
      }
      const row = document.createElement('tr');
      row.innerHTML = `<td>Year ${y}</td><td>${fmtINR(yearPrincipal)}</td><td>${fmtINR(yearInterest)}</td><td>${fmtINR(balance)}</td>`;
      body.appendChild(row);
    }

    lastEmiResult = {principal:P, rate, months, tenureYears: (months/12).toFixed(1), emi, totalInterest, totalPayment};
  }

  document.getElementById('emiSaveBtn').addEventListener('click', ()=>{
    if(!lastEmiResult) return;
    state.emi = lastEmiResult;
    updateAiHint();
    pushActivity('emi', `Saved EMI plan: ${fmtINR(lastEmiResult.emi)}/mo on ${fmtINR(lastEmiResult.principal)}`, 'Saved', 'badge-good');
    
    persistRecord('EMI_Plan', {
      principal: lastEmiResult.principal,
      loanAmount: lastEmiResult.principal,
      rate: lastEmiResult.rate,
      tenure: lastEmiResult.tenureYears,
      emi: lastEmiResult.emi,
      status: 'Plan Saved',
      summary: `${fmtINR(lastEmiResult.emi)}/mo for ${lastEmiResult.tenureYears} yrs`
    });
  });
  computeEmi();

  /* ============ MODULE 4: AI FINANCIAL TIPS & REASONING ============ */
  function buildProfile(){
    return {
      monthlyIncome: parseFloat(document.getElementById('aiIncome').value)|| (state.loan ? state.loan.income : null),
      monthlyExpenses: parseFloat(document.getElementById('aiExpenses').value)||null,
      goal: document.getElementById('aiGoal').value,
      riskAppetite: document.getElementById('aiRisk').value,
      loanEligibility: state.loan,
      creditScore: state.credit,
      emiPlan: state.emi
    };
  }

  // Built-in Smart BFSI Reasoning Engine
  function generateBuiltInInsights(profile){
    const items = [];
    const income = profile.monthlyIncome;
    const expenses = profile.monthlyExpenses;

    if(income && expenses){
      const savings = income - expenses;
      const savingsRate = Math.round((savings / income) * 100);
      if(savingsRate < 15){
        items.push(`**Cash Flow Headroom**: Your savings rate is currently ~${savingsRate}% (₹${Math.round(savings).toLocaleString('en-IN')}/mo). BFSI benchmarks recommend at least 25–30% surplus before undertaking substantial leveraged debt.`);
      } else {
        items.push(`**Healthy Savings Ratio**: You maintain a solid ~${savingsRate}% savings margin (₹${Math.round(savings).toLocaleString('en-IN')}/mo surplus), providing good debt-servicing elasticity.`);
      }
    }

    if(profile.loanEligibility){
      const { eligibleAmount, status, rate, tenure } = profile.loanEligibility;
      if(status === 'Eligible'){
        items.push(`**Borrowing Optimization**: You have strong approval potential for ${fmtINR(eligibleAmount)}. Consider opting for a step-up or floating-rate structure if you anticipate annual income growth.`);
      } else if(status === 'Conditionally Eligible'){
        items.push(`**Bridge Strategy**: Your loan qualification is conditional. Adding a creditworthy co-applicant (spouse/parent) or pledging liquid collateral can bridge the eligibility gap.`);
      } else {
        items.push(`**De-risking Priority**: Focus on lowering active obligations and resolving any recent credit delinquency before submitting official loan applications.`);
      }
    }

    if(profile.creditScore){
      const { score, category } = profile.creditScore;
      if(score < 700){
        items.push(`**Credit Score Catalyst**: At ${score} (${category}), an upgrade of 40–50 points can lower home/auto loan interest quotes by 35–65 bps, saving ₹1.2L+ over a 15-year tenure.`);
      } else {
        items.push(`**Prime Tier Advantage**: With a score of ${score} (${category}), insist on zero-processing-fee waivers and competitive spread discounts from PSU & private banks.`);
      }
    }

    if(profile.emiPlan){
      const { emi, totalInterest, principal } = profile.emiPlan;
      if(totalInterest > principal * 0.75){
        items.push(`**Amortization Prepayment Hack**: Total interest on your plan equals ${fmtINR(totalInterest)}. Making just one extra EMI prepayment every year can shorten the tenure by 3–4 years and cut total interest by over 20%.`);
      } else {
        items.push(`**Balanced Repayment**: Your EMI of ${fmtINR(emi)} represents a sustainable liability schedule with healthy principal amortization.`);
      }
    }

    // Goal & Risk Advice
    const goalMap = {
      home: 'Ensure your down payment constitutes at least 20–25% of property cost to avoid high LTV interest surcharges.',
      emergency: 'Maintain 6 months of living expenses (₹' + (expenses ? Math.round(expenses*6).toLocaleString('en-IN') : '2,00,000') + ') parked in liquid funds or high-yield sweep-in FDs.',
      debt: 'Execute the debt avalanche method: direct surplus cash flow to highest-rate debt while servicing minimums on the rest.',
      invest: `With a ${profile.riskAppetite} risk profile, maintain an indexed asset allocation (e.g. ${profile.riskAppetite==='high'?'75/25':'50/50'} equity-to-debt ratio).`,
      retire: 'Factor in an annual inflation rate of 6.5%; start compounding in tax-efficient retirement vehicles (NPS/PPF/Equity mutual funds).'
    };
    items.push(`**Targeted Objective (${profile.goal.toUpperCase()})**: ${goalMap[profile.goal] || 'Maintain disciplined asset allocation.'}`);

    return items;
  }

  function generateBuiltInQAResponse(q, profile){
    const lower = q.toLowerCase();
    const income = profile.monthlyIncome;
    const expenses = profile.monthlyExpenses;

    if(lower.includes('prepay') || lower.includes('invest')){
      return `When deciding between prepaying your loan and investing surplus funds, compare the loan's post-tax interest rate with your expected post-tax investment return. If your loan interest rate is above 9.5% p.a., prepaying yields a guaranteed, risk-free return equal to the saved interest. However, if your loan is a low-interest home loan (e.g., 8.5% with tax deductions), investing in a diversified index fund historically outpaces loan costs over a 10+ year horizon. A hybrid approach (50% to prepayment, 50% to SIPs) balances psychological debt relief with compounding wealth.`;
    }
    if(lower.includes('emergency') || lower.includes('reserve')){
      const target = expenses ? fmtINR(expenses * 6) : "₹2,00,000 to ₹3,50,000";
      return `For your financial profile, an optimal emergency reserve is 6 months of mandatory living expenses—approximately ${target}. Keep 50% in a liquid mutual fund or sweep-in fixed deposit and 50% in a high-yield savings account. Do not commit this fund to equities or illiquid instruments.`;
    }
    if(lower.includes('credit') || lower.includes('score')){
      return `To rapidly boost your credit score: 1) Keep credit card utilization below 20% by making mid-cycle payments; 2) Automate EMI and utility payments to guarantee a 100% on-time payment track record; 3) Keep your oldest credit lines open; and 4) Avoid opening multiple loan inquiries within a 90-day window. Consistent adherence yields tangible score increases within 3 to 6 billing cycles.`;
    }
    if(lower.includes('reduce') && (lower.includes('emi') || lower.includes('interest'))){
      return `To reduce your monthly EMI burden or overall interest: 1) Request your existing lender for a rate reset or loan transfer if prevailing market rates are lower; 2) Make lump-sum principal prepayments and request a tenure reduction rather than an EMI cut; 3) If immediate monthly cash flow is tight, request a tenure extension, but be aware that total interest will increase.`;
    }
    return `Based on your current numbers (${income ? 'Monthly income of ' + fmtINR(income) : 'unspecified income'} with a ${profile.goal} goal), prioritize establishing a 6-month liquidity reserve before taking on aggressive leveraged debt. Keep total existing debt servicing (FOIR) under 40–50% of your take-home pay, and maintain consistent credit discipline. For binding contractual agreements, review specific terms with your chartered accountant or licensed financial planner.`;
  }

  // Claude API Direct Caller
  async function callClaudeAPI(apiKey, prompt){
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  // Gemini API Direct Caller
  async function callGeminiAPI(apiKey, prompt){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.4 }
      })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  function renderAiText(html){
    const output = document.getElementById('aiOutput');
    output.innerHTML = `<div class="ai-answer">${html}</div>`;
  }
  function renderAiThinking(){
    const output = document.getElementById('aiOutput');
    output.innerHTML = `<div class="ai-thinking"><span class="dotflash"><i></i><i></i><i></i></span> FitToLend AI is reasoning over your financial profile…</div>`;
  }

  // Generate Tips Action
  document.getElementById('aiTipsBtn').addEventListener('click', async ()=>{
    const profile = buildProfile();
    renderAiThinking();

    const provider = currentConfig.aiProvider;
    const apiKey = currentConfig.apiKey;

    if(provider === 'claude' && apiKey){
      try{
        const prompt = `You are FitToLend's expert BFSI financial advisory AI. Based on this user profile JSON: ${JSON.stringify(profile)}, provide 4-5 concise, high-impact financial recommendations with concrete numbers and actionable rationale. Use markdown bullet points. Profile: ${JSON.stringify(profile)}`;
        const text = await callClaudeAPI(apiKey, prompt);
        renderAiText(text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n\n/g, '<br><br>'));
        return;
      }catch(err){
        console.warn('Claude API failed, falling back to built-in engine:', err);
      }
    } else if(provider === 'gemini' && apiKey){
      try{
        const prompt = `You are FitToLend's expert BFSI financial advisory AI. Based on this user profile: ${JSON.stringify(profile)}, provide 4-5 concise, high-impact financial recommendations with concrete numbers and actionable rationale. Use markdown bullet points.`;
        const text = await callGeminiAPI(apiKey, prompt);
        renderAiText(text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n\n/g, '<br><br>'));
        return;
      }catch(err){
        console.warn('Gemini API failed, falling back to built-in engine:', err);
      }
    }

    // Built-in Smart Engine Fallback/Default
    setTimeout(()=>{
      const insights = generateBuiltInInsights(profile);
      const html = `<div class="tips-list">${insights.map(t=>`<div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z"/></svg><span>${t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</span></div>`).join('')}</div><div class="hintline" style="margin-top:12px;">Generated by FitToLend Intelligent BFSI Engine.</div>`;
      renderAiText(html);
    }, 450);
  });

  // Chat Q&A Action
  document.getElementById('aiAskBtn').addEventListener('click', async ()=>{
    const q = document.getElementById('aiQuestion').value.trim();
    if(!q) return;
    const thread = document.getElementById('chatThread');
    const userMsg = document.createElement('div');
    userMsg.className='msg user'; userMsg.textContent = q;
    thread.appendChild(userMsg);
    document.getElementById('aiQuestion').value='';

    const aiMsg = document.createElement('div');
    aiMsg.className='msg ai'; aiMsg.innerHTML = `<span class="dotflash"><i></i><i></i><i></i></span>`;
    thread.appendChild(aiMsg);
    thread.scrollTop = thread.scrollHeight;

    const profile = buildProfile();
    const provider = currentConfig.aiProvider;
    const apiKey = currentConfig.apiKey;

    if(provider === 'claude' && apiKey){
      try{
        const prompt = `You are FitToLend BFSI advisor. User profile: ${JSON.stringify(profile)}. User query: "${q}". Provide a concise, clear 3-4 sentence financial response grounded in their figures.`;
        const text = await callClaudeAPI(apiKey, prompt);
        aiMsg.textContent = text;
        thread.scrollTop = thread.scrollHeight;
        return;
      }catch(err){}
    } else if(provider === 'gemini' && apiKey){
      try{
        const prompt = `You are FitToLend BFSI advisor. User profile: ${JSON.stringify(profile)}. User query: "${q}". Provide a concise, clear 3-4 sentence financial response grounded in their figures.`;
        const text = await callGeminiAPI(apiKey, prompt);
        aiMsg.textContent = text;
        thread.scrollTop = thread.scrollHeight;
        return;
      }catch(err){}
    }

    // Built-in Assistant
    setTimeout(()=>{
      aiMsg.textContent = generateBuiltInQAResponse(q, profile);
      thread.scrollTop = thread.scrollHeight;
    }, 350);
  });

  /* ============ Session Restore ============ */
  (function initSession(){
    updateConfigUI();
    const records = loadLocalRecords();
    if(records.length){
      const list = document.getElementById('activityList');
      list.innerHTML = '';
      records.slice(0, 5).forEach(r=>{
        const tagClass = (r.status==='Eligible' || r.status==='Very Good' || r.status==='Excellent') ? 'badge-good' : (r.status==='Conditionally Eligible' || r.status==='Good' || r.status==='Fair') ? 'badge-warn' : 'badge-good';
        pushActivity(r.module, `${r.summary || r.module} (Saved)`, r.status || 'Saved', tagClass);
      });
    }
  })();

})();
