
        // API Base URL
        const API_BASE = 'https://fly-io-haha.onrender.com/';
        
        // Check if user is logged in
        let token = localStorage.getItem('token');
        let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
        let isLoggedIn = !!token;

        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            const mobileMenu = document.getElementById('mobileMenu');
            mobileMenu.classList.toggle('active');
        });

        // Load user data if logged in
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
                }
                // No need to set default image here as it's already set in HTML
                
                // Check for first login bonus
                checkFirstLoginBonus();
            } else {
                document.getElementById('userBalance').classList.add('hidden');
                document.getElementById('logoutBtn').style.display = 'none';
                document.getElementById('logoutBtnMobile').style.display = 'none';
            }
        }

        // Check and award first login bonus
        function checkFirstLoginBonus() {
            const firstLoginBonusClaimed = localStorage.getItem('firstLoginBonusClaimed');
            
            if (!firstLoginBonusClaimed && user) {
                // Add bonus to user balance
                const currentBalance = parseFloat(user.balance || 0);
                const bonusAmount = 50;
                const newBalance = currentBalance + bonusAmount;
                
                // Update user data
                user.balance = newBalance;
                localStorage.setItem('user', JSON.stringify(user));
                
                // Update UI
                document.getElementById('userBalance').textContent = `${user.currency || 'KSH'} ${newBalance.toLocaleString()}`;
                
                // Mark bonus as claimed
                localStorage.setItem('firstLoginBonusClaimed', 'true');
                
                // Show success notification
                showNotification('First login bonus of KSH 50 credited to your account!', 'success');
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

        // Generate trading pair buttons
        const pairs = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","BTC/USD","XAU/USD"];
        const pairContainer = document.getElementById('pairContainer');

        pairs.forEach(pair => {
            const btn = document.createElement('button');
            btn.textContent = pair;
            btn.className = `pair-btn py-3 rounded-xl font-bold transition ${pair === 'EUR/USD' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'} text-white`;
            pairContainer.appendChild(btn);

            btn.addEventListener('click', () => {
                document.getElementById('current-pair').textContent = pair;
                // Update button styles
                document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('bg-blue-600'));
                btn.classList.add('bg-blue-600');
            });
        });

        // Generate timeframe buttons
        const timeframes = ["1m","5m","15m","1h","4h","1d"];
        const tfContainer = document.getElementById('timeframeContainer');

        timeframes.forEach(tf => {
            const btn = document.createElement('button');
            btn.textContent = tf;
            btn.className = `tf-btn px-4 py-2 rounded-lg text-sm font-medium ${tf === '1h' ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'} text-white`;
            tfContainer.appendChild(btn);

            btn.addEventListener('click', () => {
                tfContainer.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('bg-blue-600'));
                btn.classList.add('bg-blue-600');
            });
        });

        // Chart setup
        const ctx = document.getElementById('priceChart').getContext('2d');
        let chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(50).fill(''),
                datasets: [{
                    data: Array(50).fill(1.085).map((p, i) => p + Math.sin(i/5)*0.005 + Math.random()*0.002),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    x: { display: false }, 
                    y: { 
                        display: true, 
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: {
                            color: 'rgba(255,255,255,0.7)'
                        }
                    } 
                },
                plugins: { 
                    legend: { display: false } 
                }
            }
        });

        // Live price update
        setInterval(() => {
            const change = (Math.random() - 0.5) * 0.0005;
            const newPrice = (parseFloat(document.getElementById('live-price').textContent) + change).toFixed(5);
            document.getElementById('live-price').textContent = newPrice;

            // Update chart
            chart.data.datasets[0].data.shift();
            chart.data.datasets[0].data.push(parseFloat(newPrice));
            chart.update('none');
        }, 2000);

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

        // Show login required modal
        function showLoginRequired() {
            document.getElementById('loginRequiredModal').classList.add('show');
        }

        // Hide login required modal
        function hideLoginRequired() {
            document.getElementById('loginRequiredModal').classList.remove('show');
        }

        // Show trade execution modal
        function showTradeExecution(type, amount, leverage) {
            document.getElementById('tradePair').textContent = document.getElementById('current-pair').textContent;
            document.getElementById('tradeType').textContent = type;
            document.getElementById('tradeAmount').textContent = `$${parseInt(amount).toLocaleString()}`;
            document.getElementById('tradeLeverage').textContent = leverage;
            document.getElementById('tradeExecutionModal').classList.add('active');
        }

        // Hide trade execution modal
        function hideTradeExecution() {
            document.getElementById('tradeExecutionModal').classList.remove('active');
        }

        // Function to execute a trade
        async function executeTrade(type, amount, leverage, stopLoss, takeProfit) {
            if (!isLoggedIn) {
                showLoginRequired();
                return;
            }
            
            if (!amount || amount <= 0) {
                showNotification('Please enter a valid amount', 'error');
                return;
            }

            try {
                // For demo purposes, we'll simulate a trade execution
                // In a real app, this would call your API
                
                // Simulate API call delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Calculate potential profit/loss (simplified)
                const currentPrice = parseFloat(document.getElementById('live-price').textContent);
                const priceChange = type === 'BUY' ? 
                    (Math.random() * 0.002) : // Random increase for buy
                    -(Math.random() * 0.002); // Random decrease for sell
                
                const newPrice = currentPrice + priceChange;
                const profitLoss = type === 'BUY' ? 
                    (amount * leverage * (newPrice - currentPrice) / currentPrice) :
                    (amount * leverage * (currentPrice - newPrice) / currentPrice);
                
                // Update user balance
                const currentBalance = parseFloat(user.balance || 0);
                const newBalance = currentBalance + profitLoss;
                
                // Update user data in localStorage
                user.balance = newBalance;
                localStorage.setItem('user', JSON.stringify(user));
                
                // Update UI
                document.getElementById('userBalance').textContent = `${user.currency || 'KSH'} ${newBalance.toLocaleString()}`;
                
                // Show trade execution modal
                showTradeExecution(type, amount, leverage);
                
                // Add trade to open positions
                addOpenPosition(
                    document.getElementById('current-pair').textContent,
                    type,
                    amount,
                    currentPrice,
                    newPrice,
                    stopLoss,
                    takeProfit,
                    profitLoss
                );
                
                return true;
            } catch (error) {
                console.error('Trade execution error:', error);
                showNotification('Failed to execute trade. Please try again.', 'error');
                return false;
            }
        }

        // Function to add a new position to open positions
        function addOpenPosition(pair, type, amount, openPrice, currentPrice, stopLoss, takeProfit, profitLoss) {
            const openPositionsContainer = document.getElementById('openPositions');
            
            const positionCard = document.createElement('div');
            positionCard.className = 'bg-white/10 rounded-xl p-4';
            
            const profitClass = profitLoss >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const profitSign = profitLoss >= 0 ? '+' : '';
            
            positionCard.innerHTML = `
                <div class="flex justify-between">
                    <div>
                        <h3 class="font-medium text-gray-900">${pair}</h3>
                        <p class="text-sm text-gray-400">${type} • ${amount} USD</p>
                    </div>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${profitClass}">
                        ${profitSign}$${Math.abs(profitLoss).toFixed(2)}
                    </span>
                </div>
                <div class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between"><span class="text-gray-400">Open Price:</span><span>${openPrice.toFixed(5)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Current Price:</span><span>${currentPrice.toFixed(5)}</span></div>
                    ${stopLoss ? `<div class="flex justify-between"><span class="text-gray-400">Stop Loss:</span><span>${stopLoss}</span></div>` : ''}
                    ${takeProfit ? `<div class="flex justify-between"><span class="text-gray-400">Take Profit:</span><span>${takeProfit}</span></div>` : ''}
                </div>
                <button class="mt-2 text-sm text-red-600 hover:text-red-800 close-position-btn">Close Position</button>
            `;
            
            // Add event listener to close button
            const closeBtn = positionCard.querySelector('.close-position-btn');
            closeBtn.addEventListener('click', function() {
                closePosition(positionCard, profitLoss);
            });
            
            openPositionsContainer.prepend(positionCard);
        }

        // Function to close a position
        function closePosition(positionCard, profitLoss) {
            // Update user balance
            const currentBalance = parseFloat(user.balance || 0);
            const newBalance = currentBalance + profitLoss;
            
            // Update user data in localStorage
            user.balance = newBalance;
            localStorage.setItem('user', JSON.stringify(user));
            
            // Update UI
            document.getElementById('userBalance').textContent = `${user.currency || 'KSH'} ${newBalance.toLocaleString()}`;
            
            // Remove position card
            positionCard.remove();
            
            // Show notification
            showNotification(`Position closed. ${profitLoss >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(profitLoss).toFixed(2)}`, profitLoss >= 0 ? 'success' : 'error');
        }

        // Buy button click handler
        document.querySelector('.buy-btn').addEventListener('click', function(e) {
            const amount = document.getElementById('trade-amount').value;
            const leverage = document.getElementById('leverage').value;
            const stopLoss = document.getElementById('stop-loss').value;
            const takeProfit = document.getElementById('take-profit').value;
            
            executeTrade('BUY', amount, leverage, stopLoss, takeProfit);
        });

        // Sell button click handler
        document.querySelector('.sell-btn').addEventListener('click', function(e) {
            const amount = document.getElementById('trade-amount').value;
            const leverage = document.getElementById('leverage').value;
            const stopLoss = document.getElementById('stop-loss').value;
            const takeProfit = document.getElementById('take-profit').value;
            
            executeTrade('SELL', amount, leverage, stopLoss, takeProfit);
        });

        // Go to login button
        document.getElementById('goToLoginBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Cancel login button
        document.getElementById('cancelLoginBtn').addEventListener('click', () => {
            hideLoginRequired();
        });

        // Close trade modal button
        document.getElementById('closeTradeModal').addEventListener('click', () => {
            hideTradeExecution();
        });

        // Pair buttons
        document.querySelectorAll('.pair-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('bg-blue-600'));
                btn.classList.add('bg-blue-600');
                document.getElementById('current-pair').textContent = btn.textContent;
            });
        });

        // Timeframe buttons
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('bg-blue-600'));
                btn.classList.add('bg-blue-600');
            });
        });

        // Trading tools click handlers
        document.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => {
                const toolName = card.querySelector('p').textContent;
                showNotification(`${toolName} feature coming soon!`, 'warning');
            });
        });

        // Add close position functionality to existing positions
        document.querySelectorAll('#openPositions button').forEach(btn => {
            btn.addEventListener('click', function() {
                const positionCard = this.closest('.bg-white\\/10');
                const profitText = positionCard.querySelector('.bg-green-100, .bg-red-100').textContent;
                const profitLoss = parseFloat(profitText.replace(/[^0-9.-]+/g, ''));
                closePosition(positionCard, profitLoss);
            });
        });
   