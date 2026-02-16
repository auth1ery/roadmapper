const API_URL = window.location.origin;

const EDITOR = {
    currentUser: null,
    token: null,
    roadmapId: null,
    roadmap: null,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },

    init() {
        this.showLoading();
        
        this.token = localStorage.getItem('roadmapper_token');
        const userStr = localStorage.getItem('roadmapper_user');
        
        if (!this.token || !userStr) {
            window.location.href = 'index.html';
            return;
        }

        this.currentUser = JSON.parse(userStr);

        const urlParams = new URLSearchParams(window.location.search);
        this.roadmapId = urlParams.get('id');

        if (!this.roadmapId) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.loadRoadmap();
    },

    showLoading() {
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.style.opacity = '0';
        }
    },

    hideLoading() {
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.style.transition = 'opacity 0.3s';
            dashboard.style.opacity = '1';
        }
    },

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    },

    async loadRoadmap() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${this.roadmapId}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                alert('roadmap not found');
                window.location.href = 'dashboard.html';
                return;
            }

            this.roadmap = await response.json();
            this.roadmap.milestones = Array.isArray(this.roadmap.milestones) ? this.roadmap.milestones : [];

            this.setupUI();
            this.setupModal();
            this.setupCanvas();
            this.renderMilestones();
        } catch (error) {
            console.error(error);
            alert('failed to load roadmap');
            window.location.href = 'dashboard.html';
        }
    },

    setupUI() {
        document.getElementById('roadmapTitleDisplay').textContent = this.roadmap.title;
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        document.getElementById('addMilestoneBtn').addEventListener('click', () => {
            this.openAddMilestoneModal();
        });
        
        this.hideLoading();
    },

    setupModal() {
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('milestoneModal').addEventListener('click', (e) => {
            if (e.target.id === 'milestoneModal') {
                this.closeModal();
            }
        });

        document.getElementById('milestoneForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMilestone();
        });

        document.getElementById('deleteMilestoneBtn').addEventListener('click', () => {
            this.deleteMilestone();
        });
    },

    setupCanvas() {
        const canvas = document.getElementById('roadmapCanvas');
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.target.closest('.milestone')) {
                this.startDrag(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedElement) {
                this.onDrag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.draggedElement) {
                this.endDrag();
            }
        });
    },

    openAddMilestoneModal() {
        document.getElementById('milestoneModalTitle').textContent = 'add milestone';
        document.getElementById('milestoneForm').reset();
        document.getElementById('milestoneId').value = '';
        document.getElementById('deleteMilestoneBtn').style.display = 'none';
        document.getElementById('milestoneModal').classList.add('active');
    },

    openEditMilestoneModal(milestoneId) {
        const milestone = this.roadmap.milestones.find(m => m.id == milestoneId);
        if (!milestone) return;

        document.getElementById('milestoneModalTitle').textContent = 'edit milestone';
        document.getElementById('milestoneId').value = milestone.id;
        document.getElementById('milestoneTitle').value = milestone.title;
        document.getElementById('milestoneDate').value = milestone.date;
        document.getElementById('milestoneDescription').value = milestone.description || '';
        document.getElementById('deleteMilestoneBtn').style.display = 'block';
        document.getElementById('milestoneModal').classList.add('active');
    },

    closeModal() {
        document.getElementById('milestoneModal').classList.remove('active');
    },

    async saveMilestone() {
        const milestoneId = document.getElementById('milestoneId').value;
        const title = document.getElementById('milestoneTitle').value;
        const date = document.getElementById('milestoneDate').value;
        const description = document.getElementById('milestoneDescription').value;

        try {
            if (milestoneId) {
                const milestone = this.roadmap.milestones.find(m => m.id == milestoneId);
                const response = await fetch(`${API_URL}/api/milestones/${milestoneId}`, {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        title,
                        date,
                        description,
                        x: milestone.x,
                        y: milestone.y
                    })
                });

                if (!response.ok) {
                    alert('failed to update milestone');
                    return;
                }
            } else {
                const response = await fetch(`${API_URL}/api/milestones`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        roadmapId: this.roadmapId,
                        title,
                        date,
                        description,
                        x: 50,
                        y: 50 + (this.roadmap.milestones.length * 150)
                    })
                });

                if (!response.ok) {
                    alert('failed to create milestone');
                    return;
                }
            }

            await this.loadRoadmap();
            this.closeModal();
        } catch (error) {
            console.error(error);
            alert('connection error');
        }
    },

    async deleteMilestone() {
        if (!confirm('delete this milestone?')) return;

        const milestoneId = document.getElementById('milestoneId').value;

        try {
            const response = await fetch(`${API_URL}/api/milestones/${milestoneId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                alert('failed to delete milestone');
                return;
            }

            await this.loadRoadmap();
            this.closeModal();
        } catch (error) {
            console.error(error);
            alert('connection error');
        }
    },

    renderMilestones() {
        const canvas = document.getElementById('roadmapCanvas');
        canvas.innerHTML = '';

        this.roadmap.milestones.forEach(milestone => {
            const element = this.createMilestoneElement(milestone);
            canvas.appendChild(element);
        });
    },

    createMilestoneElement(milestone) {
        const div = document.createElement('div');
        div.className = 'milestone';
        div.dataset.id = milestone.id;
        div.style.left = milestone.x + 'px';
        div.style.top = milestone.y + 'px';

        const formattedDate = new Date(milestone.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        div.innerHTML = `
            <div class="milestone-header">
                <div class="milestone-title">${milestone.title}</div>
                <div class="milestone-date">${formattedDate}</div>
            </div>
            ${milestone.description ? `<div class="milestone-description">${milestone.description}</div>` : ''}
        `;

        div.addEventListener('dblclick', () => {
            this.openEditMilestoneModal(milestone.id);
        });

        return div;
    },

    startDrag(e) {
        const milestone = e.target.closest('.milestone');
        if (!milestone) return;

        this.draggedElement = milestone;
        const rect = milestone.getBoundingClientRect();

        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        milestone.style.cursor = 'grabbing';
        e.preventDefault();
    },

    onDrag(e) {
        if (!this.draggedElement) return;

        const containerRect = document.getElementById('roadmapCanvas').getBoundingClientRect();
        const x = e.clientX - containerRect.left - this.dragOffset.x;
        const y = e.clientY - containerRect.top - this.dragOffset.y;

        this.draggedElement.style.left = Math.max(0, x) + 'px';
        this.draggedElement.style.top = Math.max(0, y) + 'px';
    },

    async endDrag() {
        if (!this.draggedElement) return;

        const milestoneId = this.draggedElement.dataset.id;
        const milestone = this.roadmap.milestones.find(m => m.id == milestoneId);

        if (milestone) {
            const x = parseInt(this.draggedElement.style.left);
            const y = parseInt(this.draggedElement.style.top);

            try {
                await fetch(`${API_URL}/api/milestones/${milestoneId}`, {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        title: milestone.title,
                        date: milestone.date,
                        description: milestone.description,
                        x,
                        y
                    })
                });
            } catch (error) {
                console.error('failed to update position');
            }
        }

        this.draggedElement.style.cursor = 'move';
        this.draggedElement = null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EDITOR.init();
});
