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

    // ... (keep all your existing methods)

    // Add these NEW methods for Google Sheets:

    async createGoogleSheet() {
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets?key=${this.GOOGLE_SHEETS_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        title: `Client Manager Pro - ${new Date().toLocaleDateString()}`
                    },
                    sheets: [{
                        properties: {
                            title: "Clients"
                        }
                    }]
                })
            });

            const sheet = await response.json();
            
            if (response.ok) {
                this.SPREADSHEET_ID = sheet.spreadsheetId;
                localStorage.setItem('spreadsheetId', this.SPREADSHEET_ID);
                
                await this.addHeaders();
                
                alert(`✅ Google Sheet Created Successfully!\n\nSheet ID: ${this.SPREADSHEET_ID}\n\nShare this ID with other devices to sync data!`);
                return true;
            } else {
                throw new Error(sheet.error?.message || 'Failed to create sheet');
            }
        } catch (error) {
            alert('❌ Error creating sheet: ' + error.message);
            return false;
        }
    }

    async addHeaders() {
        const headers = [
            'ID', 'Site Visit Date', 'Client Name', 'Contact No', 'Configuration', 
            'Budget', 'Lead Status', 'Prospect', 'Follow Up Date', 'Sourcing Manager',
            'Closing Manager', 'CP Firm Name', 'CP Name', 'CP Contact No', 'Remark',
            'Additional Remarks', 'Date Added', 'Last Modified'
        ];

        try {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/Clients!A1:R1?valueInputOption=RAW&key=${this.GOOGLE_SHEETS_API_KEY}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: [headers]
                })
            });
        } catch (error) {
            console.error('Error adding headers:', error);
        }
    }

    async syncToGoogleSheets() {
        if (!this.SPREADSHEET_ID) {
            const create = confirm('No Google Sheet found. Create a new one?');
            if (create) {
                const created = await this.createGoogleSheet();
                if (!created) return;
            } else {
                return;
            }
        }

        try {
            // Convert clients to rows
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

            // Clear existing data (except headers)
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/Clients!A2:R1000:clear?key=${this.GOOGLE_SHEETS_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            // Add new data if any
            if (rows.length > 0) {
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/Clients!A2:R${rows.length + 1}?valueInputOption=RAW&key=${this.GOOGLE_SHEETS_API_KEY}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        values: rows
                    })
                });

                if (response.ok) {
                    this.showSuccessMessage(`✅ ${this.clients.length} clients synced to Google Sheets!`);
                } else {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'Failed to sync data');
                }
            } else {
                this.showSuccessMessage('✅ Sheet cleared (no clients to sync)');
            }
        } catch (error) {
            alert('❌ Sync error: ' + error.message);
            console.error('Sync error:', error);
        }
    }

    async syncFromGoogleSheets() {
        if (!this.SPREADSHEET_ID) {
            const sheetId = prompt('Enter your Google Sheet ID\n(Found in the URL: docs.google.com/spreadsheets/d/SHEET_ID/edit):');
            if (sheetId) {
                this.SPREADSHEET_ID = sheetId.trim();
                localStorage.setItem('spreadsheetId', this.SPREADSHEET_ID);
            } else {
                return;
            }
        }

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/Clients!A2:R1000?key=${this.GOOGLE_SHEETS_API_KEY}`);
            const data = await response.json();

            if (response.ok) {
                if (data.values && data.values.length > 0) {
                    const clients = data.values.map(row => ({
                        id: row[0] || Date.now().toString() + Math.random(),
                        siteVisitDate: row[1] || '',
                        clientName: row[2] || '',
                        contactNo: row[3] || '',
                        configuration: row[4] || '',
                        budget: row[5] || '',
                        leadStatus: row[6] || '',
                        prospect: row[7] || '',
                        followUpDate: row[8] || '',
                        sourcingManager: row[9] || '',
                        closingManager: row[10] || '',
                        cpFirmName: row[11] || '',
                        cpName: row[12] || '',
                        cpContactNo: row[13] || '',
                        remark: row[14] || '',
                        additionalRemarks: row[15] || '',
                        photo: null, // Photos stored locally
                        dateAdded: row[16] || new Date().toISOString(),
                        lastModified: row[17] || new Date().toISOString()
                    })).filter(client => client.clientName.trim()); // Remove empty rows

                    if (confirm(`📊 Found ${clients.length} clients in Google Sheets.\n\nReplace your local data with cloud data?`)) {
                        this.clients = clients;
                        this.saveToStorage();
                        this.renderClients();
                        this.updateStats();
                        this.showSuccessMessage(`✅ ${clients.length} clients loaded from Google Sheets!`);
                    }
                } else {
                    alert('📝 Google Sheet is empty or has no client data.');
                }
            } else {
                throw new Error(data.error?.message || 'Failed to access Google Sheet');
            }
        } catch (error) {
            alert('❌ Load error: ' + error.message + '\n\nMake sure the Sheet ID is correct and the sheet is accessible.');
            console.error('Load error:', error);
        }
    }

    openGoogleSheet() {
        if (this.SPREADSHEET_ID) {
            window.open(`https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/edit`, '_blank');
        } else {
            alert('❌ No Google Sheet configured yet.\nClick "Sync Up" first to create one!');
        }
    }

    // Update existing finalizeClientSave method to auto-sync
    finalizeClientSave(client) {
        this.clients.push(client);
        this.saveToStorage();
        this.showSuccessMessage('Client saved successfully!');
        
        // Auto-sync to Google Sheets if configured
        if (this.SPREADSHEET_ID && confirm('Auto-sync to Google Sheets?')) {
            setTimeout(() => this.syncToGoogleSheets(), 1000);
        }
        
        this.clearForm();
        this.updateStats();
        
        setTimeout(() => {
            this.showSection('leadBank');
            this.renderClients();
        }, 1500);
    }

    // ... keep all your other existing methods
}
