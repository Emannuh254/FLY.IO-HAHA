   // API Base URL
        const API_BASE = 'https://fly-io-haha.onrender.com';

        // Check if user is logged in
        let token = localStorage.getItem('token');
        let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
        let isLoggedIn = !!token;

        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            const mobileMenu = document.getElementById('mobileMenu');
            mobileMenu.classList.toggle('active');
        });

        // Load user data
        function loadUserData() {
            if (user) {
                // Update UI with user data
                document.getElementById('userBalance').textContent = `${user.currency || 'KSH'} ${parseFloat(user.balance || 0).toLocaleString()}`;
                document.getElementById('userBalance').classList.remove('hidden');
                document.getElementById('logoutBtn').style.display = 'flex';
                document.getElementById('logoutBtnMobile').style.display = 'flex';
                
                // Load profile image
                const savedPhoto = localStorage.getItem('forexpro_profile') || user.profile_image;
                if (savedPhoto) {
                    document.getElementById('userImage').src = savedPhoto;
                } else {
                    document.getElementById('userImage').src = 'https://randomuser.me/api/portraits/men/45.jpg';
                }
                
                // Update balances
                updateBalances();
                // Load transactions
                loadTransactions();
                // Fetch deposit address
                fetchDepositAddress();
            } else {
                document.getElementById('userBalance').classList.add('hidden');
                document.getElementById('logoutBtn').style.display = 'none';
                document.getElementById('logoutBtnMobile').style.display = 'none';
                document.getElementById('userImage').src = 'https://randomuser.me/api/portraits/men/45.jpg';
            }
        }

        // Logout functionality
        function handleLogout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            token = null;
            user = null;
            isLoggedIn = false;
            loadUserData();
            showNotification('Logged out successfully', 'success');
            // Redirect to index.html after logout
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }

        // Add event listeners to both logout buttons
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        document.getElementById('logoutBtnMobile').addEventListener('click', handleLogout);

        // Initialize user data on page load
        loadUserData();

        // Update balances
        function updateBalances() {
            if (!user) return;

            // Convert balance to KSH (assuming 1 USD = 135 KSH)
            const usdToKsh = 135;
            const totalBalance = parseFloat(user.balance || 0);
            const availableBalance = totalBalance * 0.7; // Assume 70% available
            const investedBalance = totalBalance * 0.3; // Assume 30% invested

            document.getElementById('totalBalance').textContent = `$${totalBalance.toFixed(2)}`;
            document.getElementById('totalBalanceKSH').textContent = `≈ KSH ${(totalBalance * usdToKsh).toFixed(0)}`;
            document.getElementById('availableBalance').textContent = `$${availableBalance.toFixed(2)}`;
            document.getElementById('availableBalanceKSH').textContent = `≈ KSH ${(availableBalance * usdToKsh).toFixed(0)}`;
            document.getElementById('investedBalance').textContent = `$${investedBalance.toFixed(2)}`;
            document.getElementById('investedBalanceKSH').textContent = `≈ KSH ${(investedBalance * usdToKsh).toFixed(0)}`;
            document.getElementById('crypto-available-balance').textContent = `$${availableBalance.toFixed(2)}`;
            document.getElementById('mpesa-available-balance').textContent = `KSH ${(availableBalance * usdToKsh).toFixed(0)}`;
        }

        // Fetch deposit address from server
        async function fetchDepositAddress() {
            if (!token) return;
            
            try {
                const response = await fetch(`${API_BASE}/api/deposit/address`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('deposit-address').textContent = data.address;
                    document.getElementById('address-ending').textContent = data.address.slice(-5);
                }
            } catch (err) {
                console.error('Error fetching deposit address:', err);
            }
        }

        // Load transactions
        async function loadTransactions() {
            if (!token) return;

            try {
                const response = await fetch(`${API_BASE}/api/transactions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const transactions = await response.json();
                    const tbody = document.getElementById('transaction-history');
                    const noTransactions = document.getElementById('no-transactions');
                    
                    if (transactions.length === 0) {
                        tbody.innerHTML = '';
                        noTransactions.style.display = 'block';
                        return;
                    }

                    noTransactions.style.display = 'none';
                    tbody.innerHTML = '';

                    transactions.slice(0, 5).forEach(tx => {
                        const row = document.createElement('tr');
                        const statusClass = tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                          tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                                          'bg-red-500/20 text-red-400';
                        
                        row.innerHTML = `
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                ${new Date(tx.created_at).toLocaleDateString()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium">${tx.type}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                ${tx.method}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                ${tx.currency === 'KSH' ? 'KSH' : '$'}${parseFloat(tx.amount).toLocaleString()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                                    ${tx.status}
                                </span>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                }
            } catch (err) {
                console.error('Error loading transactions:', err);
            }
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.dataset.tab;
                
                // Update active tab button
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('border-blue-500', 'text-blue-400');
                    b.classList.add('border-transparent', 'text-gray-500');
                });
                this.classList.remove('border-transparent', 'text-gray-500');
                this.classList.add('border-blue-500', 'text-blue-400');
                
                // Show/hide tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(`${tabId}-tab`).classList.remove('hidden');
            });
        });

        // Deposit method selection
        document.querySelectorAll('.deposit-method').forEach(btn => {
            btn.addEventListener('click', function() {
                // Skip if disabled
                if (this.disabled) return;
                
                const method = this.dataset.method;
                
                // Update active method button
                document.querySelectorAll('.deposit-method').forEach(b => {
                    b.classList.remove('border-2', 'border-blue-500');
                    b.classList.add('border', 'border-white/20');
                });
                this.classList.remove('border', 'border-white/20');
                this.classList.add('border-2', 'border-blue-500');
                
                // Show/hide deposit forms
                document.querySelectorAll('.deposit-form').forEach(form => {
                    form.classList.add('hidden');
                });
                document.getElementById(`${method}-deposit`).classList.remove('hidden');
            });
        });

        // Coin selection
        let selectedCoin = 'USDT';
        document.querySelectorAll('.coin-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedCoin = this.dataset.coin;
                
                // Update active coin button
                document.querySelectorAll('.coin-btn').forEach(b => {
                    b.classList.remove('border-2', 'border-blue-500');
                    b.classList.add('border', 'border-white/20');
                });
                this.classList.remove('border', 'border-white/20');
                this.classList.add('border-2', 'border-blue-500');
            });
        });

        // Network selection
        let selectedNetwork = 'BSC';
        document.querySelectorAll('.network-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedNetwork = this.dataset.network;
                
                // Update active network button
                document.querySelectorAll('.network-btn').forEach(b => {
                    b.classList.remove('border-2', 'border-blue-500');
                    b.classList.add('border', 'border-white/20');
                });
                this.classList.remove('border', 'border-white/20');
                this.classList.add('border-2', 'border-blue-500');
            });
        });

        // Withdrawal method selection
        document.querySelectorAll('.withdraw-method').forEach(btn => {
            btn.addEventListener('click', function() {
                const method = this.dataset.method;
                
                // Update active method button
                document.querySelectorAll('.withdraw-method').forEach(b => {
                    b.classList.remove('border-2', 'border-blue-500');
                    b.classList.add('border', 'border-white/20');
                });
                this.classList.remove('border', 'border-white/20');
                this.classList.add('border-2', 'border-blue-500');
                
                // Show/hide withdrawal forms
                document.querySelectorAll('.withdraw-form').forEach(form => {
                    form.classList.add('hidden');
                });
                document.getElementById(`${method}-withdraw`).classList.remove('hidden');
            });
        });

        // Copy address functionality
        document.querySelector('.copy-address').addEventListener('click', function() {
            const address = document.getElementById('deposit-address').textContent;
            navigator.clipboard.writeText(address);
            
            // Show copied notification
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });

        // Show login required modal
        function showLoginRequired() {
            document.getElementById('loginRequiredModal').classList.add('show');
        }

        // Hide login required modal
        function hideLoginRequired() {
            document.getElementById('loginRequiredModal').classList.remove('show');
        }

        // Deposit buttons
        document.getElementById('crypto-deposit-btn').addEventListener('click', async function() {
            if (!isLoggedIn) {
                showLoginRequired();
                return;
            }

            const amount = document.getElementById('crypto-amount').value;
            if (!amount || amount < 10) {
                showNotification('Please enter a valid amount (minimum $10)', 'error');
                return;
            }

            // Show loading state
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="loading"></span> Processing...';
            this.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/api/deposit`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        method: 'crypto',
                        currency: 'USD',
                        network: selectedNetwork,
                        address: document.getElementById('deposit-address').textContent
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    showNotification('Deposit request submitted successfully', 'success');
                    // Update user balance
                    user.balance = parseFloat(user.balance || 0) + parseFloat(amount);
                    localStorage.setItem('user', JSON.stringify(user));
                    updateBalances();
                    loadTransactions();
                } else {
                    showNotification(data.message || 'Deposit failed', 'error');
                }
            } catch (err) {
                showNotification('Network error. Please try again.', 'error');
            } finally {
                // Reset button state
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });

        // Withdrawal buttons
        document.getElementById('crypto-withdraw-btn').addEventListener('click', async function() {
            if (!isLoggedIn) {
                showLoginRequired();
                return;
            }

            const amount = document.getElementById('crypto-withdraw-amount').value;
            const address = document.getElementById('crypto-address').value;
            const password = document.getElementById('crypto-password').value;
            const cryptoType = document.getElementById('crypto-withdraw-type').value;
            
            if (!amount || amount < 10) {
                showNotification('Please enter a valid amount (minimum $10)', 'error');
                return;
            }
            if (!address) {
                showNotification('Please enter a valid wallet address', 'error');
                return;
            }
            if (!password) {
                showNotification('Please enter your password', 'error');
                return;
            }

            // Show loading state
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="loading"></span> Processing...';
            this.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/api/withdraw`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        method: 'crypto',
                        currency: 'USD',
                        address,
                        password
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    showNotification('Withdrawal request submitted successfully. Processing time: 1-2 business days (excluding Sundays)', 'success');
                    // Update user balance
                    user.balance = parseFloat(user.balance || 0) - parseFloat(amount);
                    localStorage.setItem('user', JSON.stringify(user));
                    updateBalances();
                    loadTransactions();
                } else {
                    showNotification(data.message || 'Withdrawal failed', 'error');
                }
            } catch (err) {
                showNotification('Network error. Please try again.', 'error');
            } finally {
                // Reset button state
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });

        document.getElementById('mpesa-withdraw-btn').addEventListener('click', async function() {
            if (!isLoggedIn) {
                showLoginRequired();
                return;
            }

            const amount = document.getElementById('mpesa-withdraw-amount').value;
            const phone = document.getElementById('mpesa-withdraw-phone').value;
            const password = document.getElementById('mpesa-password').value;
            
            if (!amount || amount < 1000) {
                showNotification('Please enter a valid amount (minimum KSH 1,000)', 'error');
                return;
            }
            if (!phone || !/^(07|01)[0-9]{8}$/.test(phone)) {
                showNotification('Please enter a valid phone number', 'error');
                return;
            }
            if (!password) {
                showNotification('Please enter your password', 'error');
                return;
            }

            // Show loading state
            const originalText = this.innerHTML;
            this.innerHTML = '<span class="loading"></span> Processing...';
            this.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/api/withdraw`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        method: 'mpesa',
                        currency: 'KSH',
                        address: phone,
                        password
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    showNotification('Withdrawal request submitted successfully. Processing time: 1-2 business days (excluding Sundays)', 'success');
                    // Update user balance (convert KSH to USD)
                    const usdAmount = parseFloat(amount) / 135;
                    user.balance = parseFloat(user.balance || 0) - usdAmount;
                    localStorage.setItem('user', JSON.stringify(user));
                    updateBalances();
                    loadTransactions();
                } else {
                    showNotification(data.message || 'Withdrawal failed', 'error');
                }
            } catch (err) {
                showNotification('Network error. Please try again.', 'error');
            } finally {
                // Reset button state
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });

        // Go to login button
        document.getElementById('goToLoginBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Cancel login button
        document.getElementById('cancelLoginBtn').addEventListener('click', () => {
            hideLoginRequired();
        });

        // View all transactions button
        document.getElementById('view-all-btn').addEventListener('click', function() {
            // In a real app, this would navigate to a full transaction history page
            showNotification('Full transaction history coming soon!', 'success');
        });

        // Notification function
        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }