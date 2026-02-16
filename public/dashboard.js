const DASHBOARD = {
    currentUser: null,

    init() {
        this.currentUser = localStorage.getItem('roadmapper_current_user');
        
        if (!this.currentUser) {
            window.location.href = 'index.html';
            return;
        }

        this.setupUI();
        this.setupNavigation();
        this.setupModals();
        this.setupForms();
        this.loadRoadmaps();
    },

    setupUI() {
        document.getElementById('usernameDisplay').textContent = this.currentUser;
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('roadmapper_current_user');
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

    createRoadmap() {
        const title = document.getElementById('roadmapTitle').value;
        const description = document.getElementById('roadmapDescription').value;
        const isPublic = document.getElementById('roadmapPublic').checked;

        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        
        const newRoadmap = {
            id: 'rm_' + Date.now(),
            title,
            description,
            owner: this.currentUser,
            collaborators: [],
            isPublic,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            milestones: []
        };

        roadmaps.push(newRoadmap);
        localStorage.setItem('roadmapper_roadmaps', JSON.stringify(roadmaps));

        this.closeModal('createRoadmapModal');
        document.getElementById('createRoadmapForm').reset();
        this.loadRoadmaps();
    },

    loadRoadmaps() {
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const myRoadmaps = roadmaps.filter(rm => 
            rm.owner === this.currentUser || rm.collaborators.includes(this.currentUser)
        );

        const container = document.getElementById('myRoadmapsList');
        
        if (myRoadmaps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">◇</div>
                    <h3>no roadmaps yet</h3>
                    <p>create your first roadmap to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = myRoadmaps.map(rm => this.renderRoadmapCard(rm)).join('');

        document.querySelectorAll('.roadmap-card').forEach(card => {
            card.addEventListener('click', () => {
                const roadmapId = card.dataset.id;
                this.openEditModal(roadmapId);
            });
        });
    },

    loadBrowseRoadmaps() {
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const publicRoadmaps = roadmaps.filter(rm => rm.isPublic);

        const container = document.getElementById('browseRoadmapsList');
        
        if (publicRoadmaps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">◇</div>
                    <h3>no public roadmaps</h3>
                    <p>be the first to share a roadmap</p>
                </div>
            `;
            return;
        }

        container.innerHTML = publicRoadmaps.map(rm => this.renderRoadmapCard(rm, true)).join('');
    },

    renderRoadmapCard(roadmap, isBrowse = false) {
        const date = new Date(roadmap.updatedAt).toLocaleDateString();
        const isOwner = roadmap.owner === this.currentUser;
        
        return `
            <div class="roadmap-card" data-id="${roadmap.id}">
                <div class="roadmap-card-header">
                    <div>
                        <h3>${roadmap.title}</h3>
                        <div class="roadmap-meta">
                            ${isBrowse ? `by ${roadmap.owner} • ` : ''}updated ${date}
                        </div>
                    </div>
                </div>
                <p class="roadmap-description">${roadmap.description || 'no description'}</p>
                ${roadmap.collaborators.length > 0 ? `
                    <div class="roadmap-collaborators">
                        ${roadmap.collaborators.map(c => `
                            <div class="collaborator-avatar" title="${c}">
                                ${c.charAt(0).toUpperCase()}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    openEditModal(roadmapId) {
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const roadmap = roadmaps.find(rm => rm.id === roadmapId);

        if (!roadmap) return;

        const isOwner = roadmap.owner === this.currentUser;
        const canEdit = isOwner || roadmap.collaborators.includes(this.currentUser);

        if (!canEdit) {
            window.location.href = `editor.html?id=${roadmapId}`;
            return;
        }

        document.getElementById('editRoadmapId').value = roadmap.id;
        document.getElementById('editRoadmapTitle').value = roadmap.title;
        document.getElementById('editRoadmapDescription').value = roadmap.description || '';
        document.getElementById('editRoadmapCollaborators').value = roadmap.collaborators.join(', ');
        document.getElementById('editRoadmapPublic').checked = roadmap.isPublic;

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
    },

    updateRoadmap() {
        const roadmapId = document.getElementById('editRoadmapId').value;
        const title = document.getElementById('editRoadmapTitle').value;
        const description = document.getElementById('editRoadmapDescription').value;
        const collaboratorsStr = document.getElementById('editRoadmapCollaborators').value;
        const isPublic = document.getElementById('editRoadmapPublic').checked;

        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const roadmapIndex = roadmaps.findIndex(rm => rm.id === roadmapId);

        if (roadmapIndex === -1) return;

        const collaborators = collaboratorsStr
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        roadmaps[roadmapIndex] = {
            ...roadmaps[roadmapIndex],
            title,
            description,
            collaborators,
            isPublic,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem('roadmapper_roadmaps', JSON.stringify(roadmaps));
        this.closeModal('editRoadmapModal');
        this.loadRoadmaps();
    },

    deleteRoadmap() {
        if (!confirm('are you sure you want to delete this roadmap?')) return;

        const roadmapId = document.getElementById('editRoadmapId').value;
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const filtered = roadmaps.filter(rm => rm.id !== roadmapId);

        localStorage.setItem('roadmapper_roadmaps', JSON.stringify(filtered));
        this.closeModal('editRoadmapModal');
        this.loadRoadmaps();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DASHBOARD.init();
});
