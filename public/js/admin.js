// Optimized admin.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        // Login
        loginFormContainer: document.getElementById('loginFormContainer'),
        adminLoginForm: document.getElementById('adminLoginForm'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        loginBtn: document.getElementById('loginBtn'),
        
        // Dashboard
        adminDashboard: document.getElementById('adminDashboard'),
        logoutBtn: document.getElementById('logoutBtn'),
        
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
        filterBtns: document.querySelectorAll('.filter-btn'),
        
        // Users
        usersTable: document.getElementById('usersTable'),
        userSearch: document.getElementById('userSearch'),
        searchUserBtn: document.getElementById('searchUserBtn'),
        
        // Modals
        depositModal: document.getElementById('depositModal'),
        depositForm: document.getElementById('depositForm'),
        userSelect: document.getElementById('userSelect'),
        depositAmount: document.getElementById('depositAmount'),
        depositNote: document.getElementById('depositNote'),
        cancelDeposit: document.getElementById('cancelDeposit'),
        cancelDepositBtn: document.getElementById('cancelDepositBtn'),
        
        botsModal: document.getElementById('botsModal'),
        botsForm: document.getElementById('botsForm'),
        createBotBtn: document.getElementById('createBotBtn'),
        botUserSearch: document.getElementById('botUserSearch'),
        searchBotUserBtn: document.getElementById('searchBotUserBtn'),
        botUserSearchResults: document.getElementById('botUserSearchResults'),
        selectedUserContainer: document.getElementById('selectedUserContainer'),
        selectedUserName: document.getElementById('selectedUserName'),
        selectedUserEmail: document.getElementById('selectedUserEmail'),
        clearSelectedUser: document.getElementById('clearSelectedUser'),
        botName: document.getElementById('botName'),
        botInvestment: document.getElementById('botInvestment'),
        cancelBotForm: document.getElementById('cancelBotForm'),
        cancelBots: document.getElementById('cancelBots'),
        botsTable: document.getElementById('botsTable'),
        
        depositAddressModal: document.getElementById('depositAddressModal'),
        depositAddressForm: document.getElementById('depositAddressForm'),
        coinSelect: document.getElementById('coinSelect'),
        networkSelect: document.getElementById('networkSelect'),
        depositAddressInput: document.getElementById('depositAddressInput'),
        cancelDepositAddress: document.getElementById('cancelDepositAddress'),
        cancelDepositAddressBtn: document.getElementById('cancelDepositAddressBtn'),
        
        // Notification
        notification: document.getElementById('notification'),
        
        // Test Connection
        testConnectionBtn: document.getElementById('testConnectionBtn'),
        serverUrl: document.getElementById('serverUrl')
    };

    // API Configuration
    const API_BASE = "http://localhost:3007";
    let authToken = localStorage.getItem('adminAuthToken');
    let selectedUserId = null;

    // Initialize the app
    init();

    async function init() {
        console.log('Initializing admin panel...');
        
        // Check if already logged in
        if (authToken) {
            console.log('Auth token found, verifying...');
            const isValid = await verifyToken();
            if (isValid) {
                console.log('Token valid, showing dashboard');
                showDashboard();
                loadDashboardData();
                loadUsers();
                loadTransactions();
            } else {
                console.log('Token invalid, showing login form');
                showLoginForm();
            }
        } else {
            console.log('No auth token, showing login form');
            showLoginForm();
        }

        setupEventListeners();
        makeTablesResponsive();
    }

    function showLoginForm() {
        console.log('Showing login form');
        if (elements.loginFormContainer) {
            elements.loginFormContainer.style.display = 'flex';
            elements.loginFormContainer.classList.remove('hidden');
        }
        if (elements.adminDashboard) {
            elements.adminDashboard.style.display = 'none';
            elements.adminDashboard.classList.add('hidden');
        }
    }

    function showDashboard() {
        console.log('Showing dashboard');
        if (elements.loginFormContainer) {
            elements.loginFormContainer.style.display = 'none';
            elements.loginFormContainer.classList.add('hidden');
        }
        if (elements.adminDashboard) {
            elements.adminDashboard.style.display = 'block';
            elements.adminDashboard.classList.remove('hidden');
        }
    }

    function setupEventListeners() {
        // Login form
        if (elements.adminLoginForm) {
            elements.adminLoginForm.addEventListener('submit', handleLogin);
        }
        
        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', logout);
        }
        
        // Quick actions
        if (elements.depositToUserBtn) {
            elements.depositToUserBtn.addEventListener('click', () => {
                elements.depositModal.classList.add('show');
                loadUsersForSelect();
            });
        }
        
        if (elements.manageBotsBtn) {
            elements.manageBotsBtn.addEventListener('click', () => {
                elements.botsModal.classList.add('show');
                loadBots();
            });
        }
        
        if (elements.refreshDataBtn) {
            elements.refreshDataBtn.addEventListener('click', refreshDashboardData);
        }
        
        if (elements.manageDepositAddressBtn) {
            elements.manageDepositAddressBtn.addEventListener('click', () => {
                elements.depositAddressModal.classList.add('show');
                loadDepositAddresses();
            });
        }
        
        // Transaction filters
        if (elements.filterBtns) {
            elements.filterBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Update active filter
                    elements.filterBtns.forEach(b => b.classList.remove('btn-primary'));
                    this.classList.add('btn-primary');
                    
                    // Reload transactions with filter
                    const filter = this.getAttribute('data-filter');
                    loadTransactions(filter);
                });
            });
        }
        
        // User search
        if (elements.searchUserBtn) {
            elements.searchUserBtn.addEventListener('click', searchUsers);
        }
        
        if (elements.userSearch) {
            elements.userSearch.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchUsers();
                }
            });
        }
        
        // Deposit form
        if (elements.depositForm) {
            elements.depositForm.addEventListener('submit', handleDeposit);
        }
        
        if (elements.cancelDeposit || elements.cancelDepositBtn) {
            const cancelHandler = () => {
                elements.depositModal.classList.remove('show');
            };
            if (elements.cancelDeposit) elements.cancelDeposit.addEventListener('click', cancelHandler);
            if (elements.cancelDepositBtn) elements.cancelDepositBtn.addEventListener('click', cancelHandler);
        }
        
        // Bot form
        if (elements.botsForm) {
            elements.botsForm.addEventListener('submit', handleCreateBot);
        }
        
        if (elements.createBotBtn) {
            elements.createBotBtn.addEventListener('click', () => {
                elements.botsForm.classList.remove('hidden');
            });
        }
        
        if (elements.cancelBotForm) {
            elements.cancelBotForm.addEventListener('click', () => {
                elements.botsForm.classList.add('hidden');
                resetBotForm();
            });
        }
        
        if (elements.cancelBots) {
            elements.cancelBots.addEventListener('click', () => {
                elements.botsModal.classList.remove('show');
                resetBotForm();
            });
        }
        
        // Bot user search
        if (elements.searchBotUserBtn) {
            elements.searchBotUserBtn.addEventListener('click', searchUsersForBot);
        }
        
        if (elements.botUserSearch) {
            elements.botUserSearch.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchUsersForBot();
                }
            });
        }
        
        // Clear selected user
        if (elements.clearSelectedUser) {
            elements.clearSelectedUser.addEventListener('click', clearSelectedUserForBot);
        }
        
        // Deposit address form
        if (elements.depositAddressForm) {
            elements.depositAddressForm.addEventListener('submit', handleUpdateDepositAddress);
        }
        
        if (elements.cancelDepositAddress || elements.cancelDepositAddressBtn) {
            const cancelHandler = () => {
                elements.depositAddressModal.classList.remove('show');
            };
            if (elements.cancelDepositAddress) elements.cancelDepositAddress.addEventListener('click', cancelHandler);
            if (elements.cancelDepositAddressBtn) elements.cancelDepositAddressBtn.addEventListener('click', cancelHandler);
        }
        
        // Test connection
        if (elements.testConnectionBtn) {
            elements.testConnectionBtn.addEventListener('click', testConnection);
        }
        
        // Window resize for responsive tables
        window.addEventListener('resize', makeTablesResponsive);
    }

    function resetBotForm() {
        elements.botsForm.reset();
        elements.selectedUserContainer.classList.add('hidden');
        elements.botUserSearchResults.classList.add('hidden');
        selectedUserId = null;
    }

    function clearSelectedUserForBot() {
        selectedUserId = null;
        elements.selectedUserContainer.classList.add('hidden');
        elements.botUserSearch.value = '';
    }

    async function verifyToken() {
        try {
            const response = await fetch(`${API_BASE}/api/admin/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            return response.ok;
        } catch (err) {
            console.error('Token verification error:', err);
            return false;
        }
    }

    async function handleLogin(e) {
        e.preventDefault();

        const username = elements.usernameInput.value;
        const password = elements.passwordInput.value;

        if (elements.loginBtn) {
            elements.loginBtn.innerHTML = '<div class="loading"></div> Logging in...';
            elements.loginBtn.disabled = true;
        }

        try {
            const response = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                authToken = data.token;
                localStorage.setItem('adminAuthToken', authToken);
                showNotification('Login successful!', 'success');
                showDashboard();
                loadDashboardData();
                loadUsers();
                loadTransactions();
            } else {
                showNotification(data.message || 'Login failed', 'error');
            }
        } catch (err) {
            console.error('Login error:', err);
            showNotification('Network error. Please try again.', 'error');
        } finally {
            if (elements.loginBtn) {
                elements.loginBtn.innerHTML = 'Login';
                elements.loginBtn.disabled = false;
            }
        }
    }

    function logout() {
        console.log('Logging out...');
        localStorage.removeItem('adminAuthToken');
        authToken = null;
        showLoginForm();
        showNotification('Logged out successfully', 'success');
    }

    async function loadDashboardData() {
        try {
            const response = await apiRequest('/api/admin/stats');
            
            if (response && response.ok) {
                const data = await response.json();
                
                if (elements.totalUsers) elements.totalUsers.textContent = data.totalUsers;
                if (elements.totalTransactions) elements.totalTransactions.textContent = data.totalTransactions;
                if (elements.pendingTransactions) elements.pendingTransactions.textContent = data.pendingTransactions;
                if (elements.totalVolume) elements.totalVolume.textContent = `$${data.totalVolume.toLocaleString()}`;
            }
        } catch (err) {
            console.error('Error loading dashboard data:', err);
            showNotification('Failed to load dashboard data', 'error');
        }
    }

    async function refreshDashboardData() {
        if (elements.refreshDataBtn) {
            const icon = elements.refreshDataBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
        }
        
        try {
            await Promise.all([
                loadDashboardData(),
                loadUsers(),
                loadTransactions()
            ]);
            
            showNotification('Data refreshed successfully!', 'success');
        } catch (err) {
            console.error('Error refreshing data:', err);
            showNotification('Failed to refresh data', 'error');
        } finally {
            if (elements.refreshDataBtn) {
                const icon = elements.refreshDataBtn.querySelector('i');
                if (icon) icon.classList.remove('fa-spin');
            }
        }
    }

    async function loadUsers(search = '') {
        if (!elements.usersTable) return;
        
        elements.usersTable.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading"></div> Loading users...</td></tr>';

        try {
            const url = search ? `/api/admin/users?search=${search}` : '/api/admin/users';
            const response = await apiRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                const users = data.users || [];
                
                elements.usersTable.innerHTML = "";
                
                if (users.length === 0) {
                    elements.usersTable.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
                } else {
                    users.forEach(user => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-title="ID">${user.id}</td>
                            <td data-title="Name">${user.name || 'N/A'}</td>
                            <td data-title="Email">${user.email}</td>
                            <td data-title="Balance">${user.currency || 'KSH'} ${parseFloat(user.balance || 0).toLocaleString()}</td>
                            <td data-title="Referrals">${user.referrals || 0}</td>
                            <td data-title="Actions">
                                <div class="flex gap-2 bot-actions">
                                    <button class="btn btn-icon btn-sm ${user.verified ? 'bg-green-600' : 'bg-yellow-600'}" 
                                            onclick="toggleUserVerification(${user.id}, ${user.verified})" 
                                            title="${user.verified ? 'Unverify User' : 'Verify User'}">
                                        <i class="fas ${user.verified ? 'fa-user-check' : 'fa-user-times'}"></i>
                                    </button>
                                    <button class="btn btn-icon btn-sm bg-blue-600" 
                                            onclick="viewUserDetails(${user.id})" 
                                            title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        elements.usersTable.appendChild(row);
                    });
                }
                
                makeTablesResponsive();
            }
        } catch (err) {
            console.error('Error loading users:', err);
            elements.usersTable.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load users</td></tr>';
            showNotification('Failed to load users', 'error');
        }
    }

    async function searchUsers() {
        const search = elements.userSearch ? elements.userSearch.value : '';
        loadUsers(search);
    }

    async function loadTransactions(filter = 'all') {
        if (!elements.transactionsTable) return;
        
        elements.transactionsTable.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading"></div> Loading transactions...</td></tr>';

        try {
            const url = filter !== 'all' ? `/api/admin/transactions?filter=${filter}` : '/api/admin/transactions';
            const response = await apiRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                const transactions = data.transactions || [];
                
                elements.transactionsTable.innerHTML = "";
                
                if (transactions.length === 0) {
                    elements.transactionsTable.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found</td></tr>';
                } else {
                    transactions.forEach(transaction => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-title="ID">${transaction.id}</td>
                            <td data-title="User">${transaction.user ? transaction.user.name : 'N/A'}</td>
                            <td data-title="Type">${transaction.type}</td>
                            <td data-title="Amount">${transaction.currency || 'KSH'} ${parseFloat(transaction.amount || 0).toLocaleString()}</td>
                            <td data-title="Status"><span class="status-badge status-${transaction.status}">${transaction.status}</span></td>
                            <td data-title="Date">${new Date(transaction.created_at).toLocaleString()}</td>
                            <td data-title="Actions">
                                <div class="flex gap-2 bot-actions">
                                    ${transaction.status === 'pending' ? `
                                        <button class="btn btn-icon btn-sm bg-green-600" 
                                                onclick="updateTransactionStatus(${transaction.id}, 'completed')" 
                                                title="Approve">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button class="btn btn-icon btn-sm bg-red-600" 
                                                onclick="updateTransactionStatus(${transaction.id}, 'failed')" 
                                                title="Reject">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-icon btn-sm bg-blue-600" 
                                            onclick="viewTransactionDetails(${transaction.id})" 
                                            title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        elements.transactionsTable.appendChild(row);
                    });
                }
                
                makeTablesResponsive();
            }
        } catch (err) {
            console.error('Error loading transactions:', err);
            elements.transactionsTable.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load transactions</td></tr>';
            showNotification('Failed to load transactions', 'error');
        }
    }

    async function loadUsersForSelect() {
        if (!elements.userSelect) return;
        
        try {
            const response = await apiRequest('/api/admin/users');
            
            if (response && response.ok) {
                const data = await response.json();
                const users = data.users || [];
                
                elements.userSelect.innerHTML = '<option value="">Select a user</option>';
                
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.name || 'N/A'} (${user.email})`;
                    elements.userSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Error loading users for select:', err);
            showNotification('Failed to load users', 'error');
        }
    }

    async function searchUsersForBot() {
        const searchTerm = elements.botUserSearch ? elements.botUserSearch.value : '';
        
        if (!searchTerm) {
            elements.botUserSearchResults.classList.add('hidden');
            return;
        }
        
        try {
            const url = `/api/admin/users?search=${searchTerm}`;
            const response = await apiRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                const users = data.users || [];
                
                elements.botUserSearchResults.innerHTML = '';
                
                if (users.length === 0) {
                    elements.botUserSearchResults.innerHTML = '<div class="user-search-result-item">No users found</div>';
                } else {
                    users.forEach(user => {
                        const item = document.createElement('div');
                        item.className = 'user-search-result-item';
                        item.innerHTML = `
                            <div class="font-medium">${user.name || 'N/A'}</div>
                            <div class="text-sm text-gray-400">${user.email}</div>
                        `;
                        item.addEventListener('click', () => selectUserForBot(user));
                        elements.botUserSearchResults.appendChild(item);
                    });
                }
                
                elements.botUserSearchResults.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Error searching users for bot:', err);
            showNotification('Failed to search users', 'error');
        }
    }

    function selectUserForBot(user) {
        selectedUserId = user.id;
        elements.selectedUserName.textContent = user.name || 'N/A';
        elements.selectedUserEmail.textContent = user.email;
        elements.selectedUserContainer.classList.remove('hidden');
        elements.botUserSearchResults.classList.add('hidden');
        elements.botUserSearch.value = '';
    }
    async function handleDeposit(e) {
        e.preventDefault();

        const userId = parseInt(elements.userSelect.value, 10);
        const amount = parseFloat(elements.depositAmount.value);
        const note = elements.depositNote.value.trim();

        // Validate input
        if (isNaN(userId) || isNaN(amount) || amount <= 0) {
            showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }

        try {
            const response = await apiRequest('/api/admin/deposits', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    amount,
                    currency: 'KSH',
                    note,
                    status: 'completed' // auto-complete the deposit
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showNotification(data.message || 'Failed to create deposit', 'error');
                return;
            }

            showNotification('Deposit created successfully!', 'success');

            // Reset form and close modal
            elements.depositForm.reset();
            elements.depositModal.classList.remove('show');

            // Refresh dashboard
            refreshDashboardData();

        } catch (err) {
            console.error('Error creating deposit:', err);
            showNotification('Server error: Failed to create deposit', 'error');
        }
    }




    async function loadBots() {
        if (!elements.botsTable) return;
        
        elements.botsTable.innerHTML = '<tr><td colspan="8" class="text-center"><div class="loading"></div> Loading bots...</td></tr>';

        try {
            const response = await apiRequest('/api/admin/bots');
            
            if (response && response.ok) {
                const data = await response.json();
                const bots = data.bots || [];
                
                elements.botsTable.innerHTML = "";
                
                if (bots.length === 0) {
                    elements.botsTable.innerHTML = '<tr><td colspan="8" class="text-center">No bots found</td></tr>';
                } else {
                    bots.forEach(bot => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-title="ID">${bot.id}</td>
                            <td data-title="User">${bot.user ? bot.user.name : bot.user_id}</td>
                            <td data-title="Name">${bot.name}</td>
                            <td data-title="Investment">${bot.currency || 'KSH'} ${parseFloat(bot.investment || 0).toLocaleString()}</td>
                            <td data-title="Daily Profit">${bot.currency || 'KSH'} ${parseFloat(bot.daily_profit || 0).toLocaleString()}</td>
                            <td data-title="Total Profit">${bot.currency || 'KSH'} ${parseFloat(bot.total_profit || 0).toLocaleString()}</td>
                            <td data-title="Status"><span class="status-badge status-${bot.status}">${bot.status}</span></td>
                            <td data-title="Actions">
                                <div class="flex gap-2 bot-actions">
                                    <button class="btn btn-icon btn-sm bg-red-600" 
                                            onclick="deleteBot(${bot.id})" 
                                            title="Delete Bot">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        elements.botsTable.appendChild(row);
                    });
                }
                
                makeTablesResponsive();
            }
        } catch (err) {
            console.error('Error loading bots:', err);
            elements.botsTable.innerHTML = '<tr><td colspan="8" class="text-center">Failed to load bots</td></tr>';
            showNotification('Failed to load bots', 'error');
        }
    }

        async function handleCreateBot(e) {
        e.preventDefault();

        const name = elements.botName.value.trim();
        const investment = parseFloat(elements.botInvestment.value);

        if (!name || !investment) {
            showNotification('Please select a user and fill in all required fields', 'error');
            return;
        }

        try {
            // Send request to create bot
            const response = await apiRequest('/api/admin/bots', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    investment
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showNotification(data.message || 'Failed to create bot', 'error');
                return;
            }

            showNotification(`Bot "${data.bot.name}" created successfully!`, 'success');

            // Reset form
            resetBotForm();
            elements.botsForm.classList.add('hidden');

            // Reload bots list
            loadBots();

        } catch (err) {
            console.error('Error creating bot:', err);
            showNotification('Server error: Failed to create bot', 'error');
        }
    }

    async function loadDepositAddresses() {
        try {
            const response = await apiRequest('/api/admin/deposit-addresses');
            
            if (response && response.ok) {
                const data = await response.json();
                const addresses = data.addresses || [];
                
                if (addresses.length > 0) {
                    const address = addresses[0];
                    elements.coinSelect.value = address.coin;
                    elements.networkSelect.value = address.network;
                    elements.depositAddressInput.value = address.address;
                }
            }
        } catch (err) {
            console.error('Error loading deposit addresses:', err);
            showNotification('Failed to load deposit addresses', 'error');
        }
    }

    async function handleUpdateDepositAddress(e) {
        e.preventDefault();
        
        const coin = elements.coinSelect.value;
        const network = elements.networkSelect.value;
        const address = elements.depositAddressInput.value;
        
        if (!address) {
            showNotification('Please enter a deposit address', 'error');
            return;
        }
        
        try {
            // First get the address ID
            const listResponse = await apiRequest('/api/admin/deposit-addresses');
            
            if (listResponse && listResponse.ok) {
                const listData = await listResponse.json();
                const addresses = listData.addresses || [];
                
                if (addresses.length > 0) {
                    const addressId = addresses[0].id;
                    
                    // Update the address
                    const updateResponse = await apiRequest(`/api/admin/deposit-addresses/${addressId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ address })
                    });
                    
                    if (updateResponse && updateResponse.ok) {
                        showNotification('Deposit address updated successfully!', 'success');
                        elements.depositAddressModal.classList.remove('show');
                    } else {
                        const errorData = await updateResponse.json();
                        showNotification(errorData.message || 'Failed to update deposit address', 'error');
                    }
                } else {
                    // Create new address
                    const createResponse = await apiRequest('/api/admin/deposit-addresses', {
                        method: 'POST',
                        body: JSON.stringify({ coin, network, address })
                    });
                    
                    if (createResponse && createResponse.ok) {
                        showNotification('Deposit address created successfully!', 'success');
                        elements.depositAddressModal.classList.remove('show');
                    } else {
                        const errorData = await createResponse.json();
                        showNotification(errorData.message || 'Failed to create deposit address', 'error');
                    }
                }
            }
        } catch (err) {
            console.error('Error updating deposit address:', err);
            showNotification('Failed to update deposit address', 'error');
        }
    }

    async function testConnection() {
        if (elements.testConnectionBtn) {
            elements.testConnectionBtn.innerHTML = '<div class="loading"></div> Testing...';
            elements.testConnectionBtn.disabled = true;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken || 'test'}`
                }
            });
            
            if (response.ok) {
                showNotification('Server connection successful!', 'success');
            } else {
                showNotification('Server connection failed', 'error');
            }
        } catch (err) {
            console.error('Connection test error:', err);
            showNotification('Server connection failed', 'error');
        } finally {
            if (elements.testConnectionBtn) {
                elements.testConnectionBtn.innerHTML = 'Test Server Connection';
                elements.testConnectionBtn.disabled = false;
            }
        }
    }

    function apiRequest(endpoint, options = {}) {
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
        
        return fetch(`${API_BASE}${endpoint}`, mergedOptions)
            .then(async response => {
                if (response.status === 401) {
                    logout();
                    return Promise.reject('Unauthorized');
                }
                
                // Clone the response so we can read it multiple times if needed
                const clonedResponse = response.clone();
                
                // Try to parse JSON response, but handle non-JSON errors
                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    // If JSON parsing fails, get the text response
                    const text = await clonedResponse.text();
                    console.error('Non-JSON response:', text);
                    throw new Error(`Server error: ${text}`);
                }
                
                if (!response.ok) {
                    console.error('API Error:', data);
                    throw new Error(data.message || 'Server error');
                }
                
                // Return the original response with the data already parsed
                return {
                    ok: response.ok,
                    status: response.status,
                    json: () => Promise.resolve(data),
                    text: () => Promise.resolve(JSON.stringify(data))
                };
            })
            .catch(error => {
                console.error(`API request failed for ${endpoint}:`, error);
                throw error;
            });
    }

    function showNotification(message, type = 'success') {
        if (elements.notification) {
            elements.notification.textContent = message;
            elements.notification.className = `notification ${type}`;
            elements.notification.classList.add('show');
            
            setTimeout(() => {
                elements.notification.classList.remove('show');
            }, 3000);
        }
    }

    // Function to make tables responsive on mobile
    function makeTablesResponsive() {
        const tables = document.querySelectorAll('.data-table');
        
        if (window.innerWidth <= 640) {
            tables.forEach(table => {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
                const rows = table.querySelectorAll('tbody tr');
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    cells.forEach((cell, index) => {
                        if (headers[index]) {
                            cell.setAttribute('data-title', headers[index]);
                        }
                    });
                });
            });
        }
    }

    // Global functions for inline event handlers
    window.toggleUserVerification = async function(userId, currentStatus) {
        try {
            const response = await apiRequest(`/api/admin/users/${userId}/verify`, {
                method: 'PUT',
                body: JSON.stringify({ verified: !currentStatus })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                showNotification(`User ${!currentStatus ? 'verified' : 'unverified'} successfully!`, 'success');
                loadUsers();
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to update user verification', 'error');
            }
        } catch (err) {
            console.error('Error updating user verification:', err);
            showNotification('Failed to update user verification', 'error');
        }
    };

    window.viewUserDetails = async function(userId) {
        try {
            const response = await apiRequest(`/api/admin/users/${userId}`);
            
            if (response && response.ok) {
                const data = await response.json();
                const user = data.user;
                
                // Create a modal with user details
                const modal = document.createElement('div');
                modal.className = 'modal show';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold">User Details</h3>
                            <button class="text-gray-400 hover:text-white text-2xl" onclick="this.closest('.modal').remove()">&times;</button>
                        </div>
                        <div class="space-y-3">
                            <div><strong>ID:</strong> ${user.id}</div>
                            <div><strong>Name:</strong> ${user.name || 'N/A'}</div>
                            <div><strong>Email:</strong> ${user.email}</div>
                            <div><strong>Balance:</strong> ${user.currency || 'KSH'} ${parseFloat(user.balance || 0).toLocaleString()}</div>
                            <div><strong>Profit:</strong> ${user.currency || 'KSH'} ${parseFloat(user.profit || 0).toLocaleString()}</div>
                            <div><strong>Active Bots:</strong> ${user.active_bots || 0}</div>
                            <div><strong>Referrals:</strong> ${user.referrals || 0}</div>
                            <div><strong>Verified:</strong> ${user.verified ? 'Yes' : 'No'}</div>
                            <div><strong>Role:</strong> ${user.role}</div>
                            <div><strong>Currency:</strong> ${user.currency || 'KSH'}</div>
                            <div><strong>Phone Verified:</strong> ${user.phone_verified ? 'Yes' : 'No'}</div>
                            <div><strong>Created:</strong> ${new Date(user.created_at).toLocaleString()}</div>
                        </div>
                        <div class="mt-4 text-right">
                            <button class="btn bg-gray-600 hover:bg-gray-700" onclick="this.closest('.modal').remove()">Close</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to fetch user details', 'error');
            }
        } catch (err) {
            console.error('Error fetching user details:', err);
            showNotification('Failed to fetch user details', 'error');
        }
    };

    window.updateTransactionStatus = async function(transactionId, status) {
        try {
            const response = await apiRequest(`/api/admin/transactions/${transactionId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                showNotification(`Transaction ${status} successfully!`, 'success');
                loadTransactions();
                refreshDashboardData();
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to update transaction status', 'error');
            }
        } catch (err) {
            console.error('Error updating transaction status:', err);
            showNotification('Failed to update transaction status', 'error');
        }
    };

    window.viewTransactionDetails = async function(transactionId) {
        try {
            const response = await apiRequest(`/api/admin/transactions/${transactionId}`);
            
            if (response && response.ok) {
                const data = await response.json();
                const transaction = data.transaction;
                
                // Create a modal with transaction details
                const modal = document.createElement('div');
                modal.className = 'modal show';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold">Transaction Details</h3>
                            <button class="text-gray-400 hover:text-white text-2xl" onclick="this.closest('.modal').remove()">&times;</button>
                        </div>
                        <div class="space-y-3">
                            <div><strong>ID:</strong> ${transaction.id}</div>
                            <div><strong>User:</strong> ${transaction.user ? transaction.user.name : 'N/A'} (${transaction.user ? transaction.user.email : 'N/A'})</div>
                            <div><strong>Type:</strong> ${transaction.type}</div>
                            <div><strong>Amount:</strong> ${transaction.currency || 'KSH'} ${parseFloat(transaction.amount || 0).toLocaleString()}</div>
                            <div><strong>Status:</strong> <span class="status-badge status-${transaction.status}">${transaction.status}</span></div>
                            <div><strong>Method:</strong> ${transaction.method || 'N/A'}</div>
                            <div><strong>Reference ID:</strong> ${transaction.reference_id || 'N/A'}</div>
                            <div><strong>Created:</strong> ${new Date(transaction.created_at).toLocaleString()}</div>
                            <div><strong>Updated:</strong> ${transaction.updated_at ? new Date(transaction.updated_at).toLocaleString() : 'N/A'}</div>
                            ${transaction.note ? `<div><strong>Note:</strong> ${transaction.note}</div>` : ''}
                        </div>
                        <div class="mt-4 text-right">
                            <button class="btn bg-gray-600 hover:bg-gray-700" onclick="this.closest('.modal').remove()">Close</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to fetch transaction details', 'error');
            }
        } catch (err) {
            console.error('Error fetching transaction details:', err);
            showNotification('Failed to fetch transaction details', 'error');
        }
    };

    window.deleteBot = async function(botId) {
        if (!confirm('Are you sure you want to delete this bot?')) {
            return;
        }
        
        try {
            const response = await apiRequest(`/api/admin/bots/${botId}`, {
                method: 'DELETE'
            });
            
            if (response && response.ok) {
                showNotification('Bot deleted successfully!', 'success');
                loadBots();
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to delete bot', 'error');
            }
        } catch (err) {
            console.error('Error deleting bot:', err);
            showNotification('Failed to delete bot', 'error');
        }
    };
});