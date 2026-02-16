const API_URL = window.location.origin;

const DASHBOARD = {
    currentUser: null,
    token: null,

    init() {
        this.token = localStorage.getItem('roadmapper_token');
        const userStr = localStorage.getItem('roadmapper_user');
        
        if (!this.token || !userStr) {
            window.location.href = 'index.html';
            return;
        }

        this.currentUser = JSON.parse(userStr);

        this.setupUI();
        this.setupNavigation();
        this.setupModals();
        this.setupForms();
        this.loadRoadmaps();
    },

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    },

    setupUI() {
        document.getElementById('usernameDisplay').textContent = this.currentUser.username;
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('roadmapper_token');
            localStorage.removeItem('roadmapper_user');
            window.location.href = 'index.html';
        });
    },

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('.content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const targetSection = link.dataset.section;
                
                navLinks.forEach(l => l.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                link.classList.add('active');
                document.getElementById(targetSection).classList.add('active');

                if (targetSection === 'browse') {
                    this.loadBrowseRoadmaps();
                }
            });
        });
    },

    setupModals() {
        document.getElementById('createRoadmapBtn').addEventListener('click', () => {
            this.openModal('createRoadmapModal');
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.dataset.modal);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        document.getElementById('deleteRoadmapBtn').addEventListener('click', () => {
            this.deleteRoadmap();
        });

        document.getElementById('openEditorBtn').addEventListener('click', () => {
            const roadmapId = document.getElementById('editRoadmapId').value;
            window.location.href = `editor.html?id=${roadmapId}`;
        });
    },

    setupForms() {
        document.getElementById('createRoadmapForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoadmap();
        });

        document.getElementById('editRoadmapForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateRoadmap();
        });
    },

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    async createRoadmap() {
        const title = document.getElementById('roadmapTitle').value;
        const description = document.getElementById('roadmapDescription').value;
        const isPublic = document.getElementById('roadmapPublic').checked;

        try {
            const response = await fetch(`${API_URL}/api/roadmaps`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ title, description, isPublic })
            });

            if (!response.ok) {
                alert('failed to create roadmap');
                return;
            }

            this.closeModal('createRoadmapModal');
            document.getElementById('createRoadmapForm').reset();
            this.loadRoadmaps();
        } catch (error) {
            alert('connection error');
        }
    },

    async loadRoadmaps() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error('failed to load roadmaps');
            }

            const roadmaps = await response.json();
            const container = document.getElementById('myRoadmapsList');
            
            if (roadmaps.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">◇</div>
                        <h3>no roadmaps yet</h3>
                        <p>create your first roadmap to get started</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = roadmaps.map(rm => this.renderRoadmapCard(rm)).join('');

            document.querySelectorAll('.roadmap-card').forEach(card => {
                card.addEventListener('click', () => {
                    const roadmapId = card.dataset.id;
                    this.openEditModal(roadmapId);
                });
            });
        } catch (error) {
            console.error(error);
            alert('failed to load roadmaps');
        }
    },

    async loadBrowseRoadmaps() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/public`);

            if (!response.ok) {
                throw new Error('failed to load public roadmaps');
            }

            const roadmaps = await response.json();
            const container = document.getElementById('browseRoadmapsList');
            
            if (roadmaps.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">◇</div>
                        <h3>no public roadmaps</h3>
                        <p>be the first to share a roadmap</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = roadmaps.map(rm => this.renderRoadmapCard(rm, true)).join('');

            document.querySelectorAll('.roadmap-card[data-browse="true"]').forEach(card => {
                card.addEventListener('click', () => {
                    const roadmapId = card.dataset.id;
                    window.location.href = `view.html?id=${roadmapId}`;
                });
            });
        } catch (error) {
            console.error(error);
        }
    },

    renderRoadmapCard(roadmap, isBrowse = false) {
        const date = new Date(roadmap.updated_at).toLocaleDateString();
        const collaborators = Array.isArray(roadmap.collaborators) ? roadmap.collaborators : [];
        
        return `
            <div class="roadmap-card" data-id="${roadmap.id}" ${isBrowse ? 'data-browse="true"' : ''}>
                <div class="roadmap-card-header">
                    <div>
                        <h3>${roadmap.title}</h3>
                        <div class="roadmap-meta">
                            ${isBrowse ? `by ${roadmap.owner_name} • ` : ''}updated ${date}
                        </div>
                    </div>
                </div>
                <p class="roadmap-description">${roadmap.description || 'no description'}</p>
                ${collaborators.length > 0 ? `
                    <div class="roadmap-collaborators">
                        ${collaborators.map(c => `
                            <div class="collaborator-avatar" title="${c.username}">
                                ${c.username.charAt(0).toUpperCase()}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    async openEditModal(roadmapId) {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${roadmapId}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                alert('failed to load roadmap');
                return;
            }

            const roadmap = await response.json();
            const isOwner = roadmap.owner_id === this.currentUser.id;
            const collaborators = Array.isArray(roadmap.collaborators) ? roadmap.collaborators : [];
            const collaboratorNames = collaborators.map(c => c.username).join(', ');

            document.getElementById('editRoadmapId').value = roadmap.id;
            document.getElementById('editRoadmapTitle').value = roadmap.title;
            document.getElementById('editRoadmapDescription').value = roadmap.description || '';
            document.getElementById('editRoadmapCollaborators').value = collaboratorNames;
            document.getElementById('editRoadmapPublic').checked = roadmap.is_public;

            if (!isOwner) {
                document.getElementById('deleteRoadmapBtn').style.display = 'none';
                document.getElementById('editRoadmapTitle').disabled = true;
                document.getElementById('editRoadmapPublic').disabled = true;
            } else {
                document.getElementById('deleteRoadmapBtn').style.display = 'block';
                document.getElementById('editRoadmapTitle').disabled = false;
                document.getElementById('editRoadmapPublic').disabled = false;
            }

            this.openModal('editRoadmapModal');
        } catch (error) {
            console.error(error);
            alert('connection error');
        }
    },

    async updateRoadmap() {
        const roadmapId = document.getElementById('editRoadmapId').value;
        const title = document.getElementById('editRoadmapTitle').value;
        const description = document.getElementById('editRoadmapDescription').value;
        const collaboratorsStr = document.getElementById('editRoadmapCollaborators').value;
        const isPublic = document.getElementById('editRoadmapPublic').checked;

        const collaborators = collaboratorsStr
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${roadmapId}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ title, description, isPublic, collaborators })
            });

            if (!response.ok) {
                alert('failed to update roadmap');
                return;
            }

            this.closeModal('editRoadmapModal');
            this.loadRoadmaps();
        } catch (error) {
            alert('connection error');
        }
    },

    async deleteRoadmap() {
        if (!confirm('are you sure you want to delete this roadmap?')) return;

        const roadmapId = document.getElementById('editRoadmapId').value;

        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${roadmapId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                alert('failed to delete roadmap');
                return;
            }

            this.closeModal('editRoadmapModal');
            this.loadRoadmaps();
        } catch (error) {
            alert('connection error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DASHBOARD.init();
});
