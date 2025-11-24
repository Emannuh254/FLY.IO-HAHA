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
        
        // Bot elements
        botsContainer: document.getElementById('bots-container'),
        availableBotsContainer: document.getElementById('available-bots-container'),
        refreshBotsBtn: document.getElementById('refreshBotsBtn'),
        addBotBtn: document.getElementById('addBotBtn'),
        addBotModal: document.getElementById('addBotModal'),
        closeAddBotModal: document.getElementById('closeAddBotModal'),
        cancelAddBot: document.getElementById('cancelAddBot'),
        addBotForm: document.getElementById('addBotForm'),
        
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
    const API_BASE = 'http://localhost:3006'; // Dashboard server port
    let authToken = localStorage.getItem('authToken');
    let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    
    // Initialize
    async function init() {
        console.log('Initializing dashboard...');
        
        // Check authentication status first
        await checkAuthStatus();
        
        // If not authenticated, redirect to login
        if (!authToken || !user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Load user data
        loadUserData();
        
        // Load user's bots
        loadUserBots();
        
        // Load available bots for purchase
        loadAvailableBots();
        
        // Generate certificate details
        generateCertificateDetails();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('Dashboard initialized');
    }
    
    // Check if user is authenticated
    async function checkAuthStatus() {
        console.log('Checking authentication status...');
        
        if (!authToken) {
            console.log('No auth token found');
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
        
        if (user) {
            console.log('User is authenticated, loading user data');
            
            // User is logged in
            const username = getUsernameFromEmail(user.email);
            elements.userName.textContent = user.name || username;
            elements.totalBalance.textContent = `${user.currency || 'KSH'} ${parseFloat(user.balance || 0).toLocaleString()}`;
            elements.totalProfit.textContent = `${user.currency || 'KSH'} ${parseFloat(user.profit || 0).toLocaleString()}`;
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
            
            // Check for daily login bonus
            checkDailyBonus();
            
            console.log('User data loaded successfully');
        } else {
            console.log('User is not authenticated, redirecting to login');
            window.location.href = 'index.html';
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
                    console.log('Received 401 Unauthorized, logging out');
                    logout();
                    return Promise.reject('Unauthorized');
                }
                return response;
            })
            .catch(error => {
                console.error(`API request failed for ${endpoint}:`, error);
                throw error;
            });
    }
    
    // Load user's trading bots
    async function loadUserBots() {
        if (!elements.botsContainer) return;
        
        elements.botsContainer.innerHTML = '<div class="col-span-full text-center py-8"><div class="loading-spinner"></div> Loading your bots...</div>';

        try {
            const response = await apiRequest('/api/user/bots');
            
            if (response && response.ok) {
                const data = await response.json();
                const userBots = data.bots || [];
                
                elements.botsContainer.innerHTML = "";

                if (userBots.length === 0) {
                    // Show message when user has no bots
                    elements.botsContainer.innerHTML = `
                        <div class="col-span-full text-center py-8">
                            <i class="fas fa-robot text-4xl mb-3 text-blue-400"></i>
                            <p class="text-lg">You don't have any trading bots yet.</p>
                            <p class="text-gray-400 mt-2">Purchase a bot from the available bots below to start earning!</p>
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
                            </div>
                        `;
                        
                        elements.botsContainer.appendChild(card);
                    });
                }
            } else if (response && response.status === 401) {
                // Token expired or invalid
                logout();
                return;
            }
        } catch (err) {
            console.error('Error loading user bots:', err);
            elements.botsContainer.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                    <p>Failed to load your bots. Please try again later.</p>
                </div>
            `;
            showNotification('Failed to load your bots. Please try again later.', 'error');
        }
    }
    
    // Load available bots for purchase
    async function loadAvailableBots() {
        if (!elements.availableBotsContainer) return;
        
        elements.availableBotsContainer.innerHTML = '<div class="col-span-full text-center py-8"><div class="loading-spinner"></div> Loading available bots...</div>';

        try {
            const response = await apiRequest('/api/admin/bot-templates');
            
            if (response && response.ok) {
                const data = await response.json();
                const availableBots = data.bots || [];
                
                elements.availableBotsContainer.innerHTML = "";

                if (availableBots.length === 0) {
                    // Show message when no bots are available
                    elements.availableBotsContainer.innerHTML = `
                        <div class="col-span-full text-center py-8">
                            <i class="fas fa-robot text-4xl mb-3 text-blue-400"></i>
                            <p class="text-lg">No trading bots are currently available for purchase.</p>
                            <p class="text-gray-400 mt-2">Please check back later.</p>
                        </div>
                    `;
                } else {
                    // Display available bots
                    availableBots.forEach(bot => {
                        const card = document.createElement('div');
                        card.className = 'bot-card';
                        
                        card.innerHTML = `
                            <div class="bot-card-header">
                                <img src="${bot.image_url || 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0'}" alt="${bot.name}">
                                <div class="bot-card-title">${bot.name}</div>
                                <div class="bot-status available">AVAILABLE</div>
                            </div>
                            <div class="bot-stats">
                                <div class="bot-stat">
                                    <span class="bot-stat-label">Price:</span>
                                    <span class="bot-stat-value">${formatCurrency(bot.price, bot.currency || 'KSH')}</span>
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
                                    <span class="bot-stat-value text-blue-400">${Math.round(((bot.total_profit - bot.price) / bot.price) * 100)}%</span>
                                </div>
                                <div class="bot-actions mt-3">
                                    <button class="buy-bot-btn btn btn-primary btn-sm" data-bot-id="${bot.id}">
                                        <i class="fas fa-shopping-cart mr-1"></i> Purchase Bot
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        elements.availableBotsContainer.appendChild(card);
                    });
                    
                    // Add event listeners to buy buttons
                    document.querySelectorAll('.buy-bot-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const botId = this.getAttribute('data-bot-id');
                            purchaseBot(botId);
                        });
                    });
                }
            }
        } catch (err) {
            console.error('Error loading available bots:', err);
            elements.availableBotsContainer.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-400">
                    <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                    <p>Failed to load available bots. Please try again later.</p>
                </div>
            `;
            showNotification('Failed to load available bots. Please try again later.', 'error');
        }
    }
    
    // Purchase a bot
    async function purchaseBot(botId) {
        try {
            const response = await apiRequest('/api/user/bots/buy', {
                method: 'POST',
                body: JSON.stringify({ template_id: botId })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                showNotification(data.message, 'success');
                
                // Refresh user data and bots
                loadUserData();
                loadUserBots();
                loadAvailableBots();
            } else {
                const errorData = await response.json();
                showNotification(errorData.message || 'Failed to purchase bot', 'error');
            }
        } catch (err) {
            console.error('Error purchasing bot:', err);
            showNotification('Failed to purchase bot. Please try again.', 'error');
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Logout functionality
        elements.logoutBtn.addEventListener('click', logout);
        elements.mobileLogoutBtn.addEventListener('click', logout);
        
        // Photo upload
        elements.userAvatar.addEventListener('click', () => {
            elements.imageUpload.click();
        });
        
        elements.mobileUserAvatar.addEventListener('click', () => {
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
        
        // Add bot modal
        elements.addBotBtn.addEventListener('click', () => {
            elements.addBotModal.classList.add('show');
        });
        
        elements.closeAddBotModal.addEventListener('click', () => {
            elements.addBotModal.classList.remove('show');
        });
        
        elements.cancelAddBot.addEventListener('click', () => {
            elements.addBotModal.classList.remove('show');
        });
        
        elements.addBotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Handle form submission
            showNotification('Bot creation feature coming soon!', 'success');
            elements.addBotModal.classList.remove('show');
        });
        
        // WhatsApp button
        elements.whatsappBtn.addEventListener('click', () => {
            const phoneNumber = '254712345678'; // Replace with your actual WhatsApp number
            const message = 'Hello I need help';
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });
    }
    
    // Refresh user data and bots
    function refreshData() {
        const icon = elements.refreshBotsBtn.querySelector('i');
        icon.classList.add('fa-spin');
        
        // Refresh user data first
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
                return Promise.all([
                    loadUserBots(),
                    loadAvailableBots()
                ]);
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
            elements.totalBalance.textContent = `${user.currency || 'KSH'} ${newBalance.toLocaleString()}`;
            
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
        window.location.href = 'index.html';
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