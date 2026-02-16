const API_URL = window.location.origin;

const AUTH = {
    init() {
        if (this.isAuthPage()) {
            this.setupTabSwitching();
            this.setupForms();
            this.checkAuthRedirect();
        }
    },

    isAuthPage() {
        return window.location.pathname.includes('index.html') || window.location.pathname === '/';
    },

    setupTabSwitching() {
        const tabs = document.querySelectorAll('.auth-tab');
        const forms = document.querySelectorAll('.auth-form');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetForm = tab.dataset.tab;
                
                tabs.forEach(t => t.classList.remove('active'));
                forms.forEach(f => f.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`${targetForm}Form`).classList.add('active');
            });
        });
    },

    setupForms() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });
    },

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const message = document.getElementById('loginMessage');
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');

        submitBtn.textContent = 'logging in...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                message.className = 'form-message error';
                message.textContent = data.error;
                submitBtn.textContent = 'access system';
                submitBtn.disabled = false;
                return;
            }

            localStorage.setItem('roadmapper_token', data.token);
            localStorage.setItem('roadmapper_user', JSON.stringify(data.user));
            
            window.location.href = 'dashboard.html';
        } catch (error) {
            message.className = 'form-message error';
            message.textContent = 'connection error';
            submitBtn.textContent = 'access system';
            submitBtn.disabled = false;
        }
    },

    async handleSignup() {
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
        const message = document.getElementById('signupMessage');
        const submitBtn = document.querySelector('#signupForm button[type="submit"]');

        if (password !== passwordConfirm) {
            message.className = 'form-message error';
            message.textContent = 'passwords do not match';
            return;
        }

        submitBtn.textContent = 'creating account...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                message.className = 'form-message error';
                message.textContent = data.error;
                submitBtn.textContent = 'create account';
                submitBtn.disabled = false;
                return;
            }

            localStorage.setItem('roadmapper_token', data.token);
            localStorage.setItem('roadmapper_user', JSON.stringify(data.user));

            message.className = 'form-message success';
            message.textContent = 'account created successfully';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } catch (error) {
            message.className = 'form-message error';
            message.textContent = 'connection error';
            submitBtn.textContent = 'create account';
            submitBtn.disabled = false;
        }
    },

    checkAuthRedirect() {
        const token = localStorage.getItem('roadmapper_token');
        if (token && this.isAuthPage()) {
            window.location.href = 'dashboard.html';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AUTH.init();
});
