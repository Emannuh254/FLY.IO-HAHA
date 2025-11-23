// admin.js - Optimized for mobile and performance
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        loginForm: document.getElementById('loginForm'),
        adminDashboard: document.getElementById('adminDashboard'),
        adminLoginForm: document.getElementById('adminLoginForm'),
        testConnectionBtn: document.getElementById('testConnectionBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        serverUrl: document.getElementById('serverUrl'),
        notification: document.getElementById('notification'),
        
        // Stats
        totalUsers: document.getElementById('totalUsers'),
        totalTransactions: document.getElementById('totalTransactions'),
        pendingTransactions: document.getElementById('pendingTransactions'),
        totalVolume: document.getElementById('totalVolume'),
        
        // Quick Actions
        depositToUserBtn: document.getElementById('depositToUserBtn'),
        manageBotsBtn: document.getElementById('manageBotsBtn'),
        refreshDataBtn: document.getElementById('refreshDataBtn'),
        manageDepositAddressBtn: document.getElementById('manageDepositAddressBtn'),
        
        // Transactions
        transactionsTable: document.getElementById('transactionsTable'),
        
        // Users
        usersTable: document.getElementById('usersTable'),
        userSearch: document.getElementById('userSearch'),
        searchUserBtn: document.getElementById('searchUserBtn'),
        
        // Modals
        depositModal: document.getElementById('depositModal'),
        botsModal: document.getElementById('botsModal'),
        depositAddressModal: document.getElementById('depositAddressModal'),
        
        // Forms
        depositForm: document.getElementById('depositForm'),
        botsForm: document.getElementById('botsForm'),
        depositAddressForm: document.getElementById('depositAddressForm'),
        
        // Modal Controls
        cancelDeposit: document.getElementById('cancelDeposit'),
        cancelBots: document.getElementById('cancelBots'),
        cancelBotForm: document.getElementById('cancelBotForm'),
        createBotBtn: document.getElementById('createBotBtn'),
        cancelDepositAddress: document.getElementById('cancelDepositAddress')
    };
    
    // API Configuration
    const API_BASE = 'https://fly-io-haha.onrender.com/';
    let authToken = localStorage.getItem('adminAuthToken');
    
    // Initialize
    function init() {
        // Check if already logged in
        if (authToken) {
            showDashboard();
            loadDashboardData();
        }
        
        // Set up event listeners
        setupEventListeners();
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Login form
        elements.adminLoginForm.addEventListener('submit', handleLogin);
        
        // Test connection
        elements.testConnectionBtn.addEventListener('click', testConnection);
        
        // Logout
        elements.logoutBtn.addEventListener('click', logout);
        
        // Quick actions
        elements.depositToUserBtn.addEventListener('click', () => showModal('depositModal'));
        elements.manageBotsBtn.addEventListener('click', () => {
            showModal('botsModal');
            loadBots();
        });
        elements.refreshDataBtn.addEventListener('click', loadDashboardData);
        elements.manageDepositAddressBtn.addEventListener('click', () => showModal('depositAddressModal'));
        
        // User search
        elements.searchUserBtn.addEventListener('click', searchUsers);
        elements.userSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchUsers();
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => filterTransactions(btn.dataset.filter));
        });
        
        // Modal controls
        elements.cancelDeposit.addEventListener('click', () => hideModal('depositModal'));
        elements.cancelBots.addEventListener('click', () => hideModal('botsModal'));
        elements.cancelBotForm.addEventListener('click', () => {
            elements.botsForm.classList.add('hidden');
        });
        elements.createBotBtn.addEventListener('click', () => {
            elements.botsForm.classList.remove('hidden');
        });
        elements.cancelDepositAddress.addEventListener('click', () => hideModal('depositAddressModal'));
        
        // Form submissions
        elements.depositForm.addEventListener('submit', handleDeposit);
        elements.botsForm.addEventListener('submit', handleCreateBot);
        elements.depositAddressForm.addEventListener('submit', handleUpdateDepositAddress);
    }
    
    // Handle login
    async function handleLogin(e) {
        e.preventDefault();
        
        const username = elements.adminLoginForm.username.value;
        const password = elements.adminLoginForm.password.value;
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                authToken = data.token;
                localStorage.setItem('adminAuthToken', authToken);
                showNotification('Login successful!', 'success');
                showDashboard();
                loadDashboardData();
            } else {
                showNotification(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    }
    
    // Test server connection
    async function testConnection() {
        try {
            const response = await fetch(`${API_BASE}/api/admin/test`);
            
            if (response.ok) {
                showNotification('Server connection successful!', 'success');
            } else {
                showNotification('Server connection failed', 'error');
            }
        } catch (error) {
            console.error('Connection test error:', error);
            showNotification('Unable to connect to server', 'error');
        }
    }
    
    // Logout
    function logout() {
        localStorage.removeItem('adminAuthToken');
        authToken = null;
        elements.loginForm.classList.remove('hidden');
        elements.adminDashboard.classList.add('hidden');
        showNotification('Logged out successfully', 'success');
    }
    
    // Show dashboard
    function showDashboard() {
        elements.loginForm.classList.add('hidden');
        elements.adminDashboard.classList.remove('hidden');
    }
    
    // Load dashboard data
    async function loadDashboardData() {
        try {
            // Load stats
            const statsResponse = await apiRequest('/api/admin/stats');
            if (statsResponse) {
                const stats = await statsResponse.json();
                elements.totalUsers.textContent = stats.totalUsers || 0;
                elements.totalTransactions.textContent = stats.totalTransactions || 0;
                elements.pendingTransactions.textContent = stats.pendingTransactions || 0;
                elements.totalVolume.textContent = `$${stats.totalVolume || 0}`;
            }
            
            // Load transactions
            loadTransactions();
            
            // Load users
            loadUsers();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showNotification('Failed to load dashboard data', 'error');
        }
    }
    
    // Load transactions
    async function loadTransactions() {
        try {
            const response = await apiRequest('/api/admin/transactions');
            if (response) {
                const transactions = await response.json();
                renderTransactions(transactions);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            elements.transactionsTable.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load transactions</td></tr>';
        }
    }
    
    // Render transactions
    function renderTransactions(transactions) {
        elements.transactionsTable.innerHTML = '';
        
        if (transactions.length === 0) {
            elements.transactionsTable.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found</td></tr>';
            return;
        }
        
        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.id}</td>
                <td>${transaction.user_name || 'N/A'}</td>
                <td>${transaction.type}</td>
                <td>${transaction.formatted_amount || '$0'}</td>
                <td><span class="status-badge status-${transaction.status}">${transaction.status}</span></td>
                <td>${new Date(transaction.created_at).toLocaleDateString()}</td>
                <td>
                    ${transaction.status === 'pending' ? 
                        `<button class="btn btn-primary text-xs" onclick="updateTransactionStatus(${transaction.id}, 'completed')">Approve</button>` : 
                        '-'}
                </td>
            `;
            elements.transactionsTable.appendChild(row);
        });
    }
    
    // Filter transactions
    function filterTransactions(filter) {
        // Update button styles
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.className = 'filter-btn btn btn-primary text-xs';
            } else {
                btn.className = 'filter-btn btn bg-gray-700 hover:bg-gray-600 text-xs';
            }
        });
        
        // In a real implementation, this would filter the data
        // For now, we'll just reload all transactions
        loadTransactions();
    }
    
    // Load users
    async function loadUsers() {
        try {
            const response = await apiRequest('/api/admin/users');
            if (response) {
                const users = await response.json();
                renderUsers(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            elements.usersTable.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load users</td></tr>';
        }
    }
    
    // Render users
    function renderUsers(users) {
        elements.usersTable.innerHTML = '';
        
        if (users.length === 0) {
            elements.usersTable.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name || 'N/A'}</td>
                <td>${user.email}</td>
                <td>${user.formatted_balance || '$0'}</td>
                <td>${user.referrals || 0}</td>
                <td>
                    <button class="btn btn-primary text-xs" onclick="loadUserSelect(${user.id})">Select</button>
                </td>
            `;
            elements.usersTable.appendChild(row);
        });
    }
    
    // Search users
    async function searchUsers() {
        const query = elements.userSearch.value.trim();
        
        if (!query) {
            loadUsers();
            return;
        }
        
        try {
            const response = await apiRequest(`/api/admin/users?search=${encodeURIComponent(query)}`);
            if (response) {
                const users = await response.json();
                renderUsers(users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            showNotification('Failed to search users', 'error');
        }
    }
    
    // Load user select for deposit modal
    async function loadUserSelect(userId) {
        try {
            // Load users for the select dropdown
            const response = await apiRequest('/api/admin/users');
            if (response) {
                const users = await response.json();
                
                const userSelect = document.getElementById('userSelect');
                userSelect.innerHTML = '<option value="">Select a user</option>';
                
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.name} (${user.email})`;
                    if (user.id === userId) {
                        option.selected = true;
                    }
                    userSelect.appendChild(option);
                });
                
                showModal('depositModal');
            }
        } catch (error) {
            console.error('Error loading users for select:', error);
            showNotification('Failed to load users', 'error');
        }
    }
    
    // Handle deposit
    async function handleDeposit(e) {
        e.preventDefault();
        
        const userId = document.getElementById('userSelect').value;
        const amount = document.getElementById('depositAmount').value;
        const note = document.getElementById('depositNote').value;
        
        if (!userId || !amount) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const response = await apiRequest('/api/admin/deposit', {
                method: 'POST',
                body: JSON.stringify({ userId, amount, note }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                hideModal('depositModal');
                elements.depositForm.reset();
                loadDashboardData();
            } else {
                showNotification(data.message || 'Deposit failed', 'error');
            }
        } catch (error) {
            console.error('Deposit error:', error);
            showNotification('Failed to process deposit', 'error');
        }
    }
    
    // Load bots
    async function loadBots() {
        try {
            const response = await apiRequest('/api/admin/bots');
            if (response) {
                const bots = await response.json();
                renderBots(bots);
            }
        } catch (error) {
            console.error('Error loading bots:', error);
            document.getElementById('botsTable').innerHTML = '<tr><td colspan="8" class="text-center">Failed to load bots</td></tr>';
        }
    }
    
    // Render bots
    function renderBots(bots) {
        const botsTable = document.getElementById('botsTable');
        botsTable.innerHTML = '';
        
        if (bots.length === 0) {
            botsTable.innerHTML = '<tr><td colspan="8" class="text-center">No bots found</td></tr>';
            return;
        }
        
        bots.forEach(bot => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bot.id}</td>
                <td>${bot.user_name || 'N/A'}</td>
                <td>${bot.name}</td>
                <td>${bot.formatted_investment || '$0'}</td>
                <td>${bot.formatted_daily_profit || '$0'}</td>
                <td>${bot.formatted_total_profit || '$0'}</td>
                <td><span class="status-badge status-${bot.status}">${bot.status}</span></td>
                <td>
                    <button class="btn bg-red-600 hover:bg-red-700 text-xs" onclick="deleteBot(${bot.id})">Delete</button>
                </td>
            `;
            botsTable.appendChild(row);
        });
    }
    
    // Handle create bot
    async function handleCreateBot(e) {
        e.preventDefault();
        
        const userId = document.getElementById('botUserId').value;
        const name = document.getElementById('botName').value;
        const investment = document.getElementById('botInvestment').value;
        
        if (!userId || !name || !investment) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            const response = await apiRequest('/api/admin/bots', {
                method: 'POST',
                body: JSON.stringify({ userId, name, investment }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                elements.botsForm.reset();
                elements.botsForm.classList.add('hidden');
                loadBots();
                loadDashboardData();
            } else {
                showNotification(data.message || 'Failed to create bot', 'error');
            }
        } catch (error) {
            console.error('Create bot error:', error);
            showNotification('Failed to create bot', 'error');
        }
    }
    
    // Delete bot
    async function deleteBot(botId) {
        if (!confirm('Are you sure you want to delete this bot?')) {
            return;
        }
        
        try {
            const response = await apiRequest(`/api/admin/bots/${botId}`, {
                method: 'DELETE',
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                loadBots();
                loadDashboardData();
            } else {
                showNotification(data.message || 'Failed to delete bot', 'error');
            }
        } catch (error) {
            console.error('Delete bot error:', error);
            showNotification('Failed to delete bot', 'error');
        }
    }
    
    // Handle update deposit address
    async function handleUpdateDepositAddress(e) {
        e.preventDefault();
        
        const coin = document.getElementById('coinSelect').value;
        const network = document.getElementById('networkSelect').value;
        const address = document.getElementById('depositAddressInput').value;
        
        if (!coin || !network || !address) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        try {
            const response = await apiRequest('/api/admin/deposit/address', {
                method: 'PUT',
                body: JSON.stringify({ coin, network, address }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                hideModal('depositAddressModal');
                elements.depositAddressForm.reset();
            } else {
                showNotification(data.message || 'Failed to update address', 'error');
            }
        } catch (error) {
            console.error('Update deposit address error:', error);
            showNotification('Failed to update deposit address', 'error');
        }
    }
    
    // Update transaction status
    async function updateTransactionStatus(transactionId, status) {
        try {
            const response = await apiRequest(`/api/admin/transactions/${transactionId}`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(data.message, 'success');
                loadTransactions();
                loadDashboardData();
            } else {
                showNotification(data.message || 'Failed to update transaction', 'error');
            }
        } catch (error) {
            console.error('Update transaction error:', error);
            showNotification('Failed to update transaction', 'error');
        }
    }
    
    // Show modal
    function showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }
    
    // Hide modal
    function hideModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        elements.notification.textContent = message;
        elements.notification.className = `notification ${type}`;
        elements.notification.classList.add('show');
        
        setTimeout(() => {
            elements.notification.classList.remove('show');
        }, 3000);
    }
    
    // API request helper
    async function apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, mergedOptions);
            
            if (response.status === 401) {
                // Unauthorized
                logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }
    
    // Global functions for onclick handlers
    window.updateTransactionStatus = updateTransactionStatus;
    window.deleteBot = deleteBot;
    window.loadUserSelect = loadUserSelect;
    
    // Initialize the app
    init();
});