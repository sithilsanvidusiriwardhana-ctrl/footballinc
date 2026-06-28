// Football Inc. Dashboard Client-Side Logic

const API_BASE = window.location.origin;

// State Management
let currentToken = localStorage.getItem('fb_token') || null;
let currentUser = JSON.parse(localStorage.getItem('fb_user')) || null;
let activeFilename = null;
let activeFileSource = null;
let activeColumns = [];
let tableLimit = 10;
let tableOffset = 0;
let tableTotalRows = 0;
let isFilteredMode = false;
let filteredData = [];

// DOM Elements - Screens
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// DOM Elements - Login
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');

// DOM Elements - Sidebar
const filesList = document.getElementById('files-list');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const dropzone = document.getElementById('dropzone');
const csvFileInput = document.getElementById('csv-file-input');

// DOM Elements - Main Content
const landingView = document.getElementById('landing-view');
const analysisView = document.getElementById('analysis-view');
const activeFileNameDisplay = document.getElementById('active-file-name');
const activeFileSourceDisplay = document.getElementById('active-file-source');
const activeFileRowsDisplay = document.getElementById('active-file-rows');
const activeFileColsDisplay = document.getElementById('active-file-cols');

// DOM Elements - Columns & Stats
const columnsContainer = document.getElementById('columns-container');
const statsPlaceholder = document.getElementById('stats-placeholder');
const statsDataContainer = document.getElementById('stats-data-container');
const statColumnName = document.getElementById('stat-column-name');
const statMean = document.getElementById('stat-mean');
const statMedian = document.getElementById('stat-median');
const statMin = document.getElementById('stat-min');
const statMax = document.getElementById('stat-max');
const statStddev = document.getElementById('stat-stddev');
const statVariance = document.getElementById('stat-variance');
const statCount = document.getElementById('stat-count');
const statMissing = document.getElementById('stat-missing');

// DOM Elements - Filter Tool
const filterForm = document.getElementById('filter-form');
const filterColumn = document.getElementById('filter-column');
const filterOperator = document.getElementById('filter-operator');
const filterValue = document.getElementById('filter-value');
const filterStatusAlert = document.getElementById('filter-status-alert');
const filterMatchCount = document.getElementById('filter-match-count');
const clearFilterBtn = document.getElementById('clear-filter-btn');

// DOM Elements - Table Viewer
const dataTable = document.getElementById('data-table');
const gridRowCounter = document.getElementById('grid-row-counter');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageNumbersContainer = document.getElementById('page-numbers-container');
const paginationWrapper = document.getElementById('pagination-controls-wrapper');

// ================= INITIALIZATION & AUTH =================

document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    setupEventListeners();
});

function checkAuthentication() {
    if (currentToken && currentUser) {
        // Logged in
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        userDisplayName.textContent = currentUser.username;
        showToast(`Welcome back, ${currentUser.username}!`, 'success');
        loadFilesList();
    } else {
        // Not logged in
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
    }
}

function setupEventListeners() {
    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                currentToken = data.token;
                currentUser = data.user;
                localStorage.setItem('fb_token', currentToken);
                localStorage.setItem('fb_user', JSON.stringify(currentUser));
                
                // Clear input
                passwordInput.value = '';
                usernameInput.value = '';
                
                checkAuthentication();
            } else {
                showToast(data.error || "Authentication failed", 'error');
            }
        } catch (err) {
            showToast("Server network connection error", 'error');
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        currentToken = null;
        currentUser = null;
        activeFilename = null;
        localStorage.removeItem('fb_token');
        localStorage.removeItem('fb_user');
        
        // Hide analysis view
        analysisView.classList.replace('active-view', 'inactive-view');
        landingView.classList.replace('inactive-view', 'active-view');
        
        checkAuthentication();
    });

    // Refresh Files List
    refreshFilesBtn.addEventListener('click', loadFilesList);

    // Dropzone Upload Interaction
    dropzone.addEventListener('click', () => csvFileInput.click());
    
    csvFileInput.addEventListener('change', () => {
        if (csvFileInput.files.length > 0) {
            handleFileUpload(csvFileInput.files[0]);
        }
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith('.csv')) {
            handleFileUpload(files[0]);
        } else {
            showToast("Only CSV files are allowed", "error");
        }
    });

    // Filter Form Submit
    filterForm.addEventListener('submit', handleFilterSubmit);

    // Clear Filter Button
    clearFilterBtn.addEventListener('click', clearFilter);

    // Table Pagination clicks
    prevPageBtn.addEventListener('click', () => {
        if (tableOffset > 0) {
            tableOffset -= tableLimit;
            loadTableData();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (tableOffset + tableLimit < tableTotalRows) {
            tableOffset += tableLimit;
            loadTableData();
        }
    });
}

// ================= FILE HANDLERS =================

async function loadFilesList() {
    try {
        filesList.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading files...</div>`;
        const res = await fetch(`${API_BASE}/api/files`);
        if (!res.ok) throw new Error("Failed to load");
        
        const data = await res.json();
        filesList.innerHTML = '';

        if (data.files.length === 0) {
            filesList.innerHTML = `<div class="loading-state">No CSV files found.</div>`;
            return;
        }

        data.files.forEach(file => {
            const li = document.createElement('li');
            li.className = `file-item ${activeFilename === file.name ? 'active' : ''}`;
            
            const isDefault = file.source === 'default';
            const iconClass = isDefault ? 'fa-regular fa-folder-closed' : 'fa-solid fa-cloud-arrow-up';
            const displaySize = (file.size / 1024).toFixed(1) + ' KB';

            li.innerHTML = `
                <div class="file-item-left">
                    <i class="${iconClass} file-item-icon"></i>
                    <div class="file-item-meta">
                        <span class="file-item-name" title="${file.name}">${file.name}</span>
                        <span class="file-item-size">${displaySize} • ${isDefault ? 'System' : 'Uploaded'}</span>
                    </div>
                </div>
            `;

            // Delete button for uploaded files
            if (!isDefault) {
                const delBtn = document.createElement('button');
                delBtn.className = 'file-delete-btn btn-icon';
                delBtn.title = "Delete uploaded file";
                delBtn.innerHTML = `<i class="fa-regular fa-trash-can"></i>`;
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop selection trigger
                    handleDeleteFile(file.name);
                });
                li.appendChild(delBtn);
            }

            li.addEventListener('click', () => selectFile(file));
            filesList.appendChild(li);
        });
    } catch (err) {
        filesList.innerHTML = `<div class="loading-state text-danger">Failed to load files.</div>`;
        showToast("Error retrieving CSV files list", "error");
    }
}

async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('csv', file);

    showToast("Uploading CSV file...", "info");

    try {
        const res = await fetch(`${API_BASE}/api/files/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            showToast("CSV file uploaded successfully!", "success");
            // Set uploaded file as active and reload list
            activeFilename = data.file.name;
            activeFileSource = 'uploaded';
            await loadFilesList();
            
            // Trigger selection
            selectFile({ name: data.file.name, source: 'uploaded' });
        } else {
            showToast(data.error || "File upload failed", "error");
        }
    } catch (err) {
        showToast("Error uploading file to server", "error");
    }
}

async function handleDeleteFile(filename) {
    if (!confirm(`Are you sure you want to delete '${filename}'?`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/files/${filename}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        if (res.ok) {
            showToast("File deleted successfully", "success");
            if (activeFilename === filename) {
                // Return to landing page if active file deleted
                activeFilename = null;
                activeFileSource = null;
                analysisView.classList.replace('active-view', 'inactive-view');
                landingView.classList.replace('inactive-view', 'active-view');
            }
            loadFilesList();
        } else {
            showToast(data.error || "Delete failed", "error");
        }
    } catch (err) {
        showToast("Network error deleting file", "error");
    }
}

// ================= SELECTION & ANALYTICS =================

async function selectFile(file) {
    activeFilename = file.name;
    activeFileSource = file.source;
    isFilteredMode = false;
    filteredData = [];
    tableOffset = 0;

    // Refresh active classes on sidebar
    const fileItems = filesList.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const name = item.querySelector('.file-item-name').textContent;
        if (name === file.name) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Display views
    landingView.classList.replace('active-view', 'inactive-view');
    analysisView.classList.replace('inactive-view', 'active-view');

    // Set header info
    activeFileNameDisplay.textContent = file.name;
    activeFileSourceDisplay.textContent = file.source.toUpperCase();
    if (file.source === 'default') {
        activeFileSourceDisplay.className = 'file-badge';
    } else {
        activeFileSourceDisplay.className = 'file-badge source-uploaded';
    }

    // Hide descriptive stats container initially
    statsDataContainer.classList.remove('active');
    statsPlaceholder.classList.add('active');

    // Clear filters status
    filterStatusAlert.classList.remove('active');
    clearFilterBtn.classList.add('inactive');
    filterForm.reset();

    // Fetch Summary Metadata
    try {
        const res = await fetch(`${API_BASE}/api/files/${activeFilename}/summary`);
        if (!res.ok) throw new Error("Failed to load summary");

        const data = await res.json();
        activeFileRowsDisplay.textContent = data.rowCount;
        activeFileColsDisplay.textContent = data.colCount;
        tableTotalRows = data.rowCount;
        activeColumns = data.columns;

        // Render Columns selection buttons
        renderColumnsSelector();

        // Populate Filter dropdown
        populateFilterColumns();

        // Load Table Data
        loadTableData();

    } catch (err) {
        showToast("Error parsing dataset metadata summary", "error");
    }
}

function renderColumnsSelector() {
    columnsContainer.innerHTML = '';
    activeColumns.forEach(col => {
        const btn = document.createElement('button');
        btn.className = `column-btn ${col.type === 'Numeric' ? 'numeric' : 'string'}`;
        btn.title = col.type === 'Numeric' ? "Click for numeric statistics" : "Non-numeric column";
        
        btn.innerHTML = `
            <span class="col-name">${col.name}</span>
            <span class="col-type-tag">${col.type}</span>
        `;

        if (col.type === 'Numeric') {
            btn.addEventListener('click', () => {
                // Highlight active column button
                columnsContainer.querySelectorAll('.column-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Get statistics
                loadColumnStatistics(col.name);
            });
        }

        columnsContainer.appendChild(btn);
    });
}

function populateFilterColumns() {
    filterColumn.innerHTML = `<option value="" disabled selected>Select column</option>`;
    activeColumns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.name;
        opt.textContent = col.name;
        filterColumn.appendChild(opt);
    });
}

async function loadColumnStatistics(colName) {
    try {
        const res = await fetch(`${API_BASE}/api/files/${activeFilename}/stats/${encodeURIComponent(colName)}`);
        if (!res.ok) throw new Error("Failed to fetch stats");

        const data = await res.json();
        
        if (data.isValid) {
            statColumnName.textContent = colName;
            statMean.textContent = formatNumber(data.mean);
            statMedian.textContent = formatNumber(data.median);
            statMin.textContent = formatNumber(data.min);
            statMax.textContent = formatNumber(data.max);
            statStddev.textContent = formatNumber(data.stddev);
            statVariance.textContent = formatNumber(data.variance);
            statCount.textContent = data.count;
            statMissing.textContent = data.missingCount;

            statsPlaceholder.classList.remove('active');
            statsDataContainer.classList.add('active');
        } else {
            showToast("Selected column has no valid numeric statistics", "error");
        }
    } catch (err) {
        showToast("Error computing column metrics", "error");
    }
}

// ================= DATA TABLE VIEW =================

async function loadTableData() {
    if (isFilteredMode) {
        renderFilteredTable();
        return;
    }

    try {
        const url = `${API_BASE}/api/files/${activeFilename}/data?limit=${tableLimit}&offset=${tableOffset}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch table records");

        const data = await res.json();
        
        renderTableHTML(data.headers, data.data);
        
        // Show paging indices
        const start = tableOffset + 1;
        const end = Math.min(tableOffset + tableLimit, tableTotalRows);
        gridRowCounter.textContent = `Showing ${start}-${end} of ${tableTotalRows} rows`;

        paginationWrapper.style.display = 'flex';
        renderPaginationButtons();

    } catch (err) {
        showToast("Error retrieving data records", "error");
    }
}

function renderTableHTML(headers, rows) {
    // Render Header
    let theadHTML = '<tr>';
    headers.forEach(h => {
        theadHTML += `<th title="${h}">${h}</th>`;
    });
    theadHTML += '</tr>';
    dataTable.querySelector('thead').innerHTML = theadHTML;

    // Render Rows
    let tbodyHTML = '';
    if (rows.length === 0) {
        tbodyHTML = `<tr><td colspan="${headers.length}" style="text-align: center; padding: 30px; color: var(--text-muted);">No records found</td></tr>`;
    } else {
        rows.forEach(row => {
            tbodyHTML += '<tr>';
            headers.forEach(h => {
                const val = row[h];
                if (val === undefined || val === "") {
                    tbodyHTML += `<td class="null-cell">[NULL]</td>`;
                } else {
                    tbodyHTML += `<td title="${val}">${val}</td>`;
                }
            });
            tbodyHTML += '</tr>';
        });
    }
    dataTable.querySelector('tbody').innerHTML = tbodyHTML;
}

function renderPaginationButtons() {
    pageNumbersContainer.innerHTML = '';
    const totalPages = Math.ceil(tableTotalRows / tableLimit);
    const currentPage = Math.floor(tableOffset / tableLimit) + 1;

    // Enable/Disable arrows
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    // Render smart page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.addEventListener('click', () => {
            tableOffset = (p - 1) * tableLimit;
            loadTableData();
        });
        pageNumbersContainer.appendChild(btn);
    }
}

// ================= FILTER HANDLERS =================

async function handleFilterSubmit(e) {
    e.preventDefault();
    const column = filterColumn.value;
    const operator = filterOperator.value;
    const value = filterValue.value;

    if (!column || !operator || value === "") {
        showToast("Please fill in all filter inputs", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/files/${activeFilename}/filter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column, operator, value })
        });

        const data = await res.json();
        if (res.ok) {
            isFilteredMode = true;
            filteredData = data.data;
            tableTotalRows = data.matchCount;
            tableOffset = 0;

            // Update UI feedback
            filterStatusAlert.classList.add('active');
            filterMatchCount.textContent = data.matchCount;
            clearFilterBtn.classList.remove('inactive');

            showToast(`Filter complete. Found ${data.matchCount} records.`, "success");
            loadTableData();
        } else {
            showToast(data.error || "Filtering operation failed", "error");
        }
    } catch (err) {
        showToast("Error processing filter query", "error");
    }
}

function renderFilteredTable() {
    const headers = activeColumns.map(c => c.name);
    
    // Paginate client-side on filtered data
    const start = tableOffset;
    const end = Math.min(tableOffset + tableLimit, filteredData.length);
    const pageData = filteredData.slice(start, end);

    renderTableHTML(headers, pageData);

    // Show paging indices
    const displayStart = filteredData.length > 0 ? start + 1 : 0;
    gridRowCounter.textContent = `Showing ${displayStart}-${end} of ${filteredData.length} filtered rows`;

    // Render pagination controls
    paginationWrapper.style.display = 'flex';
    pageNumbersContainer.innerHTML = '';
    const totalPages = Math.ceil(filteredData.length / tableLimit);
    const currentPage = Math.floor(tableOffset / tableLimit) + 1;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.addEventListener('click', () => {
            tableOffset = (p - 1) * tableLimit;
            renderFilteredTable();
        });
        pageNumbersContainer.appendChild(btn);
    }
}

function clearFilter() {
    isFilteredMode = false;
    filteredData = [];
    tableOffset = 0;
    
    // Reset displays
    filterStatusAlert.classList.remove('active');
    clearFilterBtn.classList.add('inactive');
    filterForm.reset();

    // Restore overall total row count
    activeFileRowsDisplay.textContent = tableTotalRows;
    
    // Reload original rows (will fetch metadata and total count again)
    selectFile({ name: activeFilename, source: activeFileSource });
    showToast("Filter cleared. Loaded full dataset.", "info");
}

// ================= UTILITIES =================

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    // Format double to 4 decimal places, trimming trailing zeros (like standard display)
    const formatted = parseFloat(num.toFixed(4)).toString();
    // Add commas to digits before decimal point
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 50);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}
