document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginPanel = document.getElementById('loginPanel');
    const signupPanel = document.getElementById('signupPanel');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toast = document.getElementById('toast');
    const signupPassword = document.getElementById('signupPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const lengthReq = document.getElementById('lengthReq');
    const uppercaseReq = document.getElementById('uppercaseReq');
    const numberReq = document.getElementById('numberReq');
    const demoModeBtn = document.getElementById('demoModeBtn');
    const demoModeBtnSignup = document.getElementById('demoModeBtnSignup');
    
    // API Configuration
    const API_BASE = 'https://fly-io-haha.onrender.com/';
    
    // Tab Switching
    loginTab.addEventListener('click', function() {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginPanel.classList.add('active');
        signupPanel.classList.remove('active');
    });
    
    signupTab.addEventListener('click', function() {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupPanel.classList.add('active');
        loginPanel.classList.remove('active');
    });
    
    // Password Toggle
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    });
    
    // Password Requirements Validation
    function validatePasswordRequirements(password) {
        // Length requirement
        if (password.length >= 8) {
            lengthReq.classList.remove('invalid');
            lengthReq.classList.add('valid');
            lengthReq.querySelector('i').classList.remove('fa-times-circle');
            lengthReq.querySelector('i').classList.add('fa-check-circle');
        } else {
            lengthReq.classList.remove('valid');
            lengthReq.classList.add('invalid');
            lengthReq.querySelector('i').classList.remove('fa-check-circle');
            lengthReq.querySelector('i').classList.add('fa-times-circle');
        }
        
        // Uppercase requirement
        if (/[A-Z]/.test(password)) {
            uppercaseReq.classList.remove('invalid');
            uppercaseReq.classList.add('valid');
            uppercaseReq.querySelector('i').classList.remove('fa-times-circle');
            uppercaseReq.querySelector('i').classList.add('fa-check-circle');
        } else {
            uppercaseReq.classList.remove('valid');
            uppercaseReq.classList.add('invalid');
            uppercaseReq.querySelector('i').classList.remove('fa-check-circle');
            uppercaseReq.querySelector('i').classList.add('fa-times-circle');
        }
        
        // Number requirement
        if (/[0-9]/.test(password)) {
            numberReq.classList.remove('invalid');
            numberReq.classList.add('valid');
            numberReq.querySelector('i').classList.remove('fa-times-circle');
            numberReq.querySelector('i').classList.add('fa-check-circle');
        } else {
            numberReq.classList.remove('valid');
            numberReq.classList.add('invalid');
            numberReq.querySelector('i').classList.remove('fa-check-circle');
            numberReq.querySelector('i').classList.add('fa-times-circle');
        }
        
        // Return true if all requirements are met
        return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
    }
    
    // Form Validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    function validateField(field, validationFn, errorMsg) {
        const inputGroup = field.closest('.input-group');
        const errorMsgElement = inputGroup.querySelector('.error-message');
        
        if (validationFn(field.value)) {
            inputGroup.classList.remove('error');
            return true;
        } else {
            inputGroup.classList.add('error');
            errorMsgElement.textContent = errorMsg;
            return false;
        }
    }
    
    // Show Toast Notification
    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = 'toast show';
        
        if (type === 'error') {
            toast.classList.add('error');
        } else if (type === 'success') {
            toast.classList.add('success');
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.remove('error', 'success');
        }, 3000);
    }
    
    // Generate a simple JWT-like token for demo purposes
    function generateToken(user) {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
            userId: user.id,
            email: user.email,
            name: user.name,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiration
        }));
        return `${header}.${payload}.demo_signature`;
    }
    
    // Demo Mode Button - Improved functionality
    function activateDemoMode() {
        // Store demo mode flag in localStorage
        localStorage.setItem('demoMode', 'true');
        
        // Show notification
        showToast('Entering Demo Mode...', 'success');
        
        // Add a slight delay before redirecting to allow the notification to show
        setTimeout(() => {
            // Redirect to demo page
            window.location.href = 'demo.html';
        }, 800);
    }
    
    // Demo Mode Button Event Listeners
    demoModeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        activateDemoMode();
    });
    
    demoModeBtnSignup.addEventListener('click', function(e) {
        e.preventDefault();
        activateDemoMode();
    });
    
    // Login Form Submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const submitBtn = this.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('span');
        const spinner = submitBtn.querySelector('.spinner');
        
        // Validate form
        let isValid = true;
        isValid = validateField(document.getElementById('loginEmail'), validateEmail, 'Please enter a valid email') && isValid;
        isValid = validateField(document.getElementById('loginPassword'), val => val.length > 0, 'Password is required') && isValid;
        
        if (!isValid) {
            showToast('Please fix the errors in the form', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Signing In...';
        spinner.style.display = 'inline-block';
        
        try {
            // Try to connect to the real API first
            let response;
            try {
                response = await fetch(`${API_BASE}api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });
            } catch (networkError) {
                console.log('Network error, falling back to demo mode:', networkError);
                // If network fails, create a demo user
                const demoUser = {
                    id: Math.floor(Math.random() * 1000),
                    name: email.split('@')[0],
                    email: email,
                    balance: 5000, // Starting balance
                    profit: 0,
                    active_bots: 0,
                    referrals: 0,
                    currency: 'KSH'
                };
                
                // Generate a demo token
                const token = generateToken(demoUser);
                
                // Store authentication data
                localStorage.setItem('authToken', token);
                localStorage.setItem('user', JSON.stringify(demoUser));
                
                showToast('Login successful! (Demo Mode)', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
                return;
            }
            
            const data = await response.json();
            
            if (response.ok) {
                // Store authentication token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                showToast('Login successful! Redirecting...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                showToast(data.message || 'Invalid email or password', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.textContent = 'Sign In';
            spinner.style.display = 'none';
        }
    });
    
    // Signup Form Submission
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        const submitBtn = this.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('span');
        const spinner = submitBtn.querySelector('.spinner');
        
        // Validate form
        let isValid = true;
        isValid = validateField(document.getElementById('signupEmail'), validateEmail, 'Please enter a valid email') && isValid;
        isValid = validateField(document.getElementById('signupPassword'), val => validatePasswordRequirements(val), 'Password does not meet requirements') && isValid;
        isValid = validateField(document.getElementById('confirmPassword'), val => val === password, 'Passwords do not match') && isValid;
        
        if (!agreeTerms) {
            showToast('You must agree to the terms and conditions', 'error');
            return;
        }
        
        if (!isValid) {
            showToast('Please fix the errors in the form', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Creating Account...';
        spinner.style.display = 'inline-block';
        
        try {
            // Try to connect to the real API first
            let response;
            try {
                response = await fetch(`${API_BASE}api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: email.split('@')[0],
                        email: email,
                        password: password
                    })
                });
            } catch (networkError) {
                console.log('Network error, falling back to demo mode:', networkError);
                // If network fails, create a demo user
                const demoUser = {
                    id: Math.floor(Math.random() * 1000),
                    name: email.split('@')[0],
                    email: email,
                    balance: 5200, // Starting balance + signup bonus
                    profit: 0,
                    active_bots: 0,
                    referrals: 0,
                    currency: 'KSH'
                };
                
                // Generate a demo token
                const token = generateToken(demoUser);
                
                // Store authentication data
                localStorage.setItem('authToken', token);
                localStorage.setItem('user', JSON.stringify(demoUser));
                
                showToast('Account created successfully! (Demo Mode)', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
                return;
            }
            
            const data = await response.json();
            
            if (response.ok) {
                // Store authentication token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                showToast('Account created successfully! Redirecting...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                showToast(data.message || 'Failed to create account', 'error');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showToast('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.textContent = 'Create Account';
            spinner.style.display = 'none';
        }
    });
    
    // Reset Form Button
    document.getElementById('resetForm').addEventListener('click', function() {
        signupForm.reset();
        document.querySelectorAll('.input-group').forEach(group => {
            group.classList.remove('error');
        });
        
        // Reset password requirements
        lengthReq.classList.remove('valid');
        lengthReq.classList.add('invalid');
        lengthReq.querySelector('i').classList.remove('fa-check-circle');
        lengthReq.querySelector('i').classList.add('fa-times-circle');
        
        uppercaseReq.classList.remove('valid');
        uppercaseReq.classList.add('invalid');
        uppercaseReq.querySelector('i').classList.remove('fa-check-circle');
        uppercaseReq.querySelector('i').classList.add('fa-times-circle');
        
        numberReq.classList.remove('valid');
        numberReq.classList.add('invalid');
        numberReq.querySelector('i').classList.remove('fa-check-circle');
        numberReq.querySelector('i').classList.add('fa-times-circle');
        
        showToast('Form cleared', 'success');
    });
    
    // Real-time validation
    document.getElementById('loginEmail').addEventListener('blur', function() {
        validateField(this, validateEmail, 'Please enter a valid email');
    });
    
    document.getElementById('signupEmail').addEventListener('blur', function() {
        validateField(this, validateEmail, 'Please enter a valid email');
    });
    
    // Password requirements real-time validation
    signupPassword.addEventListener('input', function() {
        validatePasswordRequirements(this.value);
    });
    
    confirmPassword.addEventListener('input', function() {
        validateField(this, val => val === signupPassword.value, 'Passwords do not match');
    });
});