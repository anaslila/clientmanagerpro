class ClientManager {
    constructor() {
        this.clients = JSON.parse(localStorage.getItem('clients')) || [];
        this.dropdownOptions = JSON.parse(localStorage.getItem('dropdownOptions')) || this.getDefaultDropdownOptions();
        this.currentEditId = null;
        this.deferredPrompt = null;
        
        // Google Sheets Integration
        this.GOOGLE_SHEETS_API_KEY = 'AIzaSyCytLAt1OU1YiDlSxTps0EnzvHRRvGo6g';
        this.SPREADSHEET_ID = localStorage.getItem('spreadsheetId') || '';
        
        this.init();
    }

    getDefaultDropdownOptions() {
        return {
            configuration: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa', 'Duplex', 'Penthouse', 'Studio'],
            budget: ['Under 25 Lakh', '25-50 Lakh', '50-75 Lakh', '75 Lakh - 1 Crore', '1-2 Crore', '2-5 Crore', 'Above 5 Crore'],
            leadStatus: ['Hot', 'Warm', 'Cold', 'Qualified', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'],
            prospect: ['High', 'Medium', 'Low', 'Very High', 'Confirmed'],
            sourcingManager: ['Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Sneha Patel', 'Vikash Gupta'],
            closingManager: ['Rajesh Verma', 'Sunita Jain', 'Manish Agarwal', 'Kavita Mehta', 'Suresh Yadav'],
            cpFirmName: ['PropTech Solutions', 'Real Estate Partners', 'Property Consultants India', 'Elite Realty', 'Prime Properties']
        };
    }

    init() {
        this.bindEvents();
        this.initializeSearchableDropdowns();
        this.showSection('form');
        this.updateStats();
        this.renderClients();
        this.initializePWA();
        this.setDefaultSiteVisitDate();
        this.checkURLForData(); // Check for data in URL
    }

    setDefaultSiteVisitDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('siteVisitDate').value = today;
    }

    // Check for data in URL (for manual sync)
    checkURLForData() {
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        
        if (data) {
            try {
                const parsed = JSON.parse(decodeURIComponent(data));
                if (confirm(`Import ${parsed.clients.length} clients from ${new Date(parsed.timestamp).toLocaleString()}?`)) {
                    this.clients = parsed.clients || [];
                    this.dropdownOptions = parsed.dropdownOptions || this.getDefaultDropdownOptions();
                    this.saveToStorage();
                    this.saveDropdownOptions();
                    this.renderClients();
                    this.updateStats();
                    this.initializeSearchableDropdowns();
                    this.showSuccessMessage('Data imported successfully from URL!');
                }
                // Clear URL
                window.history.replaceState({}, '', window.location.pathname);
            } catch (error) {
                console.error('Invalid data in URL');
            }
        }
    }

    bindEvents() {
        // Navigation
        document.getElementById('newClientBtn').addEventListener('click', () => {
            this.showSection('form');
            this.clearForm();
        });
        
        document.getElementById('viewClientsBtn').addEventListener('click', () => {
            this.showSection('leadBank');
            this.renderClients();
        });

        // Google Sheets sync buttons
        document.getElementById('syncUpBtn').addEventListener('click', () => {
            this.syncToGoogleSheets();
        });

        document.getElementById('syncDownBtn').addEventListener('click', () => {
            this.syncFromGoogleSheets();
        });

        document.getElementById('openSheetBtn').addEventListener('click', () => {
            this.openGoogleSheet();
        });

        // Form submission
        document.getElementById('clientForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveClient();
        });

        // Photo upload
        document.getElementById('clientPhoto').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchClients(e.target.value);
        });

        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('saveRemarks').addEventListener('click', () => {
            this.saveRemarks();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('editModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select')) {
                this.closeAllDropdowns();
            }
        });
    }

    // FIXED Google Sheets Integration Methods
    async createGoogleSheetWithAPIKey() {
        const sheetId = prompt('📋 SETUP INSTRUCTIONS:\n\n1. Go to sheets.google.com\n2. Create a new blank sheet\n3. Click "Share" → Set to "Anyone with link can EDIT"\n4. Copy the Sheet ID from URL\n\nEnter your Google Sheet ID:');
        if (sheetId) {
            this.SPREADSHEET_ID = sheetId.trim();
            localStorage.setItem('spreadsheetId', this.SPREADSHEET_ID);
            
            // Test the connection
            try {
                await this.addHeaders();
                alert('✅ Connected to Google Sheet successfully!\n\nYou can now sync your data!');
                return true;
            } catch (error) {
                alert('❌ Connection failed. Please check:\n1. Sheet ID is correct\n2. Sheet is set to "Anyone with link can EDIT"');
                return false;
            }
        }
        return false;
    }

    async addHeaders() {
        const headers = [
            'ID', 'Site Visit Date', 'Client Name', 'Contact No', 'Configuration', 
            'Budget', 'Lead Status', 'Prospect', 'Follow Up Date', 'Sourcing Manager',
            'Closing Manager', 'CP Firm Name', 'CP Name', 'CP Contact No', 'Remark',
            'Additional Remarks', 'Date Added', 'Last Modified'
        ];

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/A1:R1?valueInputOption=USER_ENTERED&key=${this.GOOGLE_SHEETS_API_KEY}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [headers]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error adding headers:', error);
            throw error;
        }
    }

    // FIXED sync to Google Sheets
    async syncToGoogleSheets() {
        if (!this.SPREADSHEET_ID) {
            const created = await this.createGoogleSheetWithAPIKey();
            if (!created) return;
        }

        try {
            // Show loading message
            this.showSuccessMessage('🔄 Syncing to Google Sheets...');

            // Prepare data rows
            const rows = this.clients.map(client => [
                client.id || '',
                client.siteVisitDate || '',
                client.clientName || '',
                client.contactNo || '',
                client.configuration || '',
                client.budget || '',
                client.leadStatus || '',
                client.prospect || '',
                client.followUpDate || '',
                client.sourcingManager || '',
                client.closingManager || '',
                client.cpFirmName || '',
                client.cpName || '',
                client.cpContactNo || '',
                client.remark || '',
                client.additionalRemarks || '',
                client.dateAdded || '',
                client.lastModified || ''
            ]);

            // Clear existing data first (except headers)
            const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/A2:R1000:clear?key=${this.GOOGLE_SHEETS_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!clearResponse.ok) {
                const error = await clearResponse.json();
                throw new Error(`Clear failed: ${error.error?.message || clearResponse.status}`);
            }

            // Add new data if any exists
            if (rows.length > 0) {
                const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/A2:R${rows.length + 1}?valueInputOption=USER_ENTERED&key=${this.GOOGLE_SHEETS_API_KEY}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: rows
                    })
                });

                if (updateResponse.ok) {
                    this.showSuccessMessage(`✅ ${this.clients.length} clients synced to Google Sheets!`);
                } else {
                    const errorData = await updateResponse.json();
                    throw new Error(`Update failed: ${errorData.error?.message || updateResponse.status}`);
                }
            } else {
                this.showSuccessMessage('✅ Google Sheet cleared (no clients to sync)');
            }
        } catch (error) {
            console.error('Sync error details:', error);
            alert(`❌ Sync Error: ${error.message}\n\n🔧 Troubleshooting:\n1. Check internet connection\n2. Verify Sheet ID is correct\n3. Ensure sheet is set to "Anyone with link can EDIT"\n4. Try refreshing the page`);
        }
    }

    // FIXED sync from Google Sheets  
    async syncFromGoogleSheets() {
        if (!this.SPREADSHEET_ID) {
            const sheetId = prompt('Enter your Google Sheet ID\n(Found in the URL after /d/ and before /edit):');
            if (sheetId) {
                this.SPREADSHEET_ID = sheetId.trim();
                localStorage.setItem('spreadsheetId', this.SPREADSHEET_ID);
            } else {
                return;
            }
        }

        try {
            // Show loading message
            this.showSuccessMessage('🔄 Loading from Google Sheets...');

            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/A2:R1000?key=${this.GOOGLE_SHEETS_API_KEY}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Fetch failed: ${error.error?.message || response.status}`);
            }

            const data = await response.json();

            if (data.values && data.values.length > 0) {
                const clients = data.values.map(row => ({
                    id: row[0] || `${Date.now()}_${Math.random()}`,
                    siteVisitDate: row[1] || '',
                    clientName: row[1] || '',
                    contactNo: row[2] || '',
                    configuration: row[3] || '',
                    budget: row[5] || '',
                    leadStatus: row[4] || '',
                    prospect: row[5] || '',
                    followUpDate: row[8] || '',
                    sourcingManager: row[6] || '',
                    closingManager: row[7] || '',
                    cpFirmName: row[8] || '',
                    cpName: row[9] || '',
                    cpContactNo: row[10] || '',
                    remark: row[14] || '',
                    additionalRemarks: row[11] || '',
                    photo: null,
                    dateAdded: row[16] || new Date().toISOString(),
                    lastModified: row[12] || new Date().toISOString()
                })).filter(client => client.clientName.trim()); // Only non-empty names

                if (confirm(`📊 Found ${clients.length} clients in Google Sheets.\n\nReplace your local data with cloud data?`)) {
                    this.clients = clients;
                    this.saveToStorage();
                    this.renderClients();
                    this.updateStats();
                    this.showSuccessMessage(`✅ ${clients.length} clients loaded from Google Sheets successfully!`);
                }
            } else {
                alert('📝 Google Sheet appears empty.\n\nMake sure:\n1. You have data in rows 2 and below\n2. Headers are in row 1');
            }
        } catch (error) {
            console.error('Load error details:', error);
            alert(`❌ Load Error: ${error.message}\n\n🔧 Troubleshooting:\n1. Check Sheet ID is correct\n2. Set sharing to "Anyone with link can VIEW"\n3. Check internet connection\n4. Make sure sheet has data in rows 2+`);
        }
    }

    openGoogleSheet() {
        if (this.SPREADSHEET_ID) {
            window.open(`https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/edit`, '_blank');
        } else {
            alert('❌ No Google Sheet configured yet.\n\nClick "Sync Up" first to connect to a sheet!');
        }
    }

    // Manual URL-based sync (backup method)
    createSyncURL() {
        const data = {
            clients: this.clients,
            dropdownOptions: this.dropdownOptions,
            timestamp: new Date().toISOString()
        };
        
        const encodedData = encodeURIComponent(JSON.stringify(data));
        const syncURL = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
        
        // Create modal to show URL
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-link"></i> Manual Sync URL</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Copy this URL and open it on another device:</strong></p>
                    <textarea readonly style="width: 100%; height: 100px; font-size: 12px; margin: 10px 0;">${syncURL}</textarea>
                    <div style="text-align: center; margin-top: 15px;">
                        <button onclick="navigator.clipboard.writeText('${syncURL}'); alert('URL copied to clipboard!'); this.closest('.modal').remove();" class="btn-primary">
                            <i class="fas fa-copy"></i> Copy URL
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Searchable Dropdown Methods
    initializeSearchableDropdowns() {
        const searchableSelects = document.querySelectorAll('.searchable-select');
        
        searchableSelects.forEach(select => {
            const input = select.querySelector('input');
            const dropdown = select.querySelector('.dropdown-options');
            const field = select.dataset.field;
            
            // Update dropdown options from stored data
            if (field && this.dropdownOptions[field]) {
                this.updateDropdownOptions(field, dropdown);
            }

            // Input events
            input.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(select);
            });

            input.addEventListener('input', (e) => {
                this.filterDropdownOptions(select, e.target.value);
            });

            input.addEventListener('keydown', (e) => {
                this.handleDropdownKeydown(e, select);
            });

            // Dropdown option clicks
            dropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('dropdown-option')) {
                    this.selectDropdownOption(select, e.target);
                }
            });
        });
    }

    updateDropdownOptions(field, dropdown) {
        const options = this.dropdownOptions[field];
        dropdown.innerHTML = options.map(option => 
            `<div class="dropdown-option" data-value="${option}">${option}</div>`
        ).join('');
    }

    toggleDropdown(select) {
        this.closeAllDropdowns();
        const dropdown = select.querySelector('.dropdown-options');
        const input = select.querySelector('input');
        
        select.classList.add('open');
        dropdown.classList.add('show');
        
        // Focus input for typing
        input.focus();
        
        // Show all options initially
        this.filterDropdownOptions(select, '');
    }

    closeAllDropdowns() {
        document.querySelectorAll('.searchable-select').forEach(select => {
            select.classList.remove('open');
            select.querySelector('.dropdown-options').classList.remove('show');
        });
    }

    filterDropdownOptions(select, query) {
        const dropdown = select.querySelector('.dropdown-options');
        const field = select.dataset.field;
        const options = this.dropdownOptions[field] || [];
        
        const filteredOptions = options.filter(option => 
            option.toLowerCase().includes(query.toLowerCase())
        );
        
        let html = filteredOptions.map(option => 
            `<div class="dropdown-option" data-value="${option}">${option}</div>`
        ).join('');
        
        // Add "Add new" option if query doesn't match any existing option
        if (query.trim() && !options.some(option => 
            option.toLowerCase() === query.toLowerCase()
        )) {
            html += `<div class="dropdown-option add-new" data-value="${query.trim()}">
                <i class="fas fa-plus"></i> Add "${query.trim()}"
            </div>`;
        }
        
        dropdown.innerHTML = html;
    }

    selectDropdownOption(select, option) {
        const input = select.querySelector('input');
        const value = option.dataset.value;
        const field = select.dataset.field;
        
        input.value = value;
        
        // If it's a new option, add it to the stored options
        if (option.classList.contains('add-new')) {
            this.addNewDropdownOption(field, value);
        }
        
        this.closeAllDropdowns();
        input.blur();
    }

    addNewDropdownOption(field, value) {
        if (!this.dropdownOptions[field]) {
            this.dropdownOptions[field] = [];
        }
        
        if (!this.dropdownOptions[field].includes(value)) {
            this.dropdownOptions[field].push(value);
            this.saveDropdownOptions();
        }
    }

    saveDropdownOptions() {
        localStorage.setItem('dropdownOptions', JSON.stringify(this.dropdownOptions));
    }

    handleDropdownKeydown(e, select) {
        const dropdown = select.querySelector('.dropdown-options');
        const options = dropdown.querySelectorAll('.dropdown-option');
        let selectedIndex = Array.from(options).findIndex(opt => opt.classList.contains('selected'));
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
                this.highlightOption(options, selectedIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.highlightOption(options, selectedIndex);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && options[selectedIndex]) {
                    this.selectDropdownOption(select, options[selectedIndex]);
                }
                break;
                
            case 'Escape':
                this.closeAllDropdowns();
                break;
        }
    }

    highlightOption(options, index) {
        options.forEach((opt, i) => {
            opt.classList.toggle('selected', i === index);
        });
    }

    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        if (sectionName === 'form') {
            document.getElementById('formSection').classList.add('active');
        } else if (sectionName === 'leadBank') {
            document.getElementById('leadBankSection').classList.add('active');
        }
    }

    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Please select an image smaller than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('photoPreview');
            preview.innerHTML = `
                <div class="photo-preview">
                    <img src="${e.target.result}" alt="Client Photo">
                </div>
            `;
        };
        reader.readAsDataURL(file);
    }

    saveClient() {
        const photoFile = document.getElementById('clientPhoto').files[0];
        
        const client = {
            id: Date.now().toString(),
            siteVisitDate: document.getElementById('siteVisitDate').value,
            clientName: document.getElementById('clientName').value.trim(),
            contactNo: document.getElementById('contactNo').value.trim(),
            configuration: document.getElementById('configuration').value.trim(),
            budget: document.getElementById('budget').value.trim(),
            leadStatus: document.getElementById('leadStatus').value.trim(),
            prospect: document.getElementById('prospect').value.trim(),
            followUpDate: document.getElementById('followUpDate').value,
            sourcingManager: document.getElementById('sourcingManager').value.trim(),
            closingManager: document.getElementById('closingManager').value.trim(),
            cpFirmName: document.getElementById('cpFirmName').value.trim(),
            cpName: document.getElementById('cpName').value.trim(),
            cpContactNo: document.getElementById('cpContactNo').value.trim(),
            remark: document.getElementById('remark').value.trim(),
            photo: null,
            additionalRemarks: '',
            dateAdded: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        // Validate required fields
        if (!client.siteVisitDate || !client.clientName || !client.contactNo) {
            alert('Please fill in all required fields:\n• Site Visit Date\n• Client Name\n• Contact Number');
            return;
        }

        // Handle photo
        if (photoFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                client.photo = e.target.result;
                this.finalizeClientSave(client);
            };
            reader.readAsDataURL(photoFile);
        } else {
            this.finalizeClientSave(client);
        }
    }

    finalizeClientSave(client) {
        this.clients.push(client);
        this.saveToStorage();
        this.showSuccessMessage('✅ Client saved successfully!');
        
        // Auto-sync to Google Sheets if configured
        if (this.SPREADSHEET_ID) {
            setTimeout(() => {
                if (confirm('🔄 Auto-sync to Google Sheets?\n\n(Recommended to keep data updated across devices)')) {
                    this.syncToGoogleSheets();
                }
            }, 1500);
        }
        
        this.clearForm();
        this.updateStats();
        
        setTimeout(() => {
            this.showSection('leadBank');
            this.renderClients();
        }, 2000);
    }

    clearForm() {
        document.getElementById('clientForm').reset();
        document.getElementById('photoPreview').innerHTML = '';
        this.removeSuccessMessage();
        this.setDefaultSiteVisitDate();
    }

    showSuccessMessage(message) {
        this.removeSuccessMessage();
        
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        
        const form = document.querySelector('#formSection .card');
        form.insertBefore(successDiv, form.firstChild);
        
        setTimeout(() => {
            this.removeSuccessMessage();
        }, 4000);
    }

    removeSuccessMessage() {
        const existing = document.querySelector('.success-message');
        if (existing) {
            existing.remove();
        }
    }

    updateStats() {
        const today = new Date().toDateString();
        const todayClients = this.clients.filter(client => 
            new Date(client.dateAdded).toDateString() === today
        ).length;

        const hotLeads = this.clients.filter(client => 
            client.leadStatus && client.leadStatus.toLowerCase() === 'hot'
        ).length;

        const followUpsToday = this.clients.filter(client => {
            if (!client.followUpDate) return false;
            return new Date(client.followUpDate).toDateString() === today;
        }).length;

        document.getElementById('totalClients').textContent = this.clients.length;
        document.getElementById('todayClients').textContent = todayClients;
        document.getElementById('hotLeads').textContent = hotLeads;
        document.getElementById('followUpsToday').textContent = followUpsToday;
    }

    renderClients(clientsToRender = this.clients) {
        const container = document.getElementById('clientsList');
        const noDataDiv = document.getElementById('noClients');

        if (clientsToRender.length === 0) {
            noDataDiv.style.display = 'block';
            container.innerHTML = '';
            container.appendChild(noDataDiv);
            return;
        }

        noDataDiv.style.display = 'none';
        
        // Sort clients by most recent first
        const sortedClients = [...clientsToRender].sort((a, b) => 
            new Date(b.dateAdded) - new Date(a.dateAdded)
        );

        container.innerHTML = sortedClients.map(client => `
            <div class="client-card" data-id="${client.id}">
                <div class="client-header">
                    <div class="client-info">
                        <h3>${client.clientName}</h3>
                        <div class="client-meta">
                            <div>📅 Site Visit: ${client.siteVisitDate ? new Date(client.siteVisitDate).toLocaleDateString() : 'Not set'}</div>
                            <div>➕ Added: ${new Date(client.dateAdded).toLocaleDateString()}</div>
                            ${client.lastModified !== client.dateAdded ? 
                                `<div>✏️ Updated: ${new Date(client.lastModified).toLocaleDateString()}</div>` : ''}
                        </div>
                    </div>
                    ${client.photo ? `<img src="${client.photo}" alt="${client.clientName}" class="client-photo">` : ''}
                </div>
                
                <div class="client-details">
                    ${client.contactNo ? `<div class="detail-item"><i class="fas fa-phone"></i> <strong>Contact:</strong> ${client.contactNo}</div>` : ''}
                    ${client.configuration ? `<div class="detail-item"><i class="fas fa-home"></i> <strong>Config:</strong> ${client.configuration}</div>` : ''}
                    ${client.budget ? `<div class="detail-item"><i class="fas fa-rupee-sign"></i> <strong>Budget:</strong> ${client.budget}</div>` : ''}
                    ${client.leadStatus ? `<div class="detail-item"><i class="fas fa-thermometer-half"></i> <strong>Status:</strong> <span class="client-status status-${client.leadStatus.toLowerCase()}">${client.leadStatus}</span></div>` : ''}
                    ${client.prospect ? `<div class="detail-item"><i class="fas fa-star"></i> <strong>Prospect:</strong> ${client.prospect}</div>` : ''}
                    ${client.followUpDate ? `<div class="detail-item"><i class="fas fa-calendar-alt"></i> <strong>Follow-up:</strong> ${new Date(client.followUpDate).toLocaleDateString()}</div>` : ''}
                    ${client.sourcingManager ? `<div class="detail-item"><i class="fas fa-user-tie"></i> <strong>Sourcing:</strong> ${client.sourcingManager}</div>` : ''}
                    ${client.closingManager ? `<div class="detail-item"><i class="fas fa-handshake"></i> <strong>Closing:</strong> ${client.closingManager}</div>` : ''}
                    ${client.cpFirmName ? `<div class="detail-item"><i class="fas fa-building"></i> <strong>CP Firm:</strong> ${client.cpFirmName}</div>` : ''}
                    ${client.cpName ? `<div class="detail-item"><i class="fas fa-user"></i> <strong>CP Contact:</strong> ${client.cpName}</div>` : ''}
                    ${client.cpContactNo ? `<div class="detail-item"><i class="fas fa-phone-alt"></i> <strong>CP Phone:</strong> ${client.cpContactNo}</div>` : ''}
                </div>
                
                ${client.remark ? `<div style="margin-bottom: 15px; padding: 12px; background: #e6f3ff; border-radius: 8px; color: #2563eb; border-left: 4px solid #3b82f6;"><strong><i class="fas fa-comment"></i> Initial Remark:</strong><br>${client.remark}</div>` : ''}
                
                ${client.additionalRemarks ? `<div style="margin-bottom: 15px; padding: 12px; background: #f0fdf4; border-radius: 8px; color: #166534; border-left: 4px solid #22c55e;"><strong><i class="fas fa-edit"></i> Additional Remarks:</strong><br>${client.additionalRemarks}</div>` : ''}
                
                <div class="client-actions">
                    <button onclick="clientManager.editClient('${client.id}')" class="btn-primary btn-small">
                        <i class="fas fa-edit"></i> Edit Remarks
                    </button>
                    <button onclick="clientManager.deleteClient('${client.id}')" class="btn-secondary btn-small">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ${client.followUpDate ? `<button onclick="clientManager.markFollowUpDone('${client.id}')" class="btn-primary btn-small">
                        <i class="fas fa-check"></i> Follow-up Done
                    </button>` : ''}
                </div>
            </div>
        `).join('');
    }

    searchClients(query) {
        if (!query.trim()) {
            this.renderClients();
            return;
        }

        const filtered = this.clients.filter(client => {
            const searchString = [
                client.clientName,
                client.contactNo,
                client.configuration,
                client.budget,
                client.leadStatus,
                client.prospect,
                client.sourcingManager,
                client.closingManager,
                client.cpFirmName,
                client.cpName,
                client.cpContactNo,
                client.remark,
                client.additionalRemarks
            ].join(' ').toLowerCase();
            
            return searchString.includes(query.toLowerCase());
        });

        this.renderClients(filtered);
    }

    editClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) return;

        this.currentEditId = clientId;
        document.getElementById('editRemarks').value = client.additionalRemarks || '';
        document.getElementById('editModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditId = null;
        document.getElementById('editRemarks').value = '';
    }

    saveRemarks() {
        if (!this.currentEditId) return;

        const remarks = document.getElementById('editRemarks').value.trim();
        const clientIndex = this.clients.findIndex(c => c.id === this.currentEditId);
        
        if (clientIndex !== -1) {
            this.clients[clientIndex].additionalRemarks = remarks;
            this.clients[clientIndex].lastModified = new Date().toISOString();
            this.saveToStorage();
            this.renderClients();
            this.closeModal();
            this.showSuccessMessage('✅ Remarks updated successfully!');
        }
    }

    markFollowUpDone(clientId) {
        const clientIndex = this.clients.findIndex(c => c.id === clientId);
        if (clientIndex !== -1) {
            const client = this.clients[clientIndex];
            const followUpNote = `✅ Follow-up completed on ${new Date().toLocaleDateString()}`;
            
            this.clients[clientIndex].additionalRemarks = client.additionalRemarks ? 
                `${client.additionalRemarks}\n\n${followUpNote}` : followUpNote;
            this.clients[clientIndex].followUpDate = null; // Remove follow-up date
            this.clients[clientIndex].lastModified = new Date().toISOString();
            
            this.saveToStorage();
            this.renderClients();
            this.updateStats();
            this.showSuccessMessage('✅ Follow-up marked as completed!');
        }
    }

    deleteClient(clientId) {
        if (confirm('⚠️ Are you sure you want to delete this client?\n\nThis action cannot be undone.')) {
            this.clients = this.clients.filter(c => c.id !== clientId);
            this.saveToStorage();
            this.renderClients();
            this.updateStats();
            this.showSuccessMessage('✅ Client deleted successfully!');
        }
    }

    saveToStorage() {
        localStorage.setItem('clients', JSON.stringify(this.clients));
    }

    // PWA Functionality
    initializePWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner();
        });

        // Handle iOS add to home screen
        if (this.isIOS() && !this.isInStandaloneMode()) {
            setTimeout(() => {
                this.showIOSInstallBanner();
            }, 5000);
        }

        // PWA install banner events
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaDismissBtn');

        if (installBtn) {
            installBtn.addEventListener('click', () => {
                this.installPWA();
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.dismissInstallBanner();
            });
        }
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    isInStandaloneMode() {
        return (window.navigator.standalone) || (window.matchMedia('(display-mode: standalone)').matches);
    }

    showInstallBanner() {
        const dismissed = localStorage.getItem('pwaInstallDismissed');
        if (dismissed && Date.now() < parseInt(dismissed)) {
            return; // Don't show if recently dismissed
        }
        
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) {
            banner.classList.add('show');
        }
    }

    showIOSInstallBanner() {
        const dismissed = localStorage.getItem('pwaInstallDismissed');
        if (dismissed && Date.now() < parseInt(dismissed)) {
            return; // Don't show if recently dismissed
        }
        
        const banner = document.getElementById('pwaInstallBanner');
        const installBtn = document.getElementById('pwaInstallBtn');
        const text = banner.querySelector('.pwa-install-text');
        
        if (banner && text) {
            text.innerHTML = `
                <h4>📱 Add to Home Screen</h4>
                <p>Tap <i class="fas fa-share"></i> then "Add to Home Screen"</p>
            `;
            
            if (installBtn) {
                installBtn.style.display = 'none';
            }
            banner.classList.add('show');
        }
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const choiceResult = await this.deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.dismissInstallBanner();
        }
    }

    dismissInstallBanner() {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) {
            banner.classList.remove('show');
        }
        
        // Don't show again for 7 days
        localStorage.setItem('pwaInstallDismissed', Date.now() + (7 * 24 * 60 * 60 * 1000));
    }

    // Export/Import functionality
    exportData() {
        const data = {
            clients: this.clients,
            dropdownOptions: this.dropdownOptions,
            spreadsheetId: this.SPREADSHEET_ID,
            exportDate: new Date().toISOString(),
            version: "2.0"
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `client-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showSuccessMessage('✅ Data exported successfully!');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (confirm(`📊 Import ${importedData.clients?.length || 0} clients?\n\nThis will replace all existing data.`)) {
                    this.clients = importedData.clients || [];
                    this.dropdownOptions = importedData.dropdownOptions || this.getDefaultDropdownOptions();
                    
                    if (importedData.spreadsheetId) {
                        this.SPREADSHEET_ID = importedData.spreadsheetId;
                        localStorage.setItem('spreadsheetId', this.SPREADSHEET_ID);
                    }
                    
                    this.saveToStorage();
                    this.saveDropdownOptions();
                    
                    // Reinitialize dropdowns with new data
                    this.initializeSearchableDropdowns();
                    
                    this.renderClients();
                    this.updateStats();
                    this.showSuccessMessage('✅ Data imported successfully!');
                }
            } catch (error) {
                alert('❌ Invalid file format. Please select a valid backup file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
}

// Initialize the app
const clientManager = new ClientManager();

// Add export/import functionality
function addExportImportButtons() {
    const header = document.querySelector('.header-buttons');
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-secondary';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
    exportBtn.onclick = () => clientManager.exportData();
    
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.onchange = (e) => clientManager.importData(e);
    
    const importBtn = document.createElement('button');
    importBtn.className = 'btn-secondary';
    importBtn.innerHTML = '<i class="fas fa-upload"></i> Import';
    importBtn.onclick = () => importInput.click();
    
    const syncURLBtn = document.createElement('button');
    syncURLBtn.className = 'btn-secondary';
    syncURLBtn.innerHTML = '<i class="fas fa-link"></i> Manual Sync';
    syncURLBtn.onclick = () => clientManager.createSyncURL();
    
    header.appendChild(exportBtn);
    header.appendChild(importInput);
    header.appendChild(importBtn);
    header.appendChild(syncURLBtn);
}

// Uncomment to add extra buttons
// addExportImportButtons();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N = New Client
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('newClientBtn').click();
    }
    
    // Ctrl/Cmd + L = Lead Bank
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        document.getElementById('viewClientsBtn').click();
    }
    
    // Ctrl/Cmd + S = Save (when in form)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (document.getElementById('formSection').classList.contains('active')) {
            document.getElementById('clientForm').dispatchEvent(new Event('submit'));
        }
    }
    
    // Ctrl/Cmd + U = Sync Up
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        clientManager.syncToGoogleSheets();
    }
    
    // Ctrl/Cmd + D = Sync Down
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        clientManager.syncFromGoogleSheets();
    }
    
    // Escape = Close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('editModal');
        if (modal.style.display === 'block') {
            clientManager.closeModal();
        }
    }
});

// Auto-save form data as user types (draft functionality)
let autoSaveTimeout;

window.addEventListener('load', () => {
    const formInputs = document.querySelectorAll('#clientForm input, #clientForm textarea');
    
    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                saveFormDraft();
            }, 3000); // Save draft after 3 seconds of inactivity
        });
    });

    // Load draft when page loads
    const clientName = document.getElementById('clientName');
    if (clientName && !clientName.value) {
        loadFormDraft();
    }
});

function saveFormDraft() {
    const formData = {};
    const formInputs = document.querySelectorAll('#clientForm input, #clientForm textarea');
    
    formInputs.forEach(input => {
        if (input.type !== 'file' && input.id) {
            formData[input.id] = input.value;
        }
    });
    
    localStorage.setItem('formDraft', JSON.stringify(formData));
}

function loadFormDraft() {
    const draft = localStorage.getItem('formDraft');
    if (draft) {
        try {
            const formData = JSON.parse(draft);
            Object.keys(formData).forEach(id => {
                const element = document.getElementById(id);
                if (element && element.type !== 'file') {
                    element.value = formData[id];
                }
            });
        } catch (error) {
            console.error('Error loading form draft:', error);
        }
    }
}

function clearFormDraft() {
    localStorage.removeItem('formDraft');
}

// Clear draft when form is successfully submitted
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('clientForm');
    if (form) {
        form.addEventListener('submit', () => {
            clearFormDraft();
        });
    }
});

// Online/Offline status
window.addEventListener('online', () => {
    console.log('📶 App is online');
    document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
    console.log('📵 App is offline');
    document.body.classList.add('offline');
});

// Log app initialization
console.log('🚀 Client Manager Pro initialized successfully!');
console.log('📋 Available keyboard shortcuts:');
console.log('  • Ctrl+N: New Client');
console.log('  • Ctrl+L: Lead Bank');
console.log('  • Ctrl+S: Save Form');
console.log('  • Ctrl+U: Sync Up');
console.log('  • Ctrl+D: Sync Down');
console.log('  • Escape: Close Modal');
