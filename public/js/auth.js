
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
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // For demo purposes, accept any email/password
          if (email && password) {
            showToast('Login successful! Redirecting...', 'success');
            
            // Store user info in localStorage
            localStorage.setItem('user', JSON.stringify({
              id: 1,
              name: 'Demo User',
              email: email
            }));
            
            // Redirect to dashboard
            setTimeout(() => {
              window.location.href = 'dashboard.html';
            }, 1500);
          } else {
            showToast('Invalid email or password', 'error');
          }
        } catch (error) {
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
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // For demo purposes, accept any valid form
          showToast('Account created successfully! Redirecting...', 'success');
          
          // Store user info in localStorage
          localStorage.setItem('user', JSON.stringify({
            id: 1,
            name: email.split('@')[0], // Use part of email as name
            email: email
          }));
          
          // Redirect to dashboard
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1500);
        } catch (error) {
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
