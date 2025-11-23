// API Base URL - Updated to match your admin server port
const API_BASE = 'http://localhost:3007';

// Check if admin is logged in
let adminToken = localStorage.getItem('adminToken');

// DOM Elements
const loginForm = document.getElementById('loginForm');
const adminDashboard = document.getElementById('adminDashboard');
const adminLoginForm = document.getElementById('adminLoginForm');
const logoutBtn = document.getElementById('logoutBtn');
const depositModal = document.getElementById('depositModal');
const depositForm = document.getElementById('depositForm');
const cancelDeposit = document.getElementById('cancelDeposit');
const depositToUserBtn = document.getElementById('depositToUserBtn');
const refreshDataBtn = document.getElementById('refreshDataBtn');
const searchUserBtn = document.getElementById('searchUserBtn');
const userSearch = document.getElementById('userSearch');
const manageDepositAddressBtn = document.getElementById('manageDepositAddressBtn');
const depositAddressModal = document.getElementById('depositAddressModal');
const depositAddressForm = document.getElementById('depositAddressForm');
const cancelDepositAddress = document.getElementById('cancelDepositAddress');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const debugInfo = document.getElementById('debugInfo');
const debugContent = document.getElementById('debugContent');

// New DOM Elements for Bots Management
const botsModal = document.getElementById('botsModal');
const botsForm = document.getElementById('botsForm');
const cancelBots = document.getElementById('cancelBots');
const createBotBtn = document.getElementById('createBotBtn');
const manageBotsBtn = document.getElementById('manageBotsBtn');
const botsTable = document.getElementById('botsTable');
const cancelBotForm = document.getElementById('cancelBotForm');

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Debug function
function debug(message) {
    console.log(message);
    debugContent.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
    debugInfo.classList.remove('hidden');
}

// Test server connection
testConnectionBtn.addEventListener('click', async () => {
    try {
        debug('Testing server connection...');
        const response = await fetch(`${API_BASE}/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        debug(`Response status: ${response.status}`);
        debug(`Response headers: ${JSON.stringify([...response.headers.entries()])}`);
        
        const contentType = response.headers.get('content-type');
        debug(`Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            debug(`Response data: ${JSON.stringify(data)}`);
        } else {
            const text = await response.text();
            debug(`Response text (first 200 chars): ${text.substring(0, 200)}`);
        }
        
        showNotification('Connection test completed. Check console for details.', 'success');
    } catch (err) {
        debug(`Connection test error: ${err.message}`);
        showNotification('Connection test failed. Check console for details.', 'error');
    }
});

// Admin login
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Show loading state
    const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Logging in...';
    submitBtn.disabled = true;
    
    try {
        debug(`Attempting login to: ${API_BASE}/api/admin/login`);
        debug(`With credentials: ${username} / ${password}`);
        
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        debug(`Response status: ${response.status}`);
        debug(`Response headers: ${JSON.stringify([...response.headers.entries()])}`);
        
        const contentType = response.headers.get('content-type');
        debug(`Content-Type: ${contentType}`);
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
            debug(`Response data: ${JSON.stringify(data)}`);
        } else {
            const text = await response.text();
            debug(`Response text (first 500 chars): ${text.substring(0, 500)}`);
            throw new Error('Server returned non-JSON response');
        }
        
        if (response.ok) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            loginForm.classList.add('hidden');
            adminDashboard.classList.remove('hidden');
            loadDashboardData();
            showNotification('Login successful!', 'success');
        } else {
            debug(`Login failed: ${data.message || 'Unknown error'}`);
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (err) {
        debug(`Login error: ${err.message}`);
        showNotification(`Network error: ${err.message}`, 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    adminToken = null;
    adminDashboard.classList.add('hidden');
    loginForm.classList.remove('hidden');
    showNotification('Logged out successfully', 'success');
});

// Load dashboard data
async function loadDashboardData() {
    try {
        debug('Loading dashboard data...');
        
        // Load stats
        const usersResponse = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        }
        
        const usersData = await usersResponse.json();
        document.getElementById('totalUsers').textContent = usersData.length;
        
        const transactionsResponse = await fetch(`${API_BASE}/api/admin/transactions`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!transactionsResponse.ok) {
            throw new Error(`Failed to fetch transactions: ${transactionsResponse.status}`);
        }
        
        const transactionsData = await transactionsResponse.json();
        document.getElementById('totalTransactions').textContent = transactionsData.length;
        
        const pendingTransactions = transactionsData.filter(t => t.status === 'pending');
        document.getElementById('pendingTransactions').textContent = pendingTransactions.length;
        
        const totalVolume = transactionsData.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        document.getElementById('totalVolume').textContent = `$${totalVolume.toFixed(2)}`;
        
        // Load transactions table
        loadTransactionsTable(transactionsData);
        
        // Load users table
        loadUsersTable(usersData);
        
        // Load user select for deposit
        loadUserSelect(usersData);
        
        // Load bots table
        loadBotsTable();
    } catch (err) {
        debug(`Dashboard data error: ${err.message}`);
        showNotification(`Failed to load dashboard data: ${err.message}`, 'error');
    }
}

// Load transactions table
function loadTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTable');
    tbody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const statusClass = transaction.status === 'completed' ? 'status-completed' : 
                            transaction.status === 'pending' ? 'status-pending' : 'status-failed';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${transaction.id}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium">${transaction.user_name || 'N/A'}</div>
                <div class="text-xs text-gray-400">${transaction.user_email || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${transaction.type}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${transaction.currency === 'KSH' ? 'KSH' : '$'}${parseFloat(transaction.amount).toLocaleString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${statusClass}">${transaction.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${new Date(transaction.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${transaction.status === 'pending' ? 
                    `<button class="text-green-400 hover:text-green-300 complete-transaction" data-id="${transaction.id}">Complete</button>` : 
                    '-'}
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners to complete buttons
    document.querySelectorAll('.complete-transaction').forEach(btn => {
        btn.addEventListener('click', async function() {
            const transactionId = this.getAttribute('data-id');
            
            try {
                const response = await fetch(`${API_BASE}/api/admin/transactions/${transactionId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ status: 'completed' })
                });
                
                const data = await response.json();
                if (response.ok) {
                    showNotification('Transaction completed successfully!', 'success');
                    loadDashboardData();
                } else {
                    showNotification(data.message || 'Failed to complete transaction', 'error');
                }
            } catch (err) {
                debug(`Complete transaction error: ${err.message}`);
                showNotification('Network error. Please try again.', 'error');
            }
        });
    });
}

// Load users table
function loadUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${user.id}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${user.name}
                ${user.verified ? '<span class="ml-2 px-2 py-1 text-xs bg-green-500 text-white rounded-full">Verified</span>' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${user.email}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${user.currency === 'USD' ? '$' : 'KSH'}${parseFloat(user.balance || 0).toLocaleString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${user.referrals || 0}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button class="text-blue-400 hover:text-blue-300 deposit-to-user mr-2" data-id="${user.id}" data-name="${user.name}">
                    Deposit
                </button>
                <button class="text-${user.verified ? 'yellow' : 'green'}-400 hover:text-${user.verified ? 'yellow' : 'green'}-300 verify-user" data-id="${user.id}" data-verified="${user.verified}">
                    ${user.verified ? 'Unverify' : 'Verify'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners to deposit buttons
    document.querySelectorAll('.deposit-to-user').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            const userName = this.getAttribute('data-name');
            
            // Open deposit modal with pre-selected user
            document.getElementById('userSelect').value = userId;
            depositModal.classList.add('show');
        });
    });
    
    // Add event listeners to verify buttons
    document.querySelectorAll('.verify-user').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-id');
            const isVerified = this.getAttribute('data-verified') === 'true';
            
            try {
                const response = await fetch(`${API_BASE}/api/admin/users/${userId}/verify`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ verified: !isVerified })
                });
                
                const data = await response.json();
                if (response.ok) {
                    showNotification(`User ${!isVerified ? 'verified' : 'unverified'} successfully!`, 'success');
                    loadDashboardData();
                } else {
                    showNotification(data.message || `Failed to ${!isVerified ? 'verify' : 'unverify'} user`, 'error');
                }
            } catch (err) {
                debug(`Verify user error: ${err.message}`);
                showNotification('Network error. Please try again.', 'error');
            }
        });
    });
}

// Load user select for deposit modal
function loadUserSelect(users) {
    const userSelect = document.getElementById('userSelect');
    userSelect.innerHTML = '<option value="">Select a user</option>';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.email})`;
        userSelect.appendChild(option);
    });
}

// Load bots table
async function loadBotsTable() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/bots`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch bots: ${response.status}`);
        }
        
        const botsData = await response.json();
        const tbody = document.getElementById('botsTable');
        tbody.innerHTML = '';
        
        botsData.forEach(bot => {
            const statusClass = bot.status === 'completed' ? 'status-completed' : 
                                bot.status === 'active' ? 'status-pending' : 'status-failed';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ${bot.id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium">${bot.user_name || 'N/A'}</div>
                    <div class="text-xs text-gray-400">${bot.user_email || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ${bot.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${bot.formatted_investment}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${bot.formatted_daily_profit}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${bot.formatted_total_profit}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${statusClass}">${bot.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button class="text-red-400 hover:text-red-300 delete-bot" data-id="${bot.id}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-bot').forEach(btn => {
            btn.addEventListener('click', async function() {
                const botId = this.getAttribute('data-id');
                
                if (confirm('Are you sure you want to delete this bot?')) {
                    try {
                        const response = await fetch(`${API_BASE}/api/admin/bots/${botId}`, {
                            method: 'DELETE',
                            headers: { 
                                'Authorization': `Bearer ${adminToken}`
                            }
                        });
                        
                        const data = await response.json();
                        if (response.ok) {
                            showNotification('Bot deleted successfully!', 'success');
                            loadBotsTable();
                            loadDashboardData();
                        } else {
                            showNotification(data.message || 'Failed to delete bot', 'error');
                        }
                    } catch (err) {
                        debug(`Delete bot error: ${err.message}`);
                        showNotification('Network error. Please try again.', 'error');
                    }
                }
            });
        });
    } catch (err) {
        debug(`Load bots table error: ${err.message}`);
        showNotification('Failed to load bots data', 'error');
    }
}

// Deposit modal functionality
depositToUserBtn.addEventListener('click', () => {
    depositModal.classList.add('show');
});

cancelDeposit.addEventListener('click', () => {
    depositModal.classList.remove('show');
    depositForm.reset();
});

depositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('userSelect').value;
    const amount = document.getElementById('depositAmount').value;
    const note = document.getElementById('depositNote').value;
    
    if (!userId || !amount) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = depositForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Processing...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/deposit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ 
                userId: userId, 
                amount: amount,
                currency: 'KSH',
                note: note
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showNotification('Deposit successful!', 'success');
            depositModal.classList.remove('show');
            depositForm.reset();
            loadDashboardData();
        } else {
            showNotification(data.message || 'Failed to process deposit', 'error');
        }
    } catch (err) {
        debug(`Deposit error: ${err.message}`);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Bots modal functionality
manageBotsBtn.addEventListener('click', () => {
    botsModal.classList.add('show');
    loadBotsTable();
});

cancelBots.addEventListener('click', () => {
    botsModal.classList.remove('show');
    botsForm.reset();
    botsForm.classList.add('hidden');
});

cancelBotForm.addEventListener('click', () => {
    botsForm.classList.add('hidden');
    botsForm.reset();
});

createBotBtn.addEventListener('click', () => {
    botsForm.classList.remove('hidden');
    document.getElementById('botUserId').focus();
});

botsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('botUserId').value;
    const name = document.getElementById('botName').value;
    const investment = document.getElementById('botInvestment').value;
    
    if (!userId || !name || !investment) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = botsForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Creating...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/bots`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ 
                userId: userId, 
                name: name,
                investment: investment
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showNotification('Bot created successfully!', 'success');
            botsForm.reset();
            botsForm.classList.add('hidden');
            loadBotsTable();
            loadDashboardData();
        } else {
            showNotification(data.message || 'Failed to create bot', 'error');
        }
    } catch (err) {
        debug(`Create bot error: ${err.message}`);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Deposit address management
manageDepositAddressBtn.addEventListener('click', async () => {
    // Load current deposit addresses
    try {
        const response = await fetch(`${API_BASE}/api/admin/deposit/addresses`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            const addresses = await response.json();
            
            // Pre-select the first address if available
            if (addresses.length > 0) {
                document.getElementById('coinSelect').value = addresses[0].coin;
                document.getElementById('networkSelect').value = addresses[0].network;
                document.getElementById('depositAddressInput').value = addresses[0].address;
            }
            
            depositAddressModal.classList.add('show');
        } else {
            showNotification('Failed to load deposit addresses', 'error');
        }
    } catch (err) {
        debug(`Load deposit addresses error: ${err.message}`);
        showNotification('Network error. Please try again.', 'error');
    }
});

cancelDepositAddress.addEventListener('click', () => {
    depositAddressModal.classList.remove('show');
    depositAddressForm.reset();
});

depositAddressForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const coin = document.getElementById('coinSelect').value;
    const network = document.getElementById('networkSelect').value;
    const address = document.getElementById('depositAddressInput').value;
    
    if (!coin || !network || !address) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = depositAddressForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Updating...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/deposit/address`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ coin, network, address })
        });
        
        const data = await response.json();
        if (response.ok) {
            showNotification('Deposit address updated successfully!', 'success');
            depositAddressModal.classList.remove('show');
            depositAddressForm.reset();
        } else {
            showNotification(data.message || 'Failed to update deposit address', 'error');
        }
    } catch (err) {
        debug(`Update deposit address error: ${err.message}`);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Refresh data button
refreshDataBtn.addEventListener('click', () => {
    loadDashboardData();
    showNotification('Data refreshed successfully!', 'success');
});

// Search users functionality
searchUserBtn.addEventListener('click', async () => {
    const searchTerm = userSearch.value.trim();
    
    if (!searchTerm) {
        loadDashboardData();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            const usersData = await response.json();
            // Filter users based on search term
            const filteredUsers = usersData.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
            loadUsersTable(filteredUsers);
        } else {
            showNotification('Failed to search users', 'error');
        }
    } catch (err) {
        debug(`Search users error: ${err.message}`);
        showNotification('Network error. Please try again.', 'error');
    }
});

// Filter transactions
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        // Update active button style
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            b.classList.add('bg-white/10', 'hover:bg-white/20');
        });
        this.classList.remove('bg-white/10', 'hover:bg-white/20');
        this.classList.add('bg-blue-600', 'hover:bg-blue-700');
        
        // Filter transactions
        const filter = this.getAttribute('data-filter');
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/transactions`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            if (response.ok) {
                const transactionsData = await response.json();
                // Filter transactions based on status
                const filteredTransactions = filter === 'all' 
                    ? transactionsData 
                    : transactionsData.filter(t => t.status === filter);
                loadTransactionsTable(filteredTransactions);
            } else {
                showNotification('Failed to filter transactions', 'error');
            }
        } catch (err) {
            debug(`Filter transactions error: ${err.message}`);
            showNotification('Network error. Please try again.', 'error');
        }
    });
});

// Check if already logged in
if (adminToken) {
    loginForm.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    loadDashboardData();
}