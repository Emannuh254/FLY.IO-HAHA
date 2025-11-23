// dashboard.js - Fixed authentication and bot loading
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        // User elements
        userName: document.getElementById('userName'),
        totalBalance: document.getElementById('totalBalance'),
        totalProfit: document.getElementById('totalProfit'),
        activeBots: document.getElementById('activeBots'),
        referrals: document.getElementById('referrals'),
        userImageContainer: document.getElementById('userImageContainer'),
        mobileUserImageContainer: document.getElementById('mobileUserImageContainer'),
        logoutBtn: document.getElementById('logoutBtn'),
        mobileLogoutBtn: document.getElementById('mobileLogoutBtn'),
        userAvatar: document.getElementById('userAvatar'),
        mobileUserAvatar: document.getElementById('mobileUserAvatar'),
        imageUpload: document.getElementById('imageUpload'),
        mobileProfileLink: document.getElementById('mobileProfileLink'),
        
        // Bot elements
        botsContainer: document.getElementById('bots-container'),
        refreshBotsBtn: document.getElementById('refreshBotsBtn'),
        addBotBtn: document.getElementById('addBotBtn'),
        signupPrompt: document.getElementById('signupPrompt'),
        signupPromptBtn: document.getElementById('signupPromptBtn'),
        
        // Modals
        authModal: document.getElementById('authModal'),
        addBotModal: document.getElementById('addBotModal'),
        addBotForm: document.getElementById('addBotForm'),
        closeModal: document.getElementById('closeModal'),
        closeAddBotModal: document.getElementById('closeAddBotModal'),
        cancelAddBot: document.getElementById('cancelAddBot'),
        signInBtn: document.getElementById('signInBtn'),
        signUpBtn: document.getElementById('signUpBtn'),
        
        // Bonus
        dailyBonus: document.getElementById('dailyBonus'),
        claimBonusBtn: document.getElementById('claimBonusBtn'),
        
        // Other
        whatsappBtn: document.getElementById('whatsappBtn'),
        notification: document.getElementById('notification'),
        certName: document.getElementById('certName'),
        certId: document.getElementById('certId'),
        kraPin: document.getElementById('kraPin'),
        certCode: document.getElementById('certCode')
    };
    
    // API Configuration
    const API_BASE = 'https://fly-io-haha.onrender.com/';
    const BOT_API_BASE = 'https://fly-io-haha.onrender.com/'; // Same base for bot API
    let authToken = localStorage.getItem('authToken');
    let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    
    // Initialize
    async function init() {
        console.log('Initializing dashboard...');
        console.log('Initial auth state:', { 
            authToken: authToken ? 'Present' : 'Missing', 
            user: user ? 'Present' : 'Missing',
            userEmail: user ? user.email : 'N/A'
        });
        
        // Check authentication status first
        await checkAuthStatus();
        
        // Load user data
        loadUserData();
        
        // Load bots
        loadBots();
        
        // Generate certificate details
        generateCertificateDetails();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up bot simulation interval (for real bots)
        setupBotSimulation();
        
        console.log('Dashboard initialized');
    }
    
    // Set up bot simulation for real user bots
    function setupBotSimulation() {
        // Only run simulation if user is logged in
        if (!authToken) return;
        
        // Simulate bot progress every 30 seconds
        setInterval(() => {
            simulateRealBots();
        }, 30000);
    }
    
    // Simulate progress for real user bots
    async function simulateRealBots() {
        if (!authToken) return;
        
        try {
            // Get user's bots
            const response = await apiRequest('/api/bots');
            if (!response) return;
            
            const bots = await response.json();
            
            // Only simulate active bots that aren't completed
            const activeBots = bots.filter(bot => bot.status !== 'completed' && bot.progress < 100);
            
            if (activeBots.length === 0) return;
            
            // Simulate progress for each active bot
            for (const bot of activeBots) {
                try {
                    // Call simulation endpoint
                    const simResponse = await fetch(`${BOT_API_BASE}api/bots/${bot.id}/simulate`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (simResponse.ok) {
                        const result = await simResponse.json();
                        console.log(`Bot ${bot.name} simulated: ${result.progress}%`);
                        
                        // If bot completed, show notification
                        if (result.completed) {
                            showNotification(`Bot "${bot.name}" has completed! Profits credited to your account.`, 'success');
                            // Refresh user data and bots
                            loadUserData();
                            loadBots();
                        }
                    }
                } catch (err) {
                    console.error(`Error simulating bot ${bot.id}:`, err);
                }
            }
        } catch (err) {
            console.error('Error in bot simulation:', err);
        }
    }
    
    // Check if user is authenticated
    async function checkAuthStatus() {
        console.log('Checking authentication status...');
        
        if (!authToken) {
            console.log('No auth token found, skipping auth check');
            return;
        }
        
        // Check if this is a demo token (contains demo_signature)
        if (authToken.includes('demo_signature')) {
            console.log('Demo token detected, skipping API verification');
            // For demo tokens, we already have the user data in localStorage
            // No need to verify with the API
            return;
        }
        
        try {
            console.log('Making API request to /api/user/profile');
            const response = await apiRequest('/api/user/profile');
            
            if (response && response.ok) {
                const userData = await response.json();
                console.log('User data received:', userData);
                
                // Update user data
                user = userData;
                localStorage.setItem('user', JSON.stringify(user));
                console.log('User data updated in localStorage');
            } else {
                console.log('Auth check failed with status:', response.status);
                // Only logout on 401 Unauthorized
                if (response.status === 401) {
                    console.log('Token expired or invalid, logging out');
                    logout();
                }
            }
        } catch (e) {
            console.warn('Auth check failed with exception:', e);
            // Don't logout for network errors - keep existing user data
            console.log('Network error, keeping existing user data');
        }
    }
    
    // Load user data based on authentication status
    function loadUserData() {
        console.log('Loading user data...');
        console.log('Current auth state:', { 
            authToken: authToken ? 'Present' : 'Missing', 
            user: user ? 'Present' : 'Missing',
            userEmail: user ? user.email : 'N/A'
        });
        
        // Check both authToken and user to ensure valid session
        if (authToken && user) {
            console.log('User is authenticated, loading user data');
            
            // User is logged in
            const username = getUsernameFromEmail(user.email);
            elements.userName.textContent = username;
            elements.totalBalance.textContent = `KSH ${parseFloat(user.balance || 0).toLocaleString()}`;
            elements.totalProfit.textContent = `KSH ${parseFloat(user.profit || 0).toLocaleString()}`;
            elements.activeBots.textContent = user.active_bots || 0;
            elements.referrals.textContent = user.referrals || 0;
            
            // Render user avatar
            const savedPhoto = localStorage.getItem('forexpro_profile');
            renderUserAvatar(savedPhoto || user.profile_image);
            
            // Update certificate with user data
            elements.certName.textContent = user.name || username;
            
            // Show logout buttons
            elements.logoutBtn.classList.remove('hidden');
            elements.mobileLogoutBtn.classList.remove('hidden');
            
            // Hide signup prompt
            elements.signupPrompt.classList.add('hidden');
            
            // Update mobile profile link to logout
            elements.mobileProfileLink.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
            elements.mobileProfileLink.onclick = logout;
            
            // Check for daily login bonus
            checkDailyBonus();
            
            console.log('User data loaded successfully');
        } else {
            console.log('User is not authenticated, loading guest data');
            
            // User is not logged in
            elements.userName.textContent = 'Guest';
            elements.totalBalance.textContent = 'KSH 0';
            elements.totalProfit.textContent = 'KSH 0';
            elements.activeBots.textContent = '0';
            elements.referrals.textContent = '0';
            
            // Render default avatar
            renderUserAvatar(null);
            
            // Update certificate with guest data
            elements.certName.textContent = 'Guest User';
            
            // Hide logout buttons
            elements.logoutBtn.classList.add('hidden');
            elements.mobileLogoutBtn.classList.add('hidden');
            
            // Show signup prompt
            elements.signupPrompt.classList.remove('hidden');
            
            // Reset mobile profile link
            elements.mobileProfileLink.innerHTML = '<i class="fas fa-user"></i><span>Profile</span>';
            elements.mobileProfileLink.onclick = null;
            
            console.log('Guest data loaded');
        }
    }
    
    // API request helper function
    function apiRequest(endpoint, options = {}) {
        console.log(`Making API request to: ${endpoint}`);
        
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
            .then(response => {
                console.log(`API response status for ${endpoint}:`, response.status);
                
                if (response.status === 401) {
                    // Check if this is a demo token
                    if (authToken && authToken.includes('demo_signature')) {
                        console.log('Received 401 for demo token, ignoring');
                        // Return a mock response for demo mode
                        return {
                            ok: false,
                            status: 401,
                            json: () => Promise.resolve({ message: 'Demo token not recognized by server' })
                        };
                    } else {
                        console.log('Received 401 Unauthorized, logging out');
                        logout();
                        return Promise.reject('Unauthorized');
                    }
                }
                return response;
            })
            .catch(error => {
                console.error(`API request failed for ${endpoint}:`, error);
                throw error;
            });
    }
    
    // Load trading bots
    async function loadBots() {
        elements.botsContainer.innerHTML = '<div class="col-span-full text-center py-8"><div class="loading-spinner"></div> Loading bots...</div>';

        try {
            let userBots = [];
            
            if (authToken) {
                // For demo tokens, we'll use mock bots
                if (authToken.includes('demo_signature')) {
                    console.log('Using demo bots for demo token');
                    userBots = [
                        {
                            id: 1,
                            name: 'Demo Trading Bot',
                            investment: 1000,
                            daily_profit: 50,
                            total_profit: 1500,
                            progress: 50,
                            status: 'active',
                            currency: 'KSH',
                            image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0'
                        }
                    ];
                } else {
                    // Load user's bots from server
                    const response = await apiRequest('/api/bots');
                    
                    if (response && response.ok) {
                        userBots = await response.json();
                    } else if (response && response.status === 401) {
                        // Token expired or invalid
                        logout();
                        return;
                    }
                }
            }
            
            elements.botsContainer.innerHTML = "";

            if (userBots.length === 0) {
                // Show message when user has no bots
                elements.botsContainer.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i class="fas fa-robot text-4xl mb-3 text-blue-400"></i>
                        <p class="text-lg">You don't have any trading bots yet.</p>
                        <p class="text-gray-400 mt-2">Click "Add Bot" to create your first trading bot and start earning!</p>
                    </div>
                `;
            } else {
                // Display user's bots
                userBots.forEach(bot => {
                    const profitPercent = Math.round(((bot.total_profit - bot.investment) / bot.investment) * 100);
                    const isCompleted = bot.status === 'completed' || bot.progress >= 100;
                    
                    const card = document.createElement('div');
                    card.className = `bot-card ${isCompleted ? 'completed-bot' : ''}`;
                    
                    card.innerHTML = `
                        <div class="bot-card-header">
                            <img src="${bot.image_url || 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0'}" alt="${bot.name}">
                            <div class="bot-card-title">${bot.name}</div>
                            <div class="bot-status ${isCompleted ? 'completed' : 'active'}">
                                ${isCompleted ? 'COMPLETED' : 'ACTIVE'}
                            </div>
                        </div>
                        <div class="bot-stats">
                            <div class="bot-stat">
                                <span class="bot-stat-label">Invested:</span>
                                <span class="bot-stat-value">${formatCurrency(bot.investment, bot.currency || 'KSH')}</span>
                            </div>
                            <div class="bot-stat">
                                <span class="bot-stat-label">Daily Profit:</span>
                                <span class="bot-stat-value text-blue-400">${formatCurrency(bot.daily_profit, bot.currency || 'KSH')}</span>
                            </div>
                            <div class="bot-stat">
                                <span class="bot-stat-label">Expected Total:</span>
                                <span class="bot-stat-value text-blue-400 font-bold">${formatCurrency(bot.total_profit, bot.currency || 'KSH')}</span>
                            </div>
                            <div class="bot-stat">
                                <span class="bot-stat-label">Return:</span>
                                <span class="bot-stat-value text-blue-400">${profitPercent}%</span>
                            </div>
                            <div class="bot-progress">
                                <div class="bot-progress-bar">
                                    <div class="bot-progress-fill" style="width: ${bot.progress}%"></div>
                                </div>
                                <div class="bot-progress-info">
                                    <span>30-Day Cycle</span>
                                    <span>${bot.progress}% Complete</span>
                                </div>
                            </div>
                            ${!isCompleted ? `
                            <div class="bot-actions mt-3">
                                <button class="simulate-btn btn btn-primary btn-sm" data-bot-id="${bot.id}">
                                    <i class="fas fa-play mr-1"></i> Simulate Progress
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    
                    elements.botsContainer.appendChild(card);
                });
                
                // Add event listeners to simulate buttons
                document.querySelectorAll('.simulate-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const botId = this.getAttribute('data-bot-id');
                        simulateBotProgress(botId);
                    });
                });
            }
        } catch (err) {
            console.error('Error loading bots:', err);
            elements.botsContainer.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                    <p>Failed to load bots. Please try again later.</p>
                </div>
            `;
            showNotification('Failed to load bots. Please try again later.', 'error');
        }
    }
    
    // Simulate progress for a specific bot
    async function simulateBotProgress(botId) {
        if (!authToken) {
            elements.authModal.classList.add('show');
            return;
        }
        
        try {
            // For demo tokens, simulate progress locally
            if (authToken.includes('demo_signature')) {
                console.log('Simulating bot progress locally for demo token');
                showNotification('Bot progress updated to 60%', 'success');
                loadBots();
                return;
            }
            
            const response = await fetch(`${BOT_API_BASE}api/bots/${botId}/simulate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(`Bot progress updated to ${result.progress}%`, 'success');
                
                // If bot completed, show special notification
                if (result.completed) {
                    showNotification(`Bot has completed! Profits credited to your account.`, 'success');
                    // Refresh user data and bots
                    loadUserData();
                }
                
                // Refresh bots to show updated progress
                loadBots();
            } else {
                throw new Error('Failed to simulate bot progress');
            }
        } catch (err) {
            console.error('Error simulating bot progress:', err);
            showNotification('Failed to simulate bot progress. Please try again.', 'error');
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Logout functionality
        elements.logoutBtn.addEventListener('click', logout);
        elements.mobileLogoutBtn.addEventListener('click', logout);
        
        // Photo upload
        elements.userAvatar.addEventListener('click', () => {
            if (!user) {
                elements.authModal.classList.add('show');
                return;
            }
            elements.imageUpload.click();
        });
        
        elements.mobileUserAvatar.addEventListener('click', () => {
            if (!user) {
                elements.authModal.classList.add('show');
                return;
            }
            elements.imageUpload.click();
        });
        
        elements.imageUpload.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const newImg = ev.target.result;
                    renderUserAvatar(newImg);
                    localStorage.setItem('forexpro_profile', newImg);
                    showNotification('Profile photo updated!', 'success');
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
        
        // Daily bonus claim
        elements.claimBonusBtn.addEventListener('click', claimDailyBonus);
        
        // Refresh bots
        elements.refreshBotsBtn.addEventListener('click', refreshData);
        
        // Add bot button
        elements.addBotBtn.addEventListener('click', () => {
            if (!authToken) {
                elements.authModal.classList.add('show');
                return;
            }
            elements.addBotModal.classList.add('show');
        });
        
        // Add bot form submission
        elements.addBotForm.addEventListener('submit', handleAddBotSubmit);
        
        // Investment plan buttons
        document.querySelectorAll('.invest-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (!authToken) {
                    elements.authModal.classList.add('show');
                    return;
                }

                const price = this.getAttribute('data-price');
                const planName = this.getAttribute('data-plan');
                
                // Create a bot with the plan name and investment amount
                createBot(planName, price);
            });
        });
        
        // Auth modal
        elements.closeModal.addEventListener('click', () => {
            elements.authModal.classList.remove('show');
        });
        
        elements.signInBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        
        elements.signUpBtn.addEventListener('click', () => {
            window.location.href = 'index.html#signup';
        });
        
        // Signup prompt button
        elements.signupPromptBtn.addEventListener('click', () => {
            window.location.href = 'index.html#signup';
        });
        
        // WhatsApp button
        elements.whatsappBtn.addEventListener('click', () => {
            const phoneNumber = '254739119490';
            const message = 'I need assistance from your website';
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });
        
        // Add bot modal close buttons
        elements.closeAddBotModal.addEventListener('click', () => {
            elements.addBotModal.classList.remove('show');
            elements.addBotForm.reset();
        });
        
        elements.cancelAddBot.addEventListener('click', () => {
            elements.addBotModal.classList.remove('show');
            elements.addBotForm.reset();
        });
    }
    
    // Handle add bot form submission
    function handleAddBotSubmit(e) {
        e.preventDefault();
        
        const botName = document.getElementById('botName').value;
        const botInvestment = document.getElementById('botInvestment').value;
        const botImage = document.getElementById('botImage').value;
        
        // Close the modal
        elements.addBotModal.classList.remove('show');
        
        // Create the bot
        createBot(botName, botInvestment, botImage);
        
        // Reset the form
        elements.addBotForm.reset();
    }
    
    // Create a new bot
    function createBot(name, investment, imageUrl) {
        // Show loading state
        showNotification('Creating bot...', 'success');
        
        // For demo tokens, simulate bot creation
        if (authToken && authToken.includes('demo_signature')) {
            console.log('Creating demo bot');
            setTimeout(() => {
                showNotification('Demo bot created successfully!', 'success');
                loadBots();
            }, 1000);
            return;
        }
        
        apiRequest('/api/bots', {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                investment: parseFloat(investment),
                image_url: imageUrl
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to create bot');
            }
            return response.json();
        })
        .then(data => {
            showNotification(data.message, 'success');
            // Refresh bots and user data
            loadUserData();
            loadBots();
        })
        .catch(err => {
            console.error('Error creating bot:', err);
            showNotification('Failed to create bot. Please try again.', 'error');
        });
    }
    
    // Refresh user data and bots
    function refreshData() {
        const icon = elements.refreshBotsBtn.querySelector('i');
        icon.classList.add('fa-spin');
        
        // For demo tokens, simulate refresh
        if (authToken && authToken.includes('demo_signature')) {
            console.log('Refreshing demo data');
            setTimeout(() => {
                showNotification('Data refreshed successfully!', 'success');
                icon.classList.remove('fa-spin');
            }, 1000);
            return;
        }
        
        // Refresh user data first
        if (authToken) {
            apiRequest('/api/user/profile')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch user data');
                    }
                    return response.json();
                })
                .then(userData => {
                    // Update user data
                    user = userData;
                    localStorage.setItem('user', JSON.stringify(user));
                    loadUserData();
                    
                    // Then load bots
                    return loadBots();
                })
                .then(() => {
                    showNotification('Data refreshed successfully!', 'success');
                })
                .catch(err => {
                    console.error('Error refreshing data:', err);
                    showNotification('Failed to refresh data. Please try again.', 'error');
                })
                .finally(() => {
                    icon.classList.remove('fa-spin');
                });
        } else {
            // Just refresh bots for non-logged in users
            loadBots().then(() => {
                showNotification('Data refreshed successfully!', 'success');
                icon.classList.remove('fa-spin');
            });
        }
    }
    
    // Claim daily bonus
    function claimDailyBonus() {
        if (user) {
            // Simulate adding bonus to user balance
            const currentBalance = parseFloat(user.balance || 0);
            const bonusAmount = 50;
            const newBalance = currentBalance + bonusAmount;
            
            // Update user data
            user.balance = newBalance;
            localStorage.setItem('user', JSON.stringify(user));
            
            // Update UI
            elements.totalBalance.textContent = `KSH ${newBalance.toLocaleString()}`;
            
            // Mark bonus as claimed
            localStorage.setItem('dailyBonusClaimed', 'true');
            
            // Hide bonus notification
            elements.dailyBonus.classList.remove('show');
            
            // Show success notification
            showNotification('Daily bonus of KSH 50 claimed successfully!', 'success');
        }
    }
    
    // Check and award daily login bonus
    function checkDailyBonus() {
        const today = new Date().toDateString();
        const lastLogin = localStorage.getItem('lastLoginDate');
        const bonusClaimed = localStorage.getItem('dailyBonusClaimed');
        
        if (lastLogin !== today) {
            // New day login
            localStorage.setItem('lastLoginDate', today);
            localStorage.setItem('dailyBonusClaimed', 'false');
            
            // Show daily bonus notification
            setTimeout(() => {
                elements.dailyBonus.classList.add('show');
            }, 1000);
        } else if (bonusClaimed === 'false') {
            // Same day but bonus not claimed yet
            setTimeout(() => {
                elements.dailyBonus.classList.add('show');
            }, 1000);
        }
    }
    
    // Logout function
    function logout() {
        console.log('Logging out user');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        authToken = null;
        user = null;
        loadUserData();
        loadBots();
        showNotification('Logged out successfully', 'success');
    }
    
    // Helper function to extract username from email
    function getUsernameFromEmail(email) {
        if (!email) return 'Guest';
        return email.split('@')[0];
    }
    
    // Function to render user avatar
    function renderUserAvatar(imageUrl) {
        if (imageUrl) {
            elements.userImageContainer.innerHTML = `<img src="${imageUrl}" alt="You" class="w-10 h-10 rounded-full ring-2 ring-blue-400">`;
            elements.mobileUserImageContainer.innerHTML = `<img src="${imageUrl}" alt="You" class="w-10 h-10 rounded-full ring-2 ring-blue-400">`;
        } else {
            const avatarHtml = `
                <div class="default-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
            `;
            elements.userImageContainer.innerHTML = avatarHtml;
            elements.mobileUserImageContainer.innerHTML = avatarHtml;
        }
    }
    
    // Generate cool bot names
    function generateBotNames() {
        const prefixes = ['Crypto', 'Quantum', 'Nexus', 'Apex', 'Prime', 'Ultra', 'Mega', 'Hyper', 'Max', 'Elite'];
        const suffixes = ['Miner', 'Trader', 'Bot', 'Pro', 'Master', 'Expert', 'Genius', 'Wizard', 'Ninja', 'Guru'];
        const specialWords = ['Satoshi', 'Nakamoto', 'Blockchain', 'Bitcoin', 'Ethereum', 'Litecoin', 'Ripple', 'Stellar', 'Cardano', 'Polkadot'];
        
        const names = [];
        
        // Generate 10 unique names
        while (names.length < 10) {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            const special = specialWords[Math.floor(Math.random() * specialWords.length)];
            
            // Combine in different ways
            const namePatterns = [
                `${prefix} ${special} ${suffix}`,
                `${special} ${prefix} ${suffix}`,
                `${prefix}${special}${suffix}`,
                `${special} ${prefix}`
            ];
            
            const name = namePatterns[Math.floor(Math.random() * namePatterns.length)];
            
            if (!names.includes(name)) {
                names.push(name);
            }
        }
        
        return names;
    }
    
    // Format currency
    function formatCurrency(amount, currency = 'KSH') {
        if (currency === 'USD') {
            return `$${parseFloat(amount).toFixed(2)}`;
        } else {
            return `KSH ${parseFloat(amount).toLocaleString()}`;
        }
    }
    
    // Generate certificate details
    function generateCertificateDetails() {
        // Generate random certificate ID
        const certId = Math.floor(100000 + Math.random() * 900000);
        elements.certId.textContent = certId;
        
        // Set KRA PIN (visibly fake)
        elements.kraPin.textContent = 'P012345678Q';
        
        // Generate random verification code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let certCode = 'FX-';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) certCode += '-';
            certCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        elements.certCode.textContent = certCode;
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
    
    // Initialize dashboard when DOM is loaded
    init();
});