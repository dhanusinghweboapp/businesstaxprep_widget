// =====================================================
// ZOHO CREATOR WIDGET — CPA Hopkins
// =====================================================

// =====================================================
// MASTER RECORD ID
// =====================================================

const MASTER_RECORD_ID = "428295000000283017";

// ====================================================
// APP CONFIG
// =====================================================

const APP_NAME = "cpa-hopkins";

const REPORTS = {
    MASTER:     "Personal_Tax_Prep_Intake",
    BASIC_INFO: "Personal_Basic_Information_Report",
    TAXPAYER:   "All_Person_Taxpayer_S_Information",
    SPOUSE:     "All_Personal_Spouse_Infos",
    DEPENDENT:  "Personal_Dependent_Report",
    DEP_CHILD:  "Personal_Dependent_Report",
    DOCUMENT:   "All_Document_Upload_Wizards",
    DOC_CENTER: "Document_Review"
};

const FORMS = {
    BASIC_INFO: "Personal_Basic_Information",
    TAXPAYER:   "Person_Taxpayer_s_Information",
    SPOUSE:     "Personal_Spouse_Information",
    DEPENDENT:  "Personal_Dependent",
    DEP_CHILD:  "Personal_Dependent",
    DOC_WIZARD: "Document_Upload_Wizard",
    DOC_UPLOAD: "Document_Upload_Center"

};

// =====================================================
// RECORD IDS
// =====================================================

let basicInfoRecordId = "";
let taxpayerRecordId  = "";
let spouseRecordId    = "";
let dependRecordId    = "";
let documentRecordId  = "";

let docCenterRows = [];
let depChildRows  = [];

// =====================================================
// HELPERS
// =====================================================

function extractData(response) {
    const raw = response.data;
    if (Array.isArray(raw)) return raw[0] || {};
    return raw || {};
}

function setField(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.value = value || "";
}

function getField(selector) {
    const el = document.querySelector(selector);
    return el ? (el.value || "") : "";
}

function zohoDateToInput(zohoDate) {
    if (!zohoDate) return "";
    const parsed = new Date(zohoDate);
    if (isNaN(parsed)) return "";
    return parsed.toISOString().split("T")[0];
}

function inputDateToZoho(inputDate) {
    if (!inputDate) return "";
    const parsed = new Date(inputDate);
    if (isNaN(parsed)) return "";
    return parsed.toLocaleDateString("en-GB", {
        day:   "2-digit",
        month: "short",
        year:  "numeric"
    }).replace(/ /g, "-");
}

function assertSuccess(response, label) {
    if (!response || response.code !== 3000) {
        const err = response && response.error;
        let msgParts = [];

        if (Array.isArray(err)) {
            msgParts = err;
        } else if (typeof err === "string") {
            msgParts = [err];
        } else if (err && typeof err === "object") {
            // common Zoho patterns: {"field": ["msg"]} or {"field":"msg"}
            msgParts = Object.values(err).flatMap(function (v) {
                if (Array.isArray(v)) return v;
                if (typeof v === "string") return [v];
                return [];
            });
        }

        const msg = (msgParts.length ? msgParts.join(", ") : "") ||
                    (response && response.message) ||
                    (label + " failed");

        const code = response ? response.code : "unknown";
        throw new Error(label + " — " + msg + " (code " + code + ")");
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  "&amp;")
        .replace(/"/g,  "&quot;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;");
}

// =====================================================
// STEP LOGIC
// (runs after DOM is ready — called from initApp)
// =====================================================

let currentStep = 0;
let steps, formSteps, nextBtn, prevBtn, submitBtn, saveBtn;

function initStepUI() {

    steps     = document.querySelectorAll(".step");
    formSteps = document.querySelectorAll(".form-step");
    nextBtn   = document.getElementById("nextBtn");
    prevBtn   = document.getElementById("prevBtn");
    submitBtn = document.getElementById("submitBtn");

    // Inject Save button
    saveBtn           = document.createElement("button");
    saveBtn.type      = "button";
    saveBtn.innerText = "Save";
    saveBtn.className = "btn-submit";
    document.querySelector(".form-actions").prepend(saveBtn);

    // Nav button events
    nextBtn.addEventListener("click", function () {
        if (currentStep < formSteps.length - 1) {
            currentStep++;
            updateStepUI();
        }
    });

    prevBtn.addEventListener("click", function () {
        if (currentStep > 0) {
            currentStep--;
            updateStepUI();
        }
    });

    steps.forEach(function (step) {
        step.addEventListener("click", function () {
            currentStep = parseInt(step.dataset.step);
            updateStepUI();
        });
    });

    // Add Dependent row button
    const addDepBtn = document.getElementById("addDependentBtn");
    if (addDepBtn) {
        addDepBtn.addEventListener("click", function () {
            depChildRows.push({
                ID: null, isNew: true,
                First_Name: "", Last_Name: "",
                Relationship: "", Date_of_Birth: "", SSN: ""
            });
            renderDependentRows();
        });
    }

    // Add Document row button
    const addDocBtn = document.getElementById("addDocBtn");
    if (addDocBtn) {
        addDocBtn.addEventListener("click", function () {
            docCenterRows.push({
                isNew: true, ID: null,
                Document_Name: "", Document_Type: "",
                Document_File: "", Document_Desciption: "",
                Upload_Due_Date: "", Status: ""
            });
            renderDocumentRows();
        });
    }

    // Save button handler
    saveBtn.addEventListener("click", async function () {
        saveBtn.disabled  = true;
        saveBtn.innerText = "Saving...";
        try {
            await saveBasicInfo();
            await saveTaxpayer();
            await saveSpouse();
            await saveDependent();
            alert("Saved Successfully");
        } catch (err) {
            console.error("❌ SAVE ERROR", err);
            alert("Save Failed: " + err.message);
        } finally {
            saveBtn.disabled  = false;
            saveBtn.innerText = "Save";
        }
    });

    // Submit handler
    document.getElementById("multiStepForm")
    .addEventListener("submit", async function (e) {
        e.preventDefault();
        submitBtn.disabled  = true;
        submitBtn.innerText = "Submitting...";
        try {
            await saveBasicInfo();
            await saveTaxpayer();
            await saveSpouse();
            await saveDependent();
            alert("Form Submitted Successfully");
        } catch (err) {
            console.error("❌ SUBMIT ERROR", err);
            alert("Submit Failed: " + err.message);
        } finally {
            submitBtn.disabled  = false;
            submitBtn.innerText = "Submit";
        }
    });

    updateStepUI();
}

function updateStepUI() {
    steps.forEach(function (step, index) {
        if (index <= currentStep) step.classList.add("active");
        else step.classList.remove("active");
    });
    formSteps.forEach(function (form, index) {
        if (index === currentStep) form.classList.add("active");
        else form.classList.remove("active");
    });
    prevBtn.style.display = currentStep === 0 ? "none" : "inline-block";
    if (currentStep === formSteps.length - 1) {
        nextBtn.style.display   = "none";
        submitBtn.style.display = "inline-block";
    } else {
        nextBtn.style.display   = "inline-block";
        submitBtn.style.display = "none";
    }
}

// =====================================================
// MAIN ENTRY POINT
// Called by ZOHO.CREATOR.init() success handler
// =====================================================

async function initApp() {

    console.log("✅ ZOHO INIT SUCCESS — starting app");

    initStepUI();

    await fetchMasterRecord();

    await ensureBasicInfoRecord();
    await ensureTaxpayerRecord();
    await ensureSpouseRecord();
    await ensureDependentRecord();
    await ensureDocumentWizardRecord();

    await loadBasicInfo();
    await loadTaxpayer();
    await loadSpouse();
    await loadDependent();
    await loadDocuments();
}

// =====================================================
// ZOHO INIT
// =====================================================

// ⚠️  ZOHO.CREATOR.init() MUST be called at the
//     top level of the script (outside any event
//     listener) and MUST NOT be wrapped in
//     DOMContentLoaded. The Zoho SDK handles its
//     own timing. Wrapping it causes
//     "Invalid Configuration" errors.

ZOHO.CREATOR.init()
    .then(function () {
        initApp().catch(function (err) {
            console.error("❌ initApp ERROR", err);
        });
    })
    .catch(function (err) {
        console.error("❌ ZOHO INIT ERROR", err);
        alert("Zoho init failed: " + err.message);
    });

// =====================================================
// ENSURE RECORD EXISTS — create + link to master
// =====================================================

async function ensureRecordOrCreate({
    reportName,
    formName,
    currentId,
    createPayload,
    onCreatedId,
    masterLookupField
}) {
    if (currentId) return currentId;

    const payload = createPayload ? createPayload() : {};

    let response;
    try {
        response = await ZOHO.CREATOR.API.addRecord({
            appName:  APP_NAME,
            formName: formName,
            data:     { data: payload }
        });
    } catch (sdkErr) {
        console.warn("formName failed, trying reportName", sdkErr);
        response = await ZOHO.CREATOR.API.addRecord({
            appName:    APP_NAME,
            reportName: reportName,
            data:       { data: payload }
        });
    }

    assertSuccess(response, "Ensure create — " + formName);

    const createdId = response.data?.ID || "";
    if (!createdId) throw new Error("Ensure create returned empty ID for " + formName);

    onCreatedId(createdId);

    await ZOHO.CREATOR.API.updateRecord({
        appName:    APP_NAME,
        reportName: REPORTS.MASTER,
        id:         MASTER_RECORD_ID,
        data:       { data: { [masterLookupField]: createdId } }
    });

    return createdId;
}

async function ensureBasicInfoRecord() {
    return ensureRecordOrCreate({
        reportName:        REPORTS.BASIC_INFO,
        formName:          FORMS.BASIC_INFO,
        currentId:         basicInfoRecordId,
        createPayload:     () => ({ Filling_Status: "", Tax_Year: "" }),
        onCreatedId:       (id) => { basicInfoRecordId = id; },
        masterLookupField: "Personal_Basic_Information"
    });
}

async function ensureTaxpayerRecord() {
    return ensureRecordOrCreate({
        reportName:        REPORTS.TAXPAYER,
        formName:          FORMS.TAXPAYER,
        currentId:         taxpayerRecordId,
        createPayload:     () => ({ Occupation: "" }),
        onCreatedId:       (id) => { taxpayerRecordId = id; },
        masterLookupField: "Person_Taxpayer_s_Information"
    });
}

async function ensureSpouseRecord() {
    return ensureRecordOrCreate({
        reportName:        REPORTS.SPOUSE,
        formName:          FORMS.SPOUSE,
        currentId:         spouseRecordId,
        createPayload:     () => ({ Spouse_Occupation: "" }),
        onCreatedId:       (id) => { spouseRecordId = id; },
        masterLookupField: "Personal_Spouse_Information"
    });
}

async function ensureDependentRecord() {
    return ensureRecordOrCreate({
        reportName:        REPORTS.DEPENDENT,
        formName:          FORMS.DEPENDENT,
        currentId:         dependRecordId,
        createPayload:     () => ({ How_many_Dependents_do_you_Have: "" }),
        onCreatedId:       (id) => { dependRecordId = id; },
        masterLookupField: "Personal_Dependent"
    });
}

async function ensureDocumentWizardRecord() {
    return ensureRecordOrCreate({
        reportName:        REPORTS.DOCUMENT,
        formName:          FORMS.DOC_WIZARD,
        currentId:         documentRecordId,
        createPayload:     () => ({ Name: "Document Wizard" }),
        onCreatedId:       (id) => { documentRecordId = id; },
        masterLookupField: "Document_Upload_Wizard"
    });
}

// =====================================================
// FETCH MASTER RECORD
// =====================================================

async function fetchMasterRecord() {
    try {

        const response = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.MASTER,
            id:         MASTER_RECORD_ID
        });

        const data = extractData(response);

        console.log("MASTER DATA", data);

        basicInfoRecordId =
            data?.Personal_Basic_Information?.ID ||
            data?.Personal_Basic_Information     || "";

        taxpayerRecordId =
            data?.Person_Taxpayer_s_Information?.ID ||
            data?.Person_Taxpayer_s_Information     || "";

        spouseRecordId =
            data?.Personal_Spouse_Information?.ID ||
            data?.Personal_Spouse_Information     || "";

        dependRecordId =
            data?.Personal_Dependent?.ID ||
            data?.Personal_Dependent     || "";

        documentRecordId =
            data?.Document_Upload_Wizard?.ID ||
            data?.Document_Upload_Wizard     || "";

        console.log("basicInfoRecordId :", basicInfoRecordId);
        console.log("taxpayerRecordId  :", taxpayerRecordId);
        console.log("spouseRecordId    :", spouseRecordId);
        console.log("dependRecordId    :", dependRecordId);
        console.log("documentRecordId  :", documentRecordId);

    } catch (err) {
        console.error("❌ MASTER FETCH ERROR", err);
    }
}

// =====================================================
// LOAD BASIC INFO
// =====================================================

async function loadBasicInfo() {
    if (!basicInfoRecordId) { console.log("⚠️ NO BASIC INFO RECORD"); return; }
    try {

        const response = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.BASIC_INFO,
            id:         basicInfoRecordId
        });

        const rec = extractData(response);
        console.log("BASIC INFO DATA", rec);

        setField('[name="tax_year"]',      rec.Tax_Year       || "");
        setField('[name="filing_status"]', rec.Filling_Status || "");
        setField('[name="address1"]',      rec.Home_Address?.address_line_1 || "");
        setField('[name="address2"]',      rec.Home_Address?.address_line_2 || "");
        setField('[name="city"]',          rec.Home_Address?.district_city  || "");
        setField('[name="state"]',         rec.Home_Address?.state_province || "");
        setField('[name="postal_code"]',   rec.Home_Address?.postal_code    || "");
        setField('[name="country"]',       rec.Home_Address?.country        || "");

    } catch (err) { console.error("❌ LOAD BASIC INFO ERROR", err); }
}

// =====================================================
// LOAD TAXPAYER
// =====================================================

async function loadTaxpayer() {
    if (!taxpayerRecordId) { console.log("⚠️ NO TAXPAYER RECORD"); return; }
    try {

        const response = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.TAXPAYER,
            id:         taxpayerRecordId
        });

        const rec = extractData(response);
        console.log("TAXPAYER DATA", rec);

        setField('[name="taxpayer_first_name"]', rec.TaxPayer_s_Name1?.first_name || "");
        setField('[name="taxpayer_last_name"]',  rec.TaxPayer_s_Name1?.last_name  || "");
        setField('[name="taxpayer_email"]',      rec.Email          || "");
        setField('[name="taxpayer_phone"]',      rec.Phone_Number1  || "");
        setField('[name="taxpayer_dob"]',        zohoDateToInput(rec.Date_of_Birth));
        setField('[name="taxpayer_occu"]',       rec.Occupation     || "");
        setField('[name="taxpayer_ssn"]',        rec.TaxPayer_s_Name || "");

    } catch (err) { console.error("❌ LOAD TAXPAYER ERROR", err); }
}

// =====================================================
// LOAD SPOUSE
// =====================================================

async function loadSpouse() {
    if (!spouseRecordId) { console.log("⚠️ NO SPOUSE RECORD"); return; }
    try {

        const response = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.SPOUSE,
            id:         spouseRecordId
        });

        const rec = extractData(response);
        console.log("SPOUSE DATA", rec);

        setField('[name="spouse_first_name"]', rec.Spouse_Name?.first_name || "");
        setField('[name="spouse_last_name"]',  rec.Spouse_Name?.last_name  || "");
        setField('[name="spouse_email"]',      rec.Spouse_s_Email          || "");
        setField('[name="spouse_phone"]',      rec.Spouse_s_Phone_Number   || "");
        setField('[name="spouse_dob"]',        zohoDateToInput(rec.Spouse_DOB));
        setField('[name="Spouse_Occupation"]', rec.Spouse_Occupation       || "");
        setField('[name="spouse_ssn"]',        rec.Spouse_SSN              || "");

    } catch (err) { console.error("❌ LOAD SPOUSE ERROR", err); }
}

// =====================================================
// LOAD DEPENDENT
// =====================================================

async function loadDependent() {

    if (!dependRecordId) {
        console.log("⚠️ NO DEPENDENT RECORD — showing blank row");
        depChildRows = [{
            ID: null, isNew: true,
            First_Name: "", Last_Name: "",
            Relationship: "", Date_of_Birth: "", SSN: ""
        }];
        renderDependentRows();
        return;
    }

    try {

        const response = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.DEPENDENT,
            id:         dependRecordId
        });

        const rec = extractData(response);
        console.log("DEPENDENT PARENT DATA", rec);

        setField('[name="dependent_count"]',
            rec.How_many_Dependents_do_you_Have || "");

        const children = rec.Dependents_Children_other || [];
        console.log("SUBFORM CHILDREN RAW", children);

        if (!children.length) {
            depChildRows = [{
                ID: null, isNew: true,
                First_Name: "", Last_Name: "",
                Relationship: "", Date_of_Birth: "", SSN: ""
            }];
            renderDependentRows();
            return;
        }

        depChildRows = children.map(function (child) {
        console.log("SUBFORM ROW RAW", child);
    
        const display = child.display_value || "";
    
        // Format: "First Last,DOB,SSN,false,Relationship"
        const parts = display.split(",");
    
        // First part mein "First Last" hai — space se split karo
        const nameParts = (parts[0] || "").trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName  = nameParts.slice(1).join(" ") || ""; // baaki sab last name

        return {
            ID:            child.ID || null,
            isNew:         false,
            First_Name:    firstName,
            Last_Name:     lastName,
            Date_of_Birth: parts[1]?.trim() || "",   // "31-May-2026"
            SSN:           parts[2]?.trim() || "",   // "111111111"
            Relationship:  parts[4]?.trim() || ""    // "Daughter" (index 3 = false skip)
           };
        });
        console.log("MAPPED DEP ROWS", depChildRows);
        renderDependentRows();

    } catch (err) {
        console.error("❌ LOAD DEPENDENT ERROR", err);
    }
}

// =====================================================
// RENDER DEPENDENT ROWS
// =====================================================

function renderDependentRows() {

    const tbody = document.getElementById("dependentBody");
    if (!tbody) { console.warn("⚠️ dependentBody not found"); return; }

    tbody.innerHTML = "";

    depChildRows.forEach(function (row, idx) {

        const tr = document.createElement("tr");
        tr.id    = "depRow_" + idx;

        tr.innerHTML = `
            <td>
                <input type="text" class="dep-input"
                    data-idx="${idx}" data-col="First_Name"
                    value="${escapeHtml(row.First_Name || "")}"
                    placeholder="First Name" />
            </td>
            <td>
                <input type="text" class="dep-input"
                    data-idx="${idx}" data-col="Last_Name"
                    value="${escapeHtml(row.Last_Name || "")}"
                    placeholder="Last Name" />
            </td>
            <td>
                <select class="dep-input"
                    data-idx="${idx}" data-col="Relationship">
                    <option value="">Select</option>
                    <option ${row.Relationship === "Son"                   ? "selected" : ""}>Son</option>
                    <option ${row.Relationship === "Daughter"              ? "selected" : ""}>Daughter</option>
                    <option ${row.Relationship === "Step Child"            ? "selected" : ""}>Step Child</option>
                    <option ${row.Relationship === "Eligible Foster Child" ? "selected" : ""}>Eligible Foster Child</option>
                    <option ${row.Relationship === "Brother"               ? "selected" : ""}>Brother</option>
                    <option ${row.Relationship === "Other"                 ? "selected" : ""}>Other</option>
                </select>
            </td>
            <td>
                <input type="date" class="dep-input"
                    data-idx="${idx}" data-col="Date_of_Birth"
                    value="${zohoDateToInput(row.Date_of_Birth || "")}" />
            </td>
            <td>
                <input type="text" class="dep-input"
                    data-idx="${idx}" data-col="SSN"
                    value="${escapeHtml(row.SSN || "")}"
                    placeholder="SSN" />
            </td>
           
            <td>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;">
                    <button type="button" class="dep-save-btn" data-idx="${idx}">Save</button>
                    <button type="button" class="dep-del-btn"  data-idx="${idx}">X</button>
                    </div>
                </td> `;

        tbody.appendChild(tr);

        tr.querySelector(".dep-save-btn")
          .addEventListener("click", function () { saveDepChildRow(idx); });
        tr.querySelector(".dep-del-btn")
          .addEventListener("click", function () { deleteDepChildRow(idx); });
    });
}

// =====================================================
// SAVE ONE DEPENDENT CHILD ROW
// CREATE: formName "Personal_Dependent" + Personal_Master
// UPDATE: reportName "Personal_Dependent_Report" + child ID
// =====================================================

async function saveDepChildRow(idx) {

    const row = depChildRows[idx];

    const getValue = function (col) {
        const el = document.querySelector(
            `.dep-input[data-idx="${idx}"][data-col="${col}"]`
        );
        return el ? (el.value || "") : "";
    };

    const firstName    = getValue("First_Name");
    const lastName     = getValue("Last_Name");
    const relationship = getValue("Relationship");
    const dob          = getValue("Date_of_Birth");
    const ssn          = getValue("SSN");

    if (!firstName && !lastName) {
        alert("Please enter at least a first or last name.");
        return;
    }

    if (!dependRecordId) {
        try { await saveDependent(); }
        catch (err) { alert("Could not create parent record: " + err.message); return; }
    }

    const payload = {
        First_Name:      firstName,
        Last_Name:       lastName,
        Relationship:    relationship,
        Date_of_Birth:   inputDateToZoho(dob),
        SSN:             ssn,
        Personal_Master: MASTER_RECORD_ID
    };

    console.log("💾 SAVE DEP CHILD idx=" + idx, payload);

    try {

        if (row.isNew || !row.ID) {

            console.log("➕ Creating dep child — formName:", FORMS.DEP_CHILD);

            const response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.DEP_CHILD,
                data:     { data: payload }
            });

            console.log("DEP CHILD CREATE", response);
            assertSuccess(response, "Dependent child create");

            depChildRows[idx].ID            = response.data?.ID || "";
            depChildRows[idx].isNew         = false;
            depChildRows[idx].First_Name    = firstName;
            depChildRows[idx].Last_Name     = lastName;
            depChildRows[idx].Relationship  = relationship;
            depChildRows[idx].Date_of_Birth = dob;
            depChildRows[idx].SSN           = ssn;

            console.log("✅ Created dep child ID:", depChildRows[idx].ID);

        } else {

            console.log("✏️ Updating dep child — ID:", row.ID);

            const response = await ZOHO.CREATOR.API.updateRecord({
                appName:    APP_NAME,
                reportName: REPORTS.DEP_CHILD,
                id:         row.ID,
                data:       { data: payload }
            });

            console.log("DEP CHILD UPDATE", response);
            assertSuccess(response, "Dependent child update");

            depChildRows[idx].First_Name    = firstName;
            depChildRows[idx].Last_Name     = lastName;
            depChildRows[idx].Relationship  = relationship;
            depChildRows[idx].Date_of_Birth = dob;
            depChildRows[idx].SSN           = ssn;

            console.log("✅ Updated dep child ID:", row.ID);
        }

        alert("Dependent " + (idx + 1) + " saved successfully!");

    } catch (err) {
        console.error("❌ SAVE DEP CHILD ERROR", err);
        alert("Save failed: " + err.message);
    }
}

// =====================================================
// DELETE ONE DEPENDENT CHILD ROW
// =====================================================

async function deleteDepChildRow(idx) {

    const row = depChildRows[idx];
    if (!confirm("Delete this dependent?")) return;

    try {

        if (!row.isNew && row.ID) {
            const response = await ZOHO.CREATOR.API.deleteRecord({
                appName:    APP_NAME,
                reportName: REPORTS.DEP_CHILD,
                id:         row.ID
            });
            console.log("DEP CHILD DELETE", response);
            assertSuccess(response, "Dependent delete");
        }

        depChildRows.splice(idx, 1);

        if (depChildRows.length === 0) {
            depChildRows.push({
                ID: null, isNew: true,
                First_Name: "", Last_Name: "",
                Relationship: "", Date_of_Birth: "", SSN: ""
            });
        }

        renderDependentRows();

    } catch (err) {
        console.error("❌ DELETE DEP CHILD ERROR", err);
        alert("Delete failed: " + err.message);
    }
}

// =====================================================
// LOAD DOCUMENTS
// =====================================================

async function loadDocuments() {

    if (!documentRecordId) { console.log("⚠️ NO DOCUMENT RECORD"); return; }

    try {

        const wizardResponse = await ZOHO.CREATOR.API.getRecordById({
            appName:    APP_NAME,
            reportName: REPORTS.DOCUMENT,
            id:         documentRecordId
        });

        console.log("DOCUMENT WIZARD DATA", extractData(wizardResponse));

        const docResponse = await ZOHO.CREATOR.API.getAllRecords({
            appName:    APP_NAME,
            reportName: REPORTS.DOC_CENTER,
            criteria:   "(Document_Upload_Wizard ==" + documentRecordId + ")"
        });

        const records = docResponse.data || [];
        console.log("DOCUMENT CENTER RECORDS", records);

        docCenterRows = records.map(function (r) {
            return Object.assign({}, r, { isNew: false });
        });

        renderDocumentRows();

    } catch (err) {
        console.error("❌ LOAD DOCUMENTS ERROR", err);
    }
}
// =====================================================
// RENDER DOCUMENT ROWS
// =====================================================

function renderDocumentRows() {

    const tbody = document.getElementById("docTableBody");
    if (!tbody) { console.warn("⚠️ docTableBody not found"); return; }

    tbody.innerHTML = "";

    if (docCenterRows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;color:#888;padding:20px;">
                    No documents found. Click "+ Add Document" to add one.
                </td>
            </tr>`;
        return;
    }

    docCenterRows.forEach(function (row, idx) {

        const tr = document.createElement("tr");
        tr.id    = "docRow_" + idx;

        const f      = row.Document_File;
        const rawUrl = Array.isArray(f) ? (f[0] || "") : (f || "");
        const fileUrl = rawUrl
            ? "https://creatorapp.zoho.in" + String(rawUrl).replace(/"/g, "'")
            : "";

        const fileCell = fileUrl
            ? `<div class="file-view">
                   <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">View File</a>
               </div>
               <div class="file-upload">
                   <input type="file" class="doc-input"
                       data-idx="${idx}" data-col="Document_File" />
               </div>`
            : `<div class="file-upload">
                   <input type="file" class="doc-input"
                       data-idx="${idx}" data-col="Document_File" />
               </div>`;

        tr.innerHTML = `
            <td>
                <input type="text" class="doc-input"
                    data-idx="${idx}" data-col="Document_Name"
                    value="${escapeHtml(row.Document_Name || "")}"
                    placeholder="Document Name" />
            </td>
            <td>
                <select class="doc-input"
                    data-idx="${idx}" data-col="Document_Type">
                    <option value="">Select</option>
                    <option ${row.Document_Type === "IRS"                         ? "selected" : ""}>IRS</option>
                    <option ${row.Document_Type === "Tax Years"                   ? "selected" : ""}>Tax Years</option>
                    <option ${row.Document_Type === "Tax Planning"                ? "selected" : ""}>Tax Planning</option>
                    <option ${row.Document_Type === "Financials"                  ? "selected" : ""}>Financials</option>
                    <option ${row.Document_Type === "Engagement Letters & POA"   ? "selected" : ""}>Engagement Letters & POA</option>
                    <option ${row.Document_Type === "Company Formation Documents" ? "selected" : ""}>Company Formation Documents</option>
                </select>
            </td>
            <td>
                <input type="text" class="doc-input"
                    data-idx="${idx}" data-col="Document_Desciption"
                    value="${escapeHtml(row.Document_Desciption || "")}"
                    placeholder="Description" />
            </td>
            <td>${fileCell}</td>
            <td>
                <input type="date" class="doc-input"
                    data-idx="${idx}" data-col="Upload_Date"
                    value="${zohoDateToInput(row.Upload_Date || "")}" />
            </td>

            <td>
                <input type="text" class="doc-input"
                    data-idx="${idx}" data-col="Year_field"
                    value="${escapeHtml(row.Year_field || "")}" />
            </td>
            <td>
                <select class="doc-input"
                    data-idx="${idx}" data-col="Status">
                    <option value="">Select</option>
                    <option ${row.Status === "Pending"      ? "selected" : ""}>Pending</option>
                    <option ${row.Status === "Submitted"    ? "selected" : ""}>Submitted</option>
                    <option ${row.Status === "Under Review" ? "selected" : ""}>Under Review</option>
                    <option ${row.Status === "Approved"     ? "selected" : ""}>Approved</option>
                    <option ${row.Status === "Rejected"     ? "selected" : ""}>Rejected</option>
                </select>
            </td>
            <td>
               <div style="display:flex;align-items:center;gap:6px;flex-wrap:nowrap;">
                    <button type="button" class="doc-save-btn" data-idx="${idx}">Save</button>
                    <button type="button" class="doc-del-btn"  data-idx="${idx}">Delete</button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

        tr.querySelector(".doc-save-btn")
          .addEventListener("click", function () { saveDocRow(idx); });
        tr.querySelector(".doc-del-btn")
          .addEventListener("click", function () { deleteDocRow(idx); });
    });
}

// =====================================================
// SAVE ONE DOCUMENT ROW
// =====================================================

async function saveDocRow(idx) {

    const row = docCenterRows[idx];
    const payload = collectDocRowPayload(idx);
    delete payload.Document_File; // never send file in JSON payload

    payload.Document_Upload_Wizard = documentRecordId;

    const fileInput = document.querySelector(
        `.doc-input[data-idx="${idx}"][data-col="Document_File"], .doc-input[data-idx="${idx}"][name="Document_File"]`
    );
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

    

    console.log("SAVE DOC ROW", idx, payload);

    try {
        let recordId = row.ID;
        console.log("Record ID", recordId);

        if (row.isNew) {
            // Step 1: Create record
            const response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.DOC_UPLOAD,
                data: { data: payload }
            });

            console.log("DOC CREATE", response);
            assertSuccess(response, "Document create");

            recordId = response.data.ID;
            docCenterRows[idx].ID   = recordId;
            docCenterRows[idx].isNew = false;

            // Step 2: Upload file immediately after create
            if (hasFile) {
                const uploadResponse = await ZOHO.CREATOR.API.uploadFile({
                    appName:   APP_NAME,
                    formName:  FORMS.DOC_UPLOAD,
                    id:        recordId,
                    fieldName: "Document_File",
                    file:      fileInput.files[0]
                });
                console.log("DOC FILE UPLOAD (new)", uploadResponse);
            }

        } else {
            // Update existing record
            const response = await ZOHO.CREATOR.API.updateRecord({
                appName:    APP_NAME,
                reportName: REPORTS.DOC_CENTER,
                id:         recordId,
                data:       { data: payload }
            });

            console.log("DOC UPDATE", response);
            assertSuccess(response, "Document update");

            // Upload new file if selected
            if (hasFile) {
                const uploadResponse = await ZOHO.CREATOR.API.uploadFile({
                    appName:   APP_NAME,
                    reportName: REPORTS.DOC_CENTER,
                    id:        recordId,
                    fieldName: "Document_File",
                    file:      fileInput.files[0]
                });
                console.log("DOC FILE UPLOAD (update)", uploadResponse);
            }
        }

        alert(`Document row ${idx + 1} saved successfully`);

    } catch (err) {
        console.error("SAVE DOC ROW ERROR", err);
        alert("Save failed: " + (err.message || JSON.stringify(err)));
    }
}

// =====================================================
// DELETE ONE DOCUMENT ROW
// =====================================================

async function deleteDocRow(idx) {

    const row = docCenterRows[idx];
    if (!confirm("Delete this document?")) return;

    try {

        if (!row.isNew && row.ID) {

            // ✅ Zoho delete API criteria use karta hai, id nahi
            const response = await ZOHO.CREATOR.API.deleteRecord({
                appName:    APP_NAME,
                reportName: REPORTS.DOC_CENTER,
                criteria:   "(ID==" + row.ID + ")"
            });

            console.log("DOC DELETE RESPONSE", response);

            // Response structure: { code: 3000, result: [{code: 3000, data: {ID: "..."}}] }
            if (!response || response.code !== 3000) {
                throw new Error("Delete failed — code: " + (response?.code || "unknown"));
            }
        }

        docCenterRows.splice(idx, 1);
        renderDocumentRows();
        alert("Document deleted successfully");

    } catch (err) {
        console.error("❌ DELETE DOC ROW ERROR", err);
        alert("Delete failed: " + err.message);
    }
}

// =====================================================
// COLLECT DOC ROW PAYLOAD (skips file inputs)
// =====================================================

function collectDocRowPayload(idx) {
    const payload = {};
    document
    .querySelectorAll(".doc-input[data-idx='" + idx + "']")
    .forEach(function (input) {
        if (input.type === "file") return;
        const col = input.dataset.col;
        let   val = input.value || "";
        if (input.type === "date" && val) val = inputDateToZoho(val);
        payload[col] = val;
    });
    return payload;
}

// =====================================================
// SAVE BASIC INFO
// =====================================================

async function saveBasicInfo() {

    console.log("--- saveBasicInfo START ---");

    const payload = {};

    const taxYear       = getField('[name="tax_year"]');
    const fillingStatus = getField('[name="filing_status"]');

    if (taxYear)       payload.Tax_Year       = taxYear;
    if (fillingStatus) payload.Filling_Status = fillingStatus;

    const addr1   = getField('[name="address1"]');
    const addr2   = getField('[name="address2"]');
    const city    = getField('[name="city"]');
    const state   = getField('[name="state"]');
    const postal  = getField('[name="postal_code"]');
    const country = getField('[name="country"]');

    if (addr1 || city || state || postal || country) {
        payload.Home_Address = {
            address_line_1: addr1,
            address_line_2: addr2,
            district_city:  city,
            state_province: state,
            postal_code:    postal,
            country:        country
        };
    }

    if (basicInfoRecordId) {

        const response = await ZOHO.CREATOR.API.updateRecord({
            appName:    APP_NAME,
            reportName: REPORTS.BASIC_INFO,
            id:         basicInfoRecordId,
            data:       { data: payload }
        });
        assertSuccess(response, "Basic Info update");

    } else {

        let response;
        try {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.BASIC_INFO,
                data:     { data: payload }
            });
        } catch (sdkErr) {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:    APP_NAME,
                reportName: REPORTS.BASIC_INFO,
                data:       { data: payload }
            });
        }
        assertSuccess(response, "Basic Info create");
        basicInfoRecordId = response.data?.ID || "";
    }

    console.log("--- saveBasicInfo END ---");
}

// =====================================================
// SAVE TAXPAYER
// =====================================================

async function saveTaxpayer() {

    console.log("--- saveTaxpayer START ---");

    const payload = {
        TaxPayer_s_Name1: {
            first_name: getField('[name="taxpayer_first_name"]'),
            last_name:  getField('[name="taxpayer_last_name"]')
        },
        Email:         getField('[name="taxpayer_email"]'),
        Phone_Number1: getField('[name="taxpayer_phone"]'),
        Date_of_Birth: inputDateToZoho(getField('[name="taxpayer_dob"]')),
        Occupation:    getField('[name="taxpayer_occu"]'),
        Taxpayer_SSN:  getField('[name="taxpayer_ssn"]')
    };

    if (taxpayerRecordId) {

        const response = await ZOHO.CREATOR.API.updateRecord({
            appName:    APP_NAME,
            reportName: REPORTS.TAXPAYER,
            id:         taxpayerRecordId,
            data:       { data: payload }
        });
        assertSuccess(response, "Taxpayer update");

    } else {

        let response;
        try {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.TAXPAYER,
                data:     { data: payload }
            });
        } catch (sdkErr) {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:    APP_NAME,
                reportName: REPORTS.TAXPAYER,
                data:       { data: payload }
            });
        }
        assertSuccess(response, "Taxpayer create");
        taxpayerRecordId = response.data?.ID || "";
    }

    console.log("--- saveTaxpayer END ---");
}

// =====================================================
// SAVE SPOUSE
// =====================================================

async function saveSpouse() {

    console.log("--- saveSpouse START ---");

    const payload = {
        Spouse_Name: {
            first_name: getField('[name="spouse_first_name"]'),
            last_name:  getField('[name="spouse_last_name"]')
        },
        Spouse_s_Email:        getField('[name="spouse_email"]'),
        Spouse_s_Phone_Number: getField('[name="spouse_phone"]'),
        Spouse_DOB:            inputDateToZoho(getField('[name="spouse_dob"]')),
        Spouse_Occupation:     getField('[name="Spouse_Occupation"]'),
        Spouse_SSN:            getField('[name="spouse_ssn"]')
    };

    if (spouseRecordId) {

        const response = await ZOHO.CREATOR.API.updateRecord({
            appName:    APP_NAME,
            reportName: REPORTS.SPOUSE,
            id:         spouseRecordId,
            data:       { data: payload }
        });
        assertSuccess(response, "Spouse update");

    } else {

        let response;
        try {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.SPOUSE,
                data:     { data: payload }
            });
        } catch (sdkErr) {
            response = await ZOHO.CREATOR.API.addRecord({
                appName:    APP_NAME,
                reportName: REPORTS.SPOUSE,
                data:       { data: payload }
            });
        }
        assertSuccess(response, "Spouse create");
        spouseRecordId = response.data?.ID || "";
    }

    console.log("--- saveSpouse END ---");
}

// =====================================================
// SAVE DEPENDENT PARENT ONLY
// ⚠️ Saves ONLY How_many_Dependents_do_you_Have
//    Child rows are saved individually via saveDepChildRow
// =====================================================

async function saveDependent() {

    console.log("--- saveDependent START ---");

    const payload = {
        How_many_Dependents_do_you_Have:
            getField('[name="dependent_count"]')
    };

    try {

        if (dependRecordId) {

            const response = await ZOHO.CREATOR.API.updateRecord({
                appName:    APP_NAME,
                reportName: REPORTS.DEPENDENT,
                id:         dependRecordId,
                data:       { data: payload }
            });
            assertSuccess(response, "Dependent update");

        } else {

            const response = await ZOHO.CREATOR.API.addRecord({
                appName:  APP_NAME,
                formName: FORMS.DEPENDENT,
                data:     { data: payload }
            });
            assertSuccess(response, "Dependent create");
            dependRecordId = response.data?.ID || "";
        }

    } catch (err) {
        console.error("❌ SAVE DEPENDENT ERROR", err);
        throw err;
    }

    console.log("--- saveDependent END ---");
}