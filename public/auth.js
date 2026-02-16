const AUTH = {
    init() {
        this.setupTabSwitching();
        this.setupForms();
        this.checkAuth();
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

        const users = JSON.parse(localStorage.getItem('roadmapper_users') || '{}');

        if (!users[username]) {
            message.className = 'form-message error';
            message.textContent = 'user not found';
            return;
        }

        if (users[username].password !== password) {
            message.className = 'form-message error';
            message.textContent = 'incorrect password';
            return;
        }

        localStorage.setItem('roadmapper_current_user', username);
        window.location.href = 'dashboard.html';
    },

    async handleSignup() {
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
        const message = document.getElementById('signupMessage');

        if (password !== passwordConfirm) {
            message.className = 'form-message error';
            message.textContent = 'passwords do not match';
            return;
        }

        if (username.length < 3) {
            message.className = 'form-message error';
            message.textContent = 'username must be at least 3 characters';
            return;
        }

        if (password.length < 6) {
            message.className = 'form-message error';
            message.textContent = 'password must be at least 6 characters';
            return;
        }

        const users = JSON.parse(localStorage.getItem('roadmapper_users') || '{}');

        if (users[username]) {
            message.className = 'form-message error';
            message.textContent = 'username already exists';
            return;
        }

        users[username] = {
            password: password,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('roadmapper_users', JSON.stringify(users));
        localStorage.setItem('roadmapper_current_user', username);

        message.className = 'form-message success';
        message.textContent = 'account created successfully';

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    },

    checkAuth() {
        const currentUser = localStorage.getItem('roadmapper_current_user');
        if (currentUser && window.location.pathname.includes('dashboard')) {
            return true;
        } else if (currentUser && window.location.pathname.includes('index')) {
            window.location.href = 'dashboard.html';
        }
        return false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AUTH.init();
});
