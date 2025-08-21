class ClientManager {
    constructor() {
        this.clients = JSON.parse(localStorage.getItem('clients')) || [];
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.showSection('form');
        this.updateStats();
        this.renderClients();
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
        const formData = new FormData(document.getElementById('clientForm'));
        const photoFile = document.getElementById('clientPhoto').files[0];
        
        const client = {
            id: Date.now().toString(),
            name: document.getElementById('clientName').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            email: document.getElementById('clientEmail').value.trim(),
            company: document.getElementById('clientCompany').value.trim(),
            service: document.getElementById('clientService').value,
            budget: document.getElementById('clientBudget').value,
            notes: document.getElementById('clientNotes').value.trim(),
            photo: null,
            remarks: '',
            dateAdded: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

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

        document.getElementById('totalClients').textContent = this.clients.length;
        document.getElementById('todayClients').textContent = todayClients;
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
        
        container.innerHTML = clientsToRender.map(client => `
            <div class="client-card" data-id="${client.id}">
                <div class="client-header">
                    <div class="client-info">
                        <h3>${client.name}</h3>
                        <div class="client-meta">
                            Added on ${new Date(client.dateAdded).toLocaleDateString()}
                            ${client.lastModified !== client.dateAdded ? 
                                `• Updated ${new Date(client.lastModified).toLocaleDateString()}` : ''}
                        </div>
                    </div>
                    ${client.photo ? `<img src="${client.photo}" alt="${client.name}" class="client-photo">` : ''}
                </div>
                
                <div class="client-details">
                    ${client.phone ? `<div class="detail-item"><i class="fas fa-phone"></i> ${client.phone}</div>` : ''}
                    ${client.email ? `<div class="detail-item"><i class="fas fa-envelope"></i> ${client.email}</div>` : ''}
                    ${client.company ? `<div class="detail-item"><i class="fas fa-building"></i> ${client.company}</div>` : ''}
                    ${client.service ? `<div class="detail-item"><i class="fas fa-cogs"></i> ${this.getServiceLabel(client.service)}</div>` : ''}
                    ${client.budget ? `<div class="detail-item"><i class="fas fa-dollar-sign"></i> ${this.getBudgetLabel(client.budget)}</div>` : ''}
                </div>
                
                ${client.notes ? `<div style="margin-bottom: 15px; padding: 10px; background: #e2e8f0; border-radius: 8px; color: #4a5568;"><strong>Notes:</strong> ${client.notes}</div>` : ''}
                
                ${client.remarks ? `<div style="margin-bottom: 15px; padding: 10px; background: #bee3f8; border-radius: 8px; color: #2b6cb0;"><strong>Remarks:</strong> ${client.remarks}</div>` : ''}
                
                <div class="client-actions">
                    <button onclick="clientManager.editClient('${client.id}')" class="btn-primary btn-small">
                        <i class="fas fa-edit"></i> Edit Remarks
                    </button>
                    <button onclick="clientManager.deleteClient('${client.id}')" class="btn-secondary btn-small">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    getServiceLabel(service) {
        const labels = {
            'consultation': 'Consultation',
            'development': 'Development',
            'maintenance': 'Maintenance',
            'support': 'Support',
            'other': 'Other'
        };
        return labels[service] || service;
    }

    getBudgetLabel(budget) {
        const labels = {
            'under-5k': 'Under $5,000',
            '5k-10k': '$5,000 - $10,000',
            '10k-25k': '$10,000 - $25,000',
            '25k-50k': '$25,000 - $50,000',
            'over-50k': 'Over $50,000'
        };
        return labels[budget] || budget;
    }

    searchClients(query) {
        if (!query.trim()) {
            this.renderClients();
            return;
        }

        const filtered = this.clients.filter(client => 
            client.name.toLowerCase().includes(query.toLowerCase()) ||
            client.phone.includes(query) ||
            client.email.toLowerCase().includes(query.toLowerCase()) ||
            client.company.toLowerCase().includes(query.toLowerCase()) ||
            client.notes.toLowerCase().includes(query.toLowerCase()) ||
            client.remarks.toLowerCase().includes(query.toLowerCase())
        );

        this.renderClients(filtered);
    }

    editClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) return;

        this.currentEditId = clientId;
        document.getElementById('editRemarks').value = client.remarks || '';
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
            this.clients[clientIndex].remarks = remarks;
            this.clients[clientIndex].lastModified = new Date().toISOString();
            this.saveToStorage();
            this.renderClients();
            this.closeModal();
        }
    }

    deleteClient(clientId) {
        if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            this.clients = this.clients.filter(c => c.id !== clientId);
            this.saveToStorage();
            this.renderClients();
            this.updateStats();
        }
    }

    saveToStorage() {
        localStorage.setItem('clients', JSON.stringify(this.clients));
    }

    // Export data for backup
    exportData() {
        const dataStr = JSON.stringify(this.clients, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `clients-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Import data from backup
    importData(event) {
        const file = event.target.files;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedClients = JSON.parse(e.target.result);
                if (confirm('This will replace all existing data. Continue?')) {
                    this.clients = importedClients;
                    this.saveToStorage();
                    this.renderClients();
                    this.updateStats();
                    alert('Data imported successfully!');
                }
            } catch (error) {
                alert('Invalid file format. Please select a valid backup file.');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize the app
const clientManager = new ClientManager();

// Add export/import buttons (you can add these to your HTML header if needed)
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

// Call this if you want export/import functionality
// addExportImportButtons();

// Service worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}
