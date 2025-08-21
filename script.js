class ClientManager {
    constructor() {
        this.clients = JSON.parse(localStorage.getItem('clients')) || [];
        this.dropdownOptions = JSON.parse(localStorage.getItem('dropdownOptions')) || this.getDefaultDropdownOptions();
        this.currentEditId = null;
        this.deferredPrompt = null;
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
    }

    setDefaultSiteVisitDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('siteVisitDate').value = today;
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
            alert('Please fill in all required fields (Site Visit Date, Client Name, Contact Number)');
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
        this.showSuccessMessage('Client saved successfully!');
        this.clearForm();
        this.updateStats();
        
        // Auto-switch to lead bank after saving
        setTimeout(() => {
            this.showSection('leadBank');
            this.renderClients();
        }, 1500);
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
        }, 3000);
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
                            <div>Site Visit: ${client.siteVisitDate ? new Date(client.siteVisitDate).toLocaleDateString() : 'Not set'}</div>
                            <div>Added: ${new Date(client.dateAdded).toLocaleDateString()}</div>
                            ${client.lastModified !== client.dateAdded ? 
                                `<div>Updated: ${new Date(client.lastModified).toLocaleDateString()}</div>` : ''}
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
            this.showSuccessMessage('Remarks updated successfully!');
        }
    }

    markFollowUpDone(clientId) {
        const clientIndex = this.clients.findIndex(c => c.id === clientId);
        if (clientIndex !== -1) {
            const client = this.clients[clientIndex];
            const followUpNote = `Follow-up completed on ${new Date().toLocaleDateString()}`;
            
            this.clients[clientIndex].additionalRemarks = client.additionalRemarks ? 
                `${client.additionalRemarks}\n\n${followUpNote}` : followUpNote;
            this.clients[clientIndex].followUpDate = null; // Remove follow-up date
            this.clients[clientIndex].lastModified = new Date().toISOString();
            
            this.saveToStorage();
            this.renderClients();
            this.updateStats();
            this.showSuccessMessage('Follow-up marked as completed!');
        }
    }

    deleteClient(clientId) {
        if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            this.clients = this.clients.filter(c => c.id !== clientId);
            this.saveToStorage();
            this.renderClients();
            this.updateStats();
            this.showSuccessMessage('Client deleted successfully!');
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
            }, 3000);
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
        const banner = document.getElementById('pwaInstallBanner');
        banner.classList.add('show');
    }

    showIOSInstallBanner() {
        const banner = document.getElementById('pwaInstallBanner');
        const installBtn = document.getElementById('pwaInstallBtn');
        const text = banner.querySelector('.pwa-install-text');
        
        text.innerHTML = `
            <h4>Add to Home Screen</h4>
            <p>Tap <i class="fas fa-share"></i> then "Add to Home Screen"</p>
        `;
        
        installBtn.style.display = 'none';
        banner.classList.add('show');
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
        banner.classList.remove('show');
        
        // Don't show again for 7 days
        localStorage.setItem('pwaInstallDismissed', Date.now() + (7 * 24 * 60 * 60 * 1000));
    }

    // Export/Import functionality
    exportData() {
        const data = {
            clients: this.clients,
            dropdownOptions: this.dropdownOptions,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `client-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showSuccessMessage('Data exported successfully!');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (confirm('This will replace all existing data. Continue?')) {
                    this.clients = importedData.clients || [];
                    this.dropdownOptions = importedData.dropdownOptions || this.getDefaultDropdownOptions();
                    
                    this.saveToStorage();
                    this.saveDropdownOptions();
                    
                    // Reinitialize dropdowns with new data
                    this.initializeSearchableDropdowns();
                    
                    this.renderClients();
                    this.updateStats();
                    this.showSuccessMessage('Data imported successfully!');
                }
            } catch (error) {
                alert('Invalid file format. Please select a valid backup file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    // Utility methods
    formatDate(dateString) {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getStatusColor(status) {
        const colors = {
            'hot': '#ff6b6b',
            'warm': '#feca57',
            'cold': '#74b9ff',
            'qualified': '#00b894',
            'contacted': '#fdcb6e',
            'meeting scheduled': '#6c5ce7',
            'proposal sent': '#a29bfe',
            'negotiation': '#fd79a8',
            'closed won': '#00b894',
            'closed lost': '#636e72'
        };
        return colors[status?.toLowerCase()] || '#ddd';
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
    
    header.appendChild(exportBtn);
    header.appendChild(importInput);
    header.appendChild(importBtn);
}

// Uncomment the line below to add export/import buttons
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
const formInputs = document.querySelectorAll('#clientForm input, #clientForm textarea, #clientForm select');

formInputs.forEach(input => {
    input.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveFormDraft();
        }, 2000); // Save draft after 2 seconds of inactivity
    });
});

function saveFormDraft() {
    const formData = {};
    formInputs.forEach(input => {
        if (input.type !== 'file') {
            formData[input.id] = input.value;
        }
    });
    localStorage.setItem('formDraft', JSON.stringify(formData));
}

function loadFormDraft() {
    const draft = localStorage.getItem('formDraft');
    if (draft) {
        const formData = JSON.parse(draft);
        Object.keys(formData).forEach(id => {
            const element = document.getElementById(id);
            if (element && element.type !== 'file') {
                element.value = formData[id];
            }
        });
    }
}

function clearFormDraft() {
    localStorage.removeItem('formDraft');
}

// Load draft when page loads
window.addEventListener('load', () => {
    // Only load draft if form is empty
    const clientName = document.getElementById('clientName').value;
    if (!clientName) {
        loadFormDraft();
    }
});

// Clear draft when form is successfully submitted
document.getElementById('clientForm').addEventListener('submit', () => {
    clearFormDraft();
});

// Online/Offline status
window.addEventListener('online', () => {
    console.log('App is online');
    // You can show a notification here if needed
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    // You can show a notification here if needed
});
