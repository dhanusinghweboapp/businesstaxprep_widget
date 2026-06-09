
const APP_NAME = "hopkins-cpa";
let currentStep = 1;

const formSteps = document.querySelectorAll(".form-step");
const steps = document.querySelectorAll(".step");

// ======================================
// RECORD IDS (State Management)
// ======================================
let basicsRecordId = null;
let accountingRecordId = null;
let incomeRecordId = null;
let expensesRecordId = null;
let ownershipRecordId = null;
let complianceRecordId = null;
let priorYearRecordId = null;
let taxClassRecordId = null;
let documentsRecordId = null;

// Track your files in memory before uploading
let fileArrayOne = [];
let fileArrayTwo = [];

// ======================================
// MASTER RECORD SYNC LOGIC
// ======================================
let masterRecordId = null;
function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";

    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    let timeout;

    const removeToast = () => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    };

    const startTimer = () => {
        clearTimeout(timeout);
        timeout = setTimeout(removeToast, 2000);
    };

    const stopTimer = () => {
        clearTimeout(timeout);
    };

    // Start auto-dismiss timer
    startTimer();

    // Pause timer on hover
    toast.addEventListener("mouseenter", stopTimer);

    // Resume timer on mouse leave
    toast.addEventListener("mouseleave", startTimer);

    // Close button
    toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(timeout);
        removeToast();
    });
}

function syncMasterRecord(stepNum, stepRecordId, isFinalSubmit = false) {
    return new Promise((resolve) => {
        // Retrieve Entity_Master ID from DOM if not already in memory
        if (!masterRecordId) {
            const masterInput = document.querySelector("#Entity_Master");
            if (masterInput && masterInput.value) {
                masterRecordId = masterInput.value;
            }
        }

        let completed = [];
        if (basicsRecordId) completed.push("1");
        if (accountingRecordId) completed.push("2");
        if (incomeRecordId) completed.push("3");
        if (expensesRecordId) completed.push("4");
        if (ownershipRecordId) completed.push("5");
        if (complianceRecordId) completed.push("6");
        if (priorYearRecordId) completed.push("7");
        if (taxClassRecordId) completed.push("8");
        if (documentsRecordId || stepNum === 9) completed.push("9");
        
        if (!completed.includes(stepNum.toString())) {
            completed.push(stepNum.toString());
        }

        const stepFieldMap = {
            1: "Entity_Basics",
            2: "Entity_Accounting_Financial_Information",
            3: "Entity_Income_Overview",
            4: "Entity_Expenses_Assets",
            5: "Entity_Ownership_Shareholders_Members",
            6: "Entity_Compliance_Special_Situations",
            7: "Entity_Prior_Year_Filings",
            8: "Entity_Tax_Classification",
            9: "Document_Upload_Wizard"
        };

        const currentDate = formatZohoDate(new Date().toISOString().split('T')[0]);

        let masterData = {
            data: {
                "Current_Step": isFinalSubmit ? 9 : stepNum + 1,
                "Current_Step1": completed,
                "Completed_Steps1": completed.length,
                "Status": isFinalSubmit ? "Submitted" : "In Progress"
            }
        };

        if (stepFieldMap[stepNum] && stepRecordId) {
            masterData.data[stepFieldMap[stepNum]] = stepRecordId.toString();
        }

        if (isFinalSubmit) {
            masterData.data["Submitted_On"] = currentDate;
            masterData.data["Status"] = "Submitted";
        }

        if (stepNum === 1 && !masterRecordId) {
            masterData.data["Started_On"] = currentDate;
            
            const clientInput = document.querySelector("#Clients");
            const caseInput = document.querySelector("#Case");
            
            masterData.data["Client"] = clientInput ? clientInput.value : "";
            masterData.data["Case"] = caseInput ? caseInput.value : "";

            ZOHO.CREATOR.API.addRecord({
                appName: APP_NAME,
                formName: "Entity_Master", // Assuming Entity_Master is the master form name
                data: masterData
            }).then(function(response) {
                if (response.code == 3000) {
                    masterRecordId = response.data.ID;
                    document.querySelectorAll("#Entity_Master").forEach(input => input.value = masterRecordId);
                    resolve(masterRecordId);
                } else {
                    console.error("Master Record Creation Failed:", response);
                    resolve(null);
                }
            });
        } else if (masterRecordId) {
            ZOHO.CREATOR.API.updateRecord({
                appName: APP_NAME,
                reportName: "Business_Tax_Prep", // Adjust based on your actual Master Report name
                id: masterRecordId,
                data: masterData
            }).then(function(response) {
                if (response.code == 3000) {
                    resolve(masterRecordId);
                } else {
                    console.error("Master Record Update Failed:", response);
                    resolve(null);
                }
            });
        } else {
            resolve(null);
        }
    });
}

// ======================================
// INIT
// ======================================
ZOHO.CREATOR.init().then(function () {
    console.log("Widget Initialized");
    try {
        var queryParams = ZOHO.CREATOR.UTIL.getQueryParams();
        console.log("Extracted Query Parameters:", queryParams);

        if (queryParams) {
            if (queryParams.clid) {
                document.querySelectorAll("#Clients").forEach(input => input.value = queryParams.clid);
            }
            const caseValue = queryParams.caseid || queryParams.cid;
            if (caseValue) {
                document.querySelectorAll("#Case").forEach(input => input.value = caseValue);
            }
            if (queryParams.masterid) {
                document.querySelectorAll("#Entity_Master").forEach(input => input.value = queryParams.masterid);
                masterRecordId = queryParams.masterid; 
            }
            if (queryParams.personalmasterid) {
                document.querySelectorAll("#Personal_Master").forEach(input => input.value = queryParams.personalmasterid);
            }
            if (queryParams.Legal_Business_Name) {
                const nameInput = document.querySelector("#Legal_Business_Name");
                if (nameInput) nameInput.value = decodeURIComponent(queryParams.Legal_Business_Name);
            }
        }
    } catch (error) {
        console.error("Error fetching parameters from Zoho API:", error);
    }
});

document.addEventListener("DOMContentLoaded", function() {
    fetchCountries();
    addsoftwareRow();
    addOwnerRow();
    addDocumentRow();
    updateNavButtons(currentStep);
    // --- STEP 2: Accounting & Finance ---
    const useAccSoftware = document.querySelector("#Do_you_use_accounting_software");
    if (useAccSoftware) {
        useAccSoftware.addEventListener("change", toggleAccountingSoftware);
        toggleAccountingSoftware(); 
    }

    const accessAccSoftware = document.querySelector("#Do_we_have_access_to_your_accounting_software");
    if (accessAccSoftware) {
        accessAccSoftware.addEventListener("change", toggleAccessSoftwareSubform);
        toggleAccessSoftwareSubform(); 
    }

    // --- STEP 4: Expenses & Assets ---
    const hasEmployees = document.querySelector("#Do_you_have_employees");
    if (hasEmployees) {
        hasEmployees.addEventListener("change", toggleEmployees);
        toggleEmployees(); 
    }

    const boughtAssets = document.querySelector("#Did_you_purchase_or_sell_any_business_assets_this_year");
    if (boughtAssets) {
        boughtAssets.addEventListener("change", toggleAssets);
        toggleAssets(); 
    }

    const useVehicle = document.querySelector("#Do_you_use_a_vehicle_for_business");
    if (useVehicle) {
        useVehicle.addEventListener("change", toggleVehicleBusiness);
        toggleVehicleBusiness(); 
    }

    // --- STEP 5: Ownership & Shareholders ---
    const ownershipChanges = document.querySelector("#Any_ownership_changes_during_the_year");
    if (ownershipChanges) {
        ownershipChanges.addEventListener("change", toggleOwnershipChanges);
        toggleOwnershipChanges(); 
    }

    // --- STEP 8: Tax Classification ---
    const sCorpElection = document.querySelector("#Has_the_entity_ever_made_an_S_Corp_election");
    if (sCorpElection) {
        sCorpElection.addEventListener("change", toggleSCorp);
        toggleSCorp(); 
    }
});

// ======================================
// NAVIGATION
// ======================================
function nextStep() {
    let targetStep = currentStep + 1;
    if (targetStep > formSteps.length) targetStep = formSteps.length;
    goToStep(targetStep);
}

function showStep(step) {
    formSteps.forEach((form) => form.classList.remove("active"));
    steps.forEach((item) => item.classList.remove("active"));
    formSteps[step - 1].classList.add("active");
    steps[step - 1].classList.add("active");
    currentStep = step;
    updateNavButtons(currentStep);
}

function goToStep(step) {
    if (step == 1) { showStep(1); }
    else if (step == 2) { basicsRecordId ? showStep(2) : showToast("Please complete Basic Information first"); }
    else if (step == 3) { accountingRecordId ? showStep(3) : showToast("Please complete Accounting & Finance first"); }
    else if (step == 4) { incomeRecordId ? showStep(4) : showToast("Please complete Income Overview first"); }
    else if (step == 5) { expensesRecordId ? showStep(5) : showToast("Please complete Expenses & Assets first"); }
    else if (step == 6) { ownershipRecordId ? showStep(6) : showToast("Please complete Ownership Details first"); }
    else if (step == 7) { complianceRecordId ? showStep(7) : showToast("Please complete Compliance first"); }
    else if (step == 8) { priorYearRecordId ? showStep(8) : showToast("Please complete Prior-Year Fillings first"); }
    else if (step == 9) { taxClassRecordId ? showStep(9) : showToast("Please complete Tax Classification first"); }
}

function prevStep() {
    let targetStep = currentStep - 1;
    if (targetStep < 1) targetStep = 1;
    showStep(targetStep);
}

// ======================================
// EXTERNAL API (Countries & States)
// ======================================
function fetchCountries() {
    const countryEl = document.getElementById('country-dropdown');
    const stateEl = document.getElementById('state-dropdown');
    
    try {
        if(typeof localCountryData !== 'undefined') {
            countryEl.innerHTML = '<option value="" disabled selected>-Select-</option>';
            const sortedCountries = localCountryData.sort((a, b) => a.name.localeCompare(b.name));

            sortedCountries.forEach(country => {
                const opt = document.createElement('option');
                opt.value = country.name;
                opt.textContent = country.name;
                opt.dataset.states = JSON.stringify(country.states);
                countryEl.appendChild(opt);
            });
        }
    } catch (error) {
        console.error("Error loading local countries:", error);
        countryEl.innerHTML = '<option value="" disabled selected>Failed to load countries</option>';
    }

    countryEl.addEventListener('change', (e) => {
        const selectedOption = countryEl.options[countryEl.selectedIndex];
        const states = JSON.parse(selectedOption.dataset.states || '[]');

        stateEl.innerHTML = '<option value="" disabled selected>-Select-</option>';
        if (states.length > 0) {
            stateEl.removeAttribute('disabled');
            states.sort((a, b) => a.name.localeCompare(b.name)).forEach(state => {
                const opt = document.createElement('option');
                opt.value = state.name;
                opt.textContent = state.name;
                stateEl.appendChild(opt);
            });
        } else {
            stateEl.setAttribute('disabled', 'true');
            stateEl.innerHTML = '<option value="" disabled selected>N/A (No states found)</option>';
        }
    });
}

// ======================================
// UTILITIES
// ======================================
// ======================================
// TOGGLE FUNCTIONS (CONDITIONAL LOGIC)
// ======================================

// Helper function: Hides the input AND its corresponding <label for="...">
function toggleStandardField(selectElement, targetId) {
    const target = document.querySelector(`#${targetId}`);
    if (!target) return;
    
    // Find the label that points to this specific input (if it exists)
    const label = document.querySelector(`label[for="${targetId}"]`);

    if (selectElement && selectElement.value === "Yes") {
        target.style.display = ""; // Reverts to CSS default (visible)
        if (label) label.style.display = "";
    } else {
        target.style.display = "none";
        if (label) label.style.display = "none";
        
        // Clear value when hidden to prevent saving phantom data
        if (target.tagName === "SELECT") target.selectedIndex = 0;
        else target.value = ""; 
    }
}

// --- STEP 2 TOGGLES ---
function toggleAccountingSoftware() {
    const select = document.querySelector("#Do_you_use_accounting_software");
    toggleStandardField(select, "Accounting_Software");
}

function toggleAccessSoftwareSubform() {
    const select = document.querySelector("#Do_we_have_access_to_your_accounting_software");
    const subformTable = document.querySelector("#customSubformTable");
    
    if (!subformTable) return;
    
    const subformContainer = subformTable.closest(".custom-subform-container");

    if (select && select.value === "Yes") {
        subformTable.style.display = "block";
        if (subformContainer) subformContainer.style.display = "block";
    } else {
        subformTable.style.display = "none";
        if (subformContainer) subformContainer.style.display = "none";
        
        // Clear subform data and initialize one empty row
        const tbody = subformTable.querySelector("tbody");
        if (tbody) {
            tbody.innerHTML = ""; 
            addsoftwareRow(); 
        }
    }
}

// --- STEP 4 TOGGLES ---
function toggleEmployees() {
    const select = document.querySelector("#Do_you_have_employees");
    toggleStandardField(select, "Payroll_provider");
    toggleStandardField(select, "Number_of_employees");
}

function toggleAssets() {
    const select = document.querySelector("#Did_you_purchase_or_sell_any_business_assets_this_year");
    toggleStandardField(select, "Purchase_price");
    toggleStandardField(select, "Asset_type");
    toggleStandardField(select, "Purchase_Date");
}

function toggleVehicleBusiness() {
    const select = document.querySelector("#Do_you_use_a_vehicle_for_business");
    const mileageInput = document.querySelector("#Mileage_tracking_method");
    
    if (mileageInput) {
        // Target the <div class="form-group"> that wraps both the checkboxes and the mileage input
        const container = mileageInput.closest(".form-group");
        
        if (container) {
            if (select && select.value === "Yes") {
                container.style.display = "block";
            } else {
                container.style.display = "none";
                
                // Clear the mileage text input
                mileageInput.value = "";
                
                // Uncheck all vehicle checkboxes
                const checkboxes = container.querySelectorAll('input[name="Vehicle_ownership"]');
                checkboxes.forEach(cb => cb.checked = false);
            }
        }
    }
}

// --- STEP 5 TOGGLES ---
function toggleOwnershipChanges() {
    const select = document.querySelector("#Any_ownership_changes_during_the_year");
    toggleStandardField(select, "Date_of_change");
    toggleStandardField(select, "Details_of_change");
}

// --- STEP 8 TOGGLES ---
function toggleSCorp() {
    const select = document.querySelector("#Has_the_entity_ever_made_an_S_Corp_election");
    toggleStandardField(select, "Effective_date_of_S_Corp_election");
}

function updateNavButtons(step) {
    const mobilePrev = document.getElementById('mobilePrevBtn');
    const mobileNext = document.getElementById('mobileNextBtn');
    
    if (mobilePrev) {
        mobilePrev.disabled = (step === 1);
    }
    if (mobileNext) {
        mobileNext.disabled = (step === formSteps.length);
    }
}

function formatZohoDate(dateString) {
    if (!dateString) return "";
    const parts = dateString.split("-"); 
    if (parts.length !== 3) return dateString; 

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const year = parts[0];
    const month = months[parseInt(parts[1], 10) - 1];
    const day = parts[2];

    return `${day}-${month}-${year}`;
}

function getSelectValues(selectElement) {
    if (!selectElement) return [];
    return Array.from(selectElement.selectedOptions).map(option => option.value);
}

// ======================================
// STEP 1: ENTITY BASICS
// ======================================
function savePersonalDetailsbasic() {
    const stepIndex = 0;
    const businessAddress = {
        address_line_1: formSteps[stepIndex].querySelector("#address-line-1").value,
        address_line_2: formSteps[stepIndex].querySelector("#address-line-2").value,
        district_city: formSteps[stepIndex].querySelector("#city-district").value,
        state_province: formSteps[stepIndex].querySelector("#state-dropdown").value,
        postal_Code: formSteps[stepIndex].querySelector("#postal-code").value,
        country: formSteps[stepIndex].querySelector("#country-dropdown").value,
    };
    
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Legal_Business_Name: formSteps[stepIndex].querySelector("#Legal_Business_Name").value,
            Trade_Name: formSteps[stepIndex].querySelector("#Trade_Name").value,
            Entity_Type: formSteps[stepIndex].querySelector("#Entity_Type").value,
            State_of_Formation: formSteps[stepIndex].querySelector("#State_of_Formation").value,
            Date_Business_Started: formatZohoDate(formSteps[stepIndex].querySelector("#Date_Business_Started").value),
            Primary_Business_Activity_Industry: formSteps[stepIndex].querySelector("#Primary_Business_Activity_Industry").value,
            Business_Address: businessAddress,
            Is_this_the_same_as_your_mailing_address: formSteps[stepIndex].querySelector("#Is_this_the_same_as_your_mailing_address").value,
            Mailing_Address: formSteps[stepIndex].querySelector("#Mailing_Address").value,
            Business_EIN: formSteps[stepIndex].querySelector("#Business_EIN").value,
            Do_you_need_us_to_apply_for_an_EIN: formSteps[stepIndex].querySelector("#Do_you_need_us_to_apply_for_an_EIN").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Basics", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            basicsRecordId = response.data.ID;
            syncMasterRecord(1, basicsRecordId).then(() => {
                showToast("Basic Information Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updatePersonalDetailsbasic;
                steps[0].classList.add("completed");
                showStep(2);
            });
        }
    });
}

function updatePersonalDetailsbasic() {
    const stepIndex = 0;
    const businessAddress = {
        address_line_1: formSteps[stepIndex].querySelector("#address-line-1").value,
        address_line_2: formSteps[stepIndex].querySelector("#address-line-2").value,
        district_city: formSteps[stepIndex].querySelector("#city-district").value,
        state_province: formSteps[stepIndex].querySelector("#state-dropdown").value,
        postal_Code: formSteps[stepIndex].querySelector("#postal-code").value,
        country: formSteps[stepIndex].querySelector("#country-dropdown").value,
    };
    
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Legal_Business_Name: formSteps[stepIndex].querySelector("#Legal_Business_Name").value,
            Trade_Name: formSteps[stepIndex].querySelector("#Trade_Name").value,
            Entity_Type: formSteps[stepIndex].querySelector("#Entity_Type").value,
            State_of_Formation: formSteps[stepIndex].querySelector("#State_of_Formation").value,
            Date_Business_Started: formatZohoDate(formSteps[stepIndex].querySelector("#Date_Business_Started").value),
            Primary_Business_Activity_Industry: formSteps[stepIndex].querySelector("#Primary_Business_Activity_Industry").value,
            Business_Address: businessAddress,
            Is_this_the_same_as_your_mailing_address: formSteps[stepIndex].querySelector("#Is_this_the_same_as_your_mailing_address").value,
            Mailing_Address: formSteps[stepIndex].querySelector("#Mailing_Address").value,
            Business_EIN: formSteps[stepIndex].querySelector("#Business_EIN").value,
            Do_you_need_us_to_apply_for_an_EIN: formSteps[stepIndex].querySelector("#Do_you_need_us_to_apply_for_an_EIN").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "All_Entity_Basics", id: basicsRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(1, basicsRecordId).then(() => {
                showToast("Basic Information Updated");
                showStep(2);
            });
        }
    });
}

// ======================================
// STEP 2: ACCOUNTING & FINANCE
// ======================================
function addsoftwareRow() {
    const tbody = document.querySelector("#customSubformTable tbody");
    const newRow = document.createElement("tr");
    newRow.className = "subform-row";
    newRow.style.borderBottom = "1px solid #edf2f7";
    newRow.innerHTML = `
        <td style="padding: 8px 0; text-align: center;">
            <button type="button" onclick="removeSoftwareRow(this)" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-weight:bold; font-size: 18px;">&times;</button>
        </td>
        <td style="padding: 8px 0;">
            <input type="text" class="sw-bank-name" placeholder="Bank Name" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
        </td>
        <td style="padding: 8px 0;">
            <input type="text" class="sw-last4" placeholder="Last 4" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
        </td>
        <td style="padding: 8px 0;">
            <select class="sw-biz-personal" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;" multiple>
                <option value="" disabled selected>-Select-</option>
                <option value="Business">Business</option>
                <option value="Personal">Personal</option>
            </select>
        </td>
    `;
    tbody.appendChild(newRow);
}

function removeSoftwareRow(button) {
    const rows = document.querySelectorAll("#customSubformTable .subform-row");
    if (rows.length > 1) button.closest("tr").remove();
}

function serializeSoftwareSubform() {
    const rows = document.querySelectorAll("#customSubformTable .subform-row");
    let dataArray = [];

    rows.forEach((row, index) => {
        const bankName = row.querySelector(".sw-bank-name").value.trim();
        const last4 = row.querySelector(".sw-last4").value.trim();
        
        // Extract all selected values from the multi-select dropdown
        const bizPersonalSelect = row.querySelector(".sw-biz-personal");
        const bizPersonalValues = Array.from(bizPersonalSelect.selectedOptions)
                                       .map(option => option.value)
                                       .filter(value => value !== ""); // Filter out the disabled "-Select-" option

        if (bankName) {
            dataArray.push({
                "Bank_Name": bankName,
                "Last_4_digits": last4,
                "Business_or_personal": bizPersonalValues, // Passes the array of selected values
                "record::status": "added",
                "row::key": `t::row_${index + 1}`
            });
        }
    });
    return dataArray;
}

function savesoftwareDetails() {
    const stepIndex = 1;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Accounting_Method: formSteps[stepIndex].querySelector("#Accounting_Method").value,
            Do_you_use_accounting_software: formSteps[stepIndex].querySelector("#Do_you_use_accounting_software").value,
            Accounting_Software: formSteps[stepIndex].querySelector("#Accounting_Software").value,
            Do_we_have_access_to_your_accounting_software: formSteps[stepIndex].querySelector("#Do_we_have_access_to_your_accounting_software").value,
            Do_you_have_business_credit_cards: formSteps[stepIndex].querySelector("#Do_you_have_business_credit_cards").value,
            Business_Bank_Accounts: serializeSoftwareSubform()
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Accounting_Financial_Information", data: formData
    }).then(function(response) {
        if (response.code === 3000) {
            accountingRecordId = response.data.ID;
            syncMasterRecord(2, accountingRecordId).then(() => {
                showToast("Accounting Details Saved");
                const btn = formSteps[stepIndex].querySelector("#educationBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updatesoftwareDetails;
                steps[stepIndex].classList.add("completed");
                showStep(3);
            });
        }
    });
}

function updatesoftwareDetails() {
    const stepIndex = 1;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Accounting_Method: formSteps[stepIndex].querySelector("#Accounting_Method").value,
            Do_you_use_accounting_software: formSteps[stepIndex].querySelector("#Do_you_use_accounting_software").value,
            Accounting_Software: formSteps[stepIndex].querySelector("#Accounting_Software").value,
            Do_we_have_access_to_your_accounting_software: formSteps[stepIndex].querySelector("#Do_we_have_access_to_your_accounting_software").value,
            Do_you_have_business_credit_cards: formSteps[stepIndex].querySelector("#Do_you_have_business_credit_cards").value,
            Business_Bank_Accounts: serializeSoftwareSubform()
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "Entity_Accounting_Financial_Information_Report", id: accountingRecordId, data: formData
    }).then(function(response) {
        if (response.code === 3000) {
            syncMasterRecord(2, accountingRecordId).then(() => {
                showToast("Accounting Details Updated");
                showStep(3);
            });
        }
    });
}

// ======================================
// STEP 3: INCOME OVERVIEW
// ======================================
function saveEntIncomeDetails() {
    const stepIndex = 2;
    const sourcesSelect = formSteps[stepIndex].querySelector("#Primary_income_sources");
    
    // Safely extract all selected values and filter out the default "-Select-" option
    const primarySources = Array.from(sourcesSelect.selectedOptions)
                                .map(option => option.value)
                                .filter(value => value !== "");

    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Primary_income_sources: primarySources, // Passes the clean array to Zoho
            Approximate_gross_revenue_for_the_year: formSteps[stepIndex].querySelector("#Approximate_gross_revenue_for_the_year").value,
            Did_you_receive_any_1099s: formSteps[stepIndex].querySelector("#Did_you_receive_any_1099s").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Income_Overview", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            incomeRecordId = response.data.ID;
            syncMasterRecord(3, incomeRecordId).then(() => {
                showToast("Income Overview Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updateEntIncomeDetails;
                steps[stepIndex].classList.add("completed");
                showStep(4);
            });
        }
    });
}

function updateEntIncomeDetails() {
    const stepIndex = 2;
    const sourcesSelect = formSteps[stepIndex].querySelector("#Primary_income_sources");
    
    // Safely extract all selected values and filter out the default "-Select-" option
    const primarySources = Array.from(sourcesSelect.selectedOptions)
                                .map(option => option.value)
                                .filter(value => value !== "");

    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Primary_income_sources: primarySources,
            Approximate_gross_revenue_for_the_year: formSteps[stepIndex].querySelector("#Approximate_gross_revenue_for_the_year").value,
            Did_you_receive_any_1099s: formSteps[stepIndex].querySelector("#Did_you_receive_any_1099s").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "All_Entity_Income_Overviews", id: incomeRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(3, incomeRecordId).then(() => {
                showToast("Income Overview Updated");
                showStep(4);
            });
        }
    });
}
// ======================================
// STEP 4: EXPENSES & ASSETS
// ======================================
function saveEntExpensesDetails() {
    const stepIndex = 3;
    const ownershipCheckboxes = Array.from(formSteps[stepIndex].querySelectorAll('input[name="Vehicle_ownership"]:checked')).map(cb => cb.value);

    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Do_you_have_employees: formSteps[stepIndex].querySelector("#Do_you_have_employees").value,
            Payroll_provider: formSteps[stepIndex].querySelector("#Payroll_provider").value,
            Number_of_employees: formSteps[stepIndex].querySelector("#Number_of_employees").value,
            Did_you_purchase_or_sell_any_business_assets_this_year: formSteps[stepIndex].querySelector("#Did_you_purchase_or_sell_any_business_assets_this_year").value,
            Asset_type: formSteps[stepIndex].querySelector("#Asset_type").value,
            Purchase_Date: formatZohoDate(formSteps[stepIndex].querySelector("#Purchase_Date").value),
            Purchase_price: formSteps[stepIndex].querySelector("#Purchase_price").value,
            Do_you_use_a_vehicle_for_business: formSteps[stepIndex].querySelector("#Do_you_use_a_vehicle_for_business").value,
            Vehicle_ownership: ownershipCheckboxes,
            Mileage_tracking_method: formSteps[stepIndex].querySelector("#Mileage_tracking_method").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Expenses_Assets", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            expensesRecordId = response.data.ID;
            syncMasterRecord(4, expensesRecordId).then(() => {
                showToast("Expenses & Assets Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn"); 
                btn.innerText = "Update & Next";
                btn.onclick = updateEntExpensesDetails;
                steps[stepIndex].classList.add("completed");
                showStep(5);
            });
        }
    });
}

function updateEntExpensesDetails() {
    const stepIndex = 3;
    const ownershipCheckboxes = Array.from(formSteps[stepIndex].querySelectorAll('input[name="Vehicle_ownership"]:checked')).map(cb => cb.value);

    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Do_you_have_employees: formSteps[stepIndex].querySelector("#Do_you_have_employees").value,
            Payroll_provider: formSteps[stepIndex].querySelector("#Payroll_provider").value,
            Number_of_employees: formSteps[stepIndex].querySelector("#Number_of_employees").value,
            Did_you_purchase_or_sell_any_business_assets_this_year: formSteps[stepIndex].querySelector("#Did_you_purchase_or_sell_any_business_assets_this_year").value,
            Asset_type: formSteps[stepIndex].querySelector("#Asset_type").value,
            Purchase_Date: formatZohoDate(formSteps[stepIndex].querySelector("#Purchase_Date").value),
            Purchase_price: formSteps[stepIndex].querySelector("#Purchase_price").value,
            Do_you_use_a_vehicle_for_business: formSteps[stepIndex].querySelector("#Do_you_use_a_vehicle_for_business").value,
            Vehicle_ownership: ownershipCheckboxes,
            Mileage_tracking_method: formSteps[stepIndex].querySelector("#Mileage_tracking_method").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "Entity_Expenses_Assets_Report", id: expensesRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(4, expensesRecordId).then(() => {
                showToast("Expenses & Assets Updated");
                showStep(5);
            });
        }
    });
}

// ======================================
// STEP 5: OWNERSHIP & SHAREHOLDERS
// ======================================
function addOwnerRow() {
    const tbody = document.querySelector("#customSubformTableOWNER tbody");
    const newRow = document.createElement("tr");
    newRow.className = "subform-row";
    newRow.style.borderBottom = "1px solid #edf2f7";
    
    // Notice the IDs have been changed to classes (e.g., ow-address-line-1, ow-country) 
    // to prevent duplicate ID conflicts across multiple rows.
    newRow.innerHTML = `
        <td style="padding: 8px 0; text-align: center;">
            <button type="button" onclick="removeOwnerRow(this)" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-weight:bold; font-size: 18px;">&times;</button>
        </td>
        <td style="padding: 8px 0;">
            <input type="text" class="ow-name" placeholder="Name" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
        </td>
        <td style="padding: 8px 0;">
            <input type="number" min="0" max="100" step="0.01" class="ow-ownership" placeholder="Ownership %" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
        </td>
        <td style="padding: 8px 0;">
            <select class="ow-role" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
                <option value="" selected disabled>-Select-</option>
                <option value="Member">Member</option>
                <option value="Manager">Manager</option>
                <option value="Shareholder">Shareholder</option>
                <option value="Officer">Officer</option>
            </select>
        </td>
        <td style="padding: 8px 0;">
            <input type="text" class="ow-ssn" placeholder="SSN/ITIN" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;" />
        </td>
        <td style="padding: 8px 0;">
            <div class="address-container">
                <div class="address-grid">
                    <div class="input-group full-width">
                        <input type="text" class="ow-address-line-1 address-input">
                        <label class="address-label">Address Line 1</label>
                    </div>
                    <div class="input-group full-width">
                        <input type="text" class="ow-address-line-2 address-input">
                        <label class="address-label">Address Line 2</label>
                    </div>
                    <div class="input-group">
                        <input type="text" class="ow-city address-input">
                        <label class="address-label">City / District</label>
                    </div>
                    <div class="input-group">
                        <select class="ow-state address-input" disabled>
                            <option value="" disabled selected>Select country first</option>
                        </select>
                        <label class="address-label">State / Province</label>
                    </div>
                    <div class="input-group">
                        <input type="text" class="ow-postal address-input">
                        <label class="address-label">Postal Code</label>
                    </div>
                    <div class="input-group">
                        <select class="ow-country address-input">
                            <option value="" disabled selected>Loading countries...</option>
                        </select>
                        <label class="address-label">Country</label>
                    </div>
                </div>
            </div>
        </td>
        <td style="padding: 8px 0;">
            <input type="email" class="ow-email" placeholder="Email" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;" />
        </td>
        <td style="padding: 8px 0;">
            <select class="ow-active" style="width:92%; height:34px; padding:0 8px; border:1px solid #c5cae4; border-radius:6px; outline:none;">
                <option value="" disabled selected>-Select-</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
            </select>
        </td>
    `;
    tbody.appendChild(newRow);

    // ======================================
    // Populate Countries specifically for this row
    // ======================================
    const countrySelect = newRow.querySelector('.ow-country');
    const stateSelect = newRow.querySelector('.ow-state');

    try {
        if (typeof localCountryData !== 'undefined') {
            countrySelect.innerHTML = '<option value="" disabled selected>-Select-</option>';
            const sortedCountries = localCountryData.sort((a, b) => a.name.localeCompare(b.name));

            sortedCountries.forEach(country => {
                const opt = document.createElement('option');
                opt.value = country.name;
                opt.textContent = country.name;
                opt.dataset.states = JSON.stringify(country.states);
                countrySelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.error("Error loading local countries:", error);
        countrySelect.innerHTML = '<option value="" disabled selected>Failed to load</option>';
    }

    // Handle State population on Country change for this row
    countrySelect.addEventListener('change', (e) => {
        const selectedOption = countrySelect.options[countrySelect.selectedIndex];
        const states = JSON.parse(selectedOption.dataset.states || '[]');

        stateSelect.innerHTML = '<option value="" disabled selected>-Select-</option>';
        if (states.length > 0) {
            stateSelect.removeAttribute('disabled');
            states.sort((a, b) => a.name.localeCompare(b.name)).forEach(state => {
                const opt = document.createElement('option');
                opt.value = state.name;
                opt.textContent = state.name;
                stateSelect.appendChild(opt);
            });
        } else {
            stateSelect.setAttribute('disabled', 'true');
            stateSelect.innerHTML = '<option value="" disabled selected>N/A</option>';
        }
    });
}

function removeOwnerRow(button) {
    const rows = document.querySelectorAll("#customSubformTableOWNER .subform-row");
    if (rows.length > 1) button.closest("tr").remove();
}

function serializeOwnerSubform() {
    const rows = document.querySelectorAll("#customSubformTableOWNER .subform-row");
    let dataArray = [];

    rows.forEach((row, index) => {
        // 1. Handle Compound Name Field (Split single input into First and Last Name)
        const fullName = row.querySelector(".ow-name").value.trim();
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        const ownerNameObj = {
            "first_name": firstName,
            "last_name": lastName
        };

        // 2. Handle Compound Address Field
        const addressObj = {
            "address_line_1": row.querySelector(".ow-address-line-1").value.trim(),
            "address_line_2": row.querySelector(".ow-address-line-2").value.trim(),
            "district_city": row.querySelector(".ow-city").value.trim(),
            "state_province": row.querySelector(".ow-state").value || "",
            "postal_Code": row.querySelector(".ow-postal").value.trim(),
            "country": row.querySelector(".ow-country").value || ""
        };

        // 3. Get remaining standard fields
        const ownership = row.querySelector(".ow-ownership").value.trim();
        const role = row.querySelector(".ow-role").value;
        const ssn = row.querySelector(".ow-ssn").value.trim();
        const email = row.querySelector(".ow-email").value.trim();
        const isActive = row.querySelector(".ow-active").value;

        if (fullName) {
            dataArray.push({
                "Owner_Name": JSON.stringify(ownerNameObj), // Formatted as stringified JSON
                "Ownership": ownership,
                "Role": role,
                "SSN_ITIN": ssn, // Updated API name
                "Owner_Address": JSON.stringify(addressObj), // Formatted as stringified JSON
                "Email": email,
                "Is_this_owner_active_in_the_business": isActive,
                "record::status": "added",
                "row::key": `t::row_${index + 1}`
            });
        }
    });
    
    return dataArray;
}
function saveOwnerDetails() {
    const stepIndex = 4;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Number_of_owners: formSteps[stepIndex].querySelector("#Number_of_owners").value,
            Owner_Details: serializeOwnerSubform(),
            Any_ownership_changes_during_the_year: formSteps[stepIndex].querySelector("#Any_ownership_changes_during_the_year").value,
            Details_of_change: formSteps[stepIndex].querySelector("#Details_of_change").value,
            Date_of_change: formSteps[stepIndex].querySelector("#Date_of_change").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Ownership_Shareholders_Members", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            ownershipRecordId = response.data.ID;
            syncMasterRecord(5, ownershipRecordId).then(() => {
                showToast("Ownership Details Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn"); 
                btn.innerText = "Update & Next";
                btn.onclick = updateOwnerDetails;
                steps[stepIndex].classList.add("completed");
                showStep(6);
            });
        }
    });
}

function updateOwnerDetails() {
    const stepIndex = 4;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Number_of_owners: formSteps[stepIndex].querySelector("#Number_of_owners").value,
            Owner_Details: serializeOwnerSubform(),
            Any_ownership_changes_during_the_year: formSteps[stepIndex].querySelector("#Any_ownership_changes_during_the_year").value,
            Details_of_change: formSteps[stepIndex].querySelector("#Details_of_change").value,
            Date_of_change: formatZohoDate(formSteps[stepIndex].querySelector("#Date_of_change").value)
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "Entity_Ownership_Shareholders_Members_Report", id: ownershipRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(5, ownershipRecordId).then(() => {
                showToast("Ownership Details Updated");
                showStep(6);
            });
        }
    });
}

// ======================================
// STEP 6: COMPLIANCE & SPECIAL SITUATIONS
// ======================================
function saveComplianceDetails() {
    const stepIndex = 5;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Any_sales_tax_obligations: formSteps[stepIndex].querySelector("#Any_sales_tax_obligations").value,
            Any_foreign_owners_or_foreign_income: formSteps[stepIndex].querySelector("#Any_foreign_owners_or_foreign_income").value,
            Any_estimated_tax_payments_made: formSteps[stepIndex].querySelector("#Any_estimated_tax_payments_made").value,
            Any_major_changes_expected_next_year: formSteps[stepIndex].querySelector("#Any_major_changes_expected_next_year").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Compliance_Special_Situations", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            complianceRecordId = response.data.ID;
            syncMasterRecord(6, complianceRecordId).then(() => {
                showToast("Compliance Details Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updateComplianceDetails;
                steps[stepIndex].classList.add("completed");
                showStep(7);
            });
        }
    });
}

function updateComplianceDetails() {
    const stepIndex = 5;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Any_sales_tax_obligations: formSteps[stepIndex].querySelector("#Any_sales_tax_obligations").value,
            Any_foreign_owners_or_foreign_income: formSteps[stepIndex].querySelector("#Any_foreign_owners_or_foreign_income").value,
            Any_estimated_tax_payments_made: formSteps[stepIndex].querySelector("#Any_estimated_tax_payments_made").value,
            Any_major_changes_expected_next_year: formSteps[stepIndex].querySelector("#Any_major_changes_expected_next_year").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "Entity_Compliance_Special_Situations_Report", id: complianceRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(6, complianceRecordId).then(() => {
                showToast("Compliance Details Updated");
                showStep(7);
            });
        }
    });
}

// ======================================
// STEP 7: PRIOR-YEAR FILINGS
// ======================================
function saveEntPriorDetails() {
    const stepIndex = 6;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Have_prior_year_business_tax_returns_been_filed: formSteps[stepIndex].querySelector("#Have_prior_year_business_tax_returns_been_filed").value,
            Any_notices_from_IRS_or_state_agencies: formSteps[stepIndex].querySelector("#Any_notices_from_IRS_or_state_agencies").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Prior_Year_Filings", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            priorYearRecordId = response.data.ID;
            
            // Handle file upload separately
            const fileInput = formSteps[stepIndex].querySelector("#Upload_prior_year_returns");
            if (fileInput && fileInput.files.length > 0) {
                ZOHO.CREATOR.API.uploadFile({
                    appName: APP_NAME,
                    reportName: "All_Entity_Prior_year_Filings",
                    id: priorYearRecordId,
                    fieldName: "Upload_prior_year_returns",
                    file: fileInput.files[0]
                });
            }

            syncMasterRecord(7, priorYearRecordId).then(() => {
                showToast("Prior Year Filings Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updateEntPriorDetails;
                steps[stepIndex].classList.add("completed");
                showStep(8);
            });
        }
    });
}

function updateEntPriorDetails() {
    const stepIndex = 6;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Have_prior_year_business_tax_returns_been_filed: formSteps[stepIndex].querySelector("#Have_prior_year_business_tax_returns_been_filed").value,
            Any_notices_from_IRS_or_state_agencies: formSteps[stepIndex].querySelector("#Any_notices_from_IRS_or_state_agencies").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "All_Entity_Prior_year_Filings", id: priorYearRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            const fileInput = formSteps[stepIndex].querySelector("#Upload_prior_year_returns");
            if (fileInput && fileInput.files.length > 0) {
                ZOHO.CREATOR.API.uploadFile({
                    appName: APP_NAME,
                    reportName: "All_Entity_Prior_year_Filings",
                    id: priorYearRecordId,
                    fieldName: "Upload_prior_year_returns",
                    file: fileInput.files[0]
                });
            }

            syncMasterRecord(7, priorYearRecordId).then(() => {
                showToast("Prior Year Filings Updated");
                showStep(8);
            });
        }
    });
}

// ======================================
// STEP 8: TAX CLASSIFICATION
// ======================================
function saveEnttaxDetails() {
    const stepIndex = 7;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            How_is_the_entity_currently_taxed: formSteps[stepIndex].querySelector("#How_is_the_entity_currently_taxed").value,
            Has_the_entity_ever_made_an_S_Corp_election: formSteps[stepIndex].querySelector("#Has_the_entity_ever_made_an_S_Corp_election").value,
            Effective_date_of_S_Corp_election: formatZohoDate(formSteps[stepIndex].querySelector("#Effective_date_of_S_Corp_election").value),
            Is_the_entity_new_this_tax_year: formSteps[stepIndex].querySelector("#Is_the_entity_new_this_tax_year").value,
            Is_this_entity_part_of_a_group_or_related_to_other_businesses: formSteps[stepIndex].querySelector("#Is_this_entity_part_of_a_group_or_related_to_other_businesses").value,
            List_related_entities: formSteps[stepIndex].querySelector("#List_related_entities").value
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, formName: "Entity_Tax_Classification", data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            taxClassRecordId = response.data.ID;
            syncMasterRecord(8, taxClassRecordId).then(() => {
                showToast("Tax Classification Saved");
                const btn = formSteps[stepIndex].querySelector("#basicBtn");
                btn.innerText = "Update & Next";
                btn.onclick = updateEnttaxDetails;
                steps[stepIndex].classList.add("completed");
                showStep(9);
            });
        }
    });
}

function updateEnttaxDetails() {
    const stepIndex = 7;
    const formData = {
        data: {
            Clients: formSteps[stepIndex].querySelector("#Clients").value,
            Case: formSteps[stepIndex].querySelector("#Case").value,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            How_is_the_entity_currently_taxed: formSteps[stepIndex].querySelector("#How_is_the_entity_currently_taxed").value,
            Has_the_entity_ever_made_an_S_Corp_election: formSteps[stepIndex].querySelector("#Has_the_entity_ever_made_an_S_Corp_election").value,
            Effective_date_of_S_Corp_election: formatZohoDate(formSteps[stepIndex].querySelector("#Effective_date_of_S_Corp_election").value),
            Is_the_entity_new_this_tax_year: formSteps[stepIndex].querySelector("#Is_the_entity_new_this_tax_year").value,
            Is_this_entity_part_of_a_group_or_related_to_other_businesses: formSteps[stepIndex].querySelector("#Is_this_entity_part_of_a_group_or_related_to_other_businesses").value,
            List_related_entities: formSteps[stepIndex].querySelector("#List_related_entities").value
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, reportName: "All_Entity_Tax_Classifications", id: taxClassRecordId, data: formData
    }).then(function(response) {
        if (response.code == 3000) {
            syncMasterRecord(8, taxClassRecordId).then(() => {
                showToast("Tax Classification Updated");
                showStep(9);
            });
        }
    });
}

// ======================================
// CONFIRMATION MODAL LOGIC
// ======================================
let currentSubmitAction = '';

function showSubmitModal(action) {
    currentSubmitAction = action;
    let modal = document.getElementById("confirmSubmitModal");
    
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "confirmSubmitModal";
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #f4f5f7; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                
                <div style="background: white; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; box-sizing: border-box;">
                    
                    <div style="width: 80px; height: 80px; background: #8b0000; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold; margin-bottom: 30px;">
                        ✓
                    </div>

                    <h1 style="color: #2b3d63; font-size: 36px; margin-bottom: 20px;">Ready to Submit?</h1>
                    
                    <p style="color: #4a5568; font-size: 20px; line-height: 1.6; max-width: 600px; margin-bottom: 50px;">
                        You are about to finalize and submit all of your business details, financial information, and attached documents. <br><br>
                        This action will finalize your record.
                    </p>
                    
                    <div style="display: flex; gap: 30px; flex-wrap: wrap; justify-content: center;">
                        <button type="button" onclick="closeSubmitModal()" style="background: transparent; color: #4a5568; border: 2px solid #c5cae4; padding: 15px 40px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 18px; transition: all 0.2s;">
                            Review
                        </button>
                        
                        <button type="button" onclick="confirmSubmit()" style="background: #8b0000; color: white; border: 2px solid #8b0000; padding: 15px 50px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 18px; transition: all 0.2s;">
                            Submit
                        </button>
                    </div>
                    
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = "hidden";
    modal.style.display = "block";
}

function closeSubmitModal() {
    const modal = document.getElementById("confirmSubmitModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
}

function confirmSubmit() {
    closeSubmitModal();
    if (currentSubmitAction === 'submit') {
       showToast("Request Submitted Successfully!");
       window.location.reload();
    }
}

// ======================================
// STEP 9: DOCUMENTS DETAILS
// ======================================
function saveDocumentsDetails() {
    executeSaveDocumentsDetails();
}

function updateDocumentsDetails() {
    executeUpdateDocumentsDetails();
}

// =====================================
// ROW GENERATION & FILE TRACKING
// =====================================
const inputStyle = 'width:92%; height:34px; padding:0 8px; border:1px solid #F0E0E4; border-radius:6px; outline:none; box-sizing: border-box;';
let subformFileTracker = {};

function addDocumentRow() {
    const tbody = document.querySelector("#customSubformTableDOCS tbody");
    const newRow = document.createElement("tr");
    newRow.className = "subform-row";
    
    const rowId = 'row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    newRow.setAttribute("data-ui-row-id", rowId);
    subformFileTracker[rowId] = { typeOne: null, typeTwo: null };

    newRow.style.borderBottom = "1px solid #edf2f7";
    newRow.innerHTML = `
        <td style="padding: 8px 0; text-align: center;">
            <button type="button" onclick="removeDocumentRow(this)" style="background:none; border:none; color:#e53e3e; cursor:pointer; font-weight:bold; font-size: 18px;">&times;</button>
        </td>
        <td style="padding: 8px 0;"><input type="text" class="sf-document" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-doc-type" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-doc-name" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="file" multiple class="sf-doc-file" style="${inputStyle}" onchange="handleRowFile(this, 'typeOne')"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-doc-desc" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="file" multiple class="sf-up-file1" style="${inputStyle}" onchange="handleRowFile(this, 'typeTwo')"></td>
        <td style="padding: 8px 0;">
            <select class="sf-year" style="${inputStyle}">
                <option value="" disabled selected>- Year -</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
            </select>
        </td>
        <td style="padding: 8px 0;"><input type="date" class="sf-up-due" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="date" class="sf-up-date" placeholder="DD-MMM-YYYY" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-up-by" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-workdrive-url" placeholder="URL" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-workdrive-id" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-cpa" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-status" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-priority" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-staff-comm" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-record-id" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-rev-by" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-rev-comm" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="date" class="sf-rev-on" style="${inputStyle}"></td>
        <td style="padding: 8px 0;"><input type="text" class="sf-assigned-rev" style="${inputStyle}"></td>
    `;
    tbody.appendChild(newRow);
}

function removeDocumentRow(button) {
    const rows = document.querySelectorAll("#customSubformTableDOCS .subform-row");
    if (rows.length > 1) {
        const row = button.closest("tr");
        const rowId = row.getAttribute("data-ui-row-id");
        delete subformFileTracker[rowId]; 
        row.remove();
    }
}

function handleRowFile(inputElement, type) {
    const row = inputElement.closest("tr");
    const rowId = row.getAttribute("data-ui-row-id");
    
    if (inputElement.files.length > 0) {
       subformFileTracker[rowId][type] = Array.from(inputElement.files);
    } else {
        subformFileTracker[rowId][type] = null;
    }
}

function getVal(row, selector) {
    const el = row.querySelector(selector);
    if (!el) return "";
    let val = el.value.trim();
    if (val === "-Select-" || val === "- Year -") return "";
    return val;
}

function serializeDocumentSubform(Clientsval, Caseval) {
    const rows = document.querySelectorAll("#customSubformTableDOCS .subform-row");
    let dataArray = [];

    rows.forEach((row, index) => {
        const rawUrl = getVal(row, ".sf-workdrive-url");
        const urlFieldObj = rawUrl ? JSON.stringify({ "Workdrive_URL": rawUrl, "zcurl": "", "zctarget": "new" }) : JSON.stringify({ "Workdrive_URL": "", "zcurl": "", "zctarget": "new" });

        const zohoRowId = row.getAttribute("data-zoho-row-id");
        
        let rowPayload = {
            "Client": Clientsval,
            "Document": getVal(row, ".sf-document"),
            "Document_Type": getVal(row, ".sf-doc-type"),
            "Document_Name": getVal(row, ".sf-doc-name"),
            "Document_Desciption": getVal(row, ".sf-doc-desc"),
            "Case": Caseval,
            "Year_field": getVal(row, ".sf-year"),
            "Upload_Due_Date":formatZohoDate( getVal(row, ".sf-up-due")),
            "Upload_Date": formatZohoDate(getVal(row, ".sf-up-date")), 
            "Uploaded_By": getVal(row, ".sf-up-by"),
            "Workdrive_URL": urlFieldObj,
            "WorkDrive_File_ID": getVal(row, ".sf-workdrive-id"),
            "Assigned_CPA": getVal(row, ".sf-cpa"),
            "Status": getVal(row, ".sf-status"),
            "Priority": getVal(row, ".sf-priority"),
            "Staff_Comments": getVal(row, ".sf-staff-comm"),
            "Record_ID": getVal(row, ".sf-record-id"),
            "Reviewed_By": getVal(row, ".sf-rev-by"),
            "Review_Comments": getVal(row, ".sf-rev-comm"),
            "Reviewed_On": formatZohoDate(getVal(row, ".sf-rev-on")),
            "Assigned_Reviewer": getVal(row, ".sf-assigned-rev")
        };

        if (zohoRowId) {
            rowPayload["id"] = zohoRowId;
            rowPayload["record::status"] = "added";
        } else {
            rowPayload["record::status"] = "added";
            rowPayload["row::key"] = `t::row_${index + 1}`;
        }

        dataArray.push(rowPayload);
    });
    return dataArray;
}

// =====================================
// SAVE & UPLOAD EXECUTION
// =====================================
function executeSaveDocumentsDetails() {
    const stepIndex = 8;
    const Clientsval= formSteps[stepIndex].querySelector("#Clients").value;
    const Caseval= formSteps[stepIndex].querySelector("#Case").value;
    const formData = {
        data: {
            Clients: Clientsval,
            Case: Caseval,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Personal_Master: formSteps[stepIndex].querySelector("#Personal_Master").value,
            Documents: serializeDocumentSubform(Clientsval, Caseval) 
        }
    };

    ZOHO.CREATOR.API.addRecord({
        appName: APP_NAME, 
        formName: "Document_Upload_Wizard", 
        data: formData
    }).then(async function(response) {
        if (response.code == 3000) {
            documentsRecordId = response.data.ID;
            console.log("Parent Record Created. ID:", documentsRecordId);

            try {
                const recordDetails = await ZOHO.CREATOR.API.getRecordById({
                    appName: APP_NAME,
                    reportName: "All_Document_Upload_Wizards", 
                    id: documentsRecordId
                });
                console.log(recordDetails);
                const subformRows = recordDetails.data.Documents; 
                
                await uploadAllWizardFiles(subformRows);

                // Run final master sync
                await syncMasterRecord(9, documentsRecordId, true);

                showToast("Documents & Files Saved Successfully!");
                const btn = formSteps[stepIndex].querySelector("#basicBtn"); 
                btn.innerText = "Update";
                btn.onclick = updateDocumentsDetails; 
                steps[stepIndex].classList.add("completed");
                showSubmitModal('submit');
            } catch (error) {
                console.error("Failed to fetch subform rows or upload files:", error);
                showToast("Text saved, but file uploads failed. Check console.");
            }
        } else {
            console.error("Save Failed:", response.error);
            showToast("Failed to save documents. Fill Mandatory fields");
        }
    });
}

function executeUpdateDocumentsDetails() {
    const stepIndex = 8;
    const Clientsval= formSteps[stepIndex].querySelector("#Clients").value;
    const Caseval= formSteps[stepIndex].querySelector("#Case").value;
    const formData = {
        data: {
            Clients: Clientsval,
            Case: Caseval,
            Entity_Master: formSteps[stepIndex].querySelector("#Entity_Master").value,
            Personal_Master: formSteps[stepIndex].querySelector("#Personal_Master").value,
            Documents: serializeDocumentSubform(Clientsval, Caseval) 
        }
    };

    ZOHO.CREATOR.API.updateRecord({
        appName: APP_NAME, 
        reportName: "All_Document_Upload_Wizards", 
        id: documentsRecordId,
        data: formData
    }).then(async function(response) {
        if (response.code == 3000) {
            console.log("Parent Record Updated.");

            try {
                const recordDetails = await ZOHO.CREATOR.API.getRecordById({
                    appName: APP_NAME,
                    reportName: "All_Document_Upload_Wizards", 
                    id: documentsRecordId
                });
                
                const subformRows = recordDetails.data.Documents; 
                await uploadAllWizardFiles(subformRows);
                
                // Run final master sync
                await syncMasterRecord(9, documentsRecordId, true);

                showToast("Documents & Files Updated Successfully!");
                showSubmitModal('submit');
            } catch (error) {
                console.error("Failed to fetch subform rows or upload files:", error);
                showToast("Text updated, but file uploads failed. Check console.");
            }
        } else {
            console.error("Update Failed:", response.error);
            showToast("Failed to update documents.");
        }
    });
}

async function uploadAllWizardFiles(savedZohoRows) {
    const uiRows = document.querySelectorAll("#customSubformTableDOCS .subform-row");

    for (let i = 0; i < uiRows.length; i++) {
        let uiRowId = uiRows[i].getAttribute("data-ui-row-id");
        let filesToUpload = subformFileTracker[uiRowId];
        
        let zohoSubformRowId = null;
        
        if (!zohoSubformRowId && savedZohoRows[i]) {
            zohoSubformRowId = savedZohoRows[i].ID;
            uiRows[i].setAttribute("data-zoho-row-id", zohoSubformRowId); 
        }

        if (zohoSubformRowId && filesToUpload) {
            if (filesToUpload.typeOne && filesToUpload.typeOne.length > 0) {
                for (let file of filesToUpload.typeOne) {
                    await uploadSingleFile("Document_File", file, zohoSubformRowId);
                }
                filesToUpload.typeOne = null; 
            }
            
            if (filesToUpload.typeTwo && filesToUpload.typeTwo.length > 0) {
                for (let file of filesToUpload.typeTwo) {
                    await uploadSingleFile("Upload_File1", file, zohoSubformRowId);
                }
                filesToUpload.typeTwo = null; 
            }
        }
    }
}

function uploadSingleFile(fieldName, file, subformRowId) {
    return ZOHO.CREATOR.API.uploadFile({
        appName: APP_NAME,
        reportName: "All_Document_Upload_Wizards",
        id: subformRowId, 
        parentId: documentsRecordId,
        fieldName: "Documents." + fieldName,
        file: file
    });
}

