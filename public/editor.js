const EDITOR = {
    currentUser: null,
    roadmapId: null,
    roadmap: null,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },

    init() {
        this.currentUser = localStorage.getItem('roadmapper_current_user');
        
        if (!this.currentUser) {
            window.location.href = 'index.html';
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        this.roadmapId = urlParams.get('id');

        if (!this.roadmapId) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.loadRoadmap();
        this.setupUI();
        this.setupModal();
        this.setupCanvas();
        this.renderMilestones();
    },

    loadRoadmap() {
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        this.roadmap = roadmaps.find(rm => rm.id === this.roadmapId);

        if (!this.roadmap) {
            alert('roadmap not found');
            window.location.href = 'dashboard.html';
            return;
        }

        if (!this.roadmap.milestones) {
            this.roadmap.milestones = [];
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
        const milestone = this.roadmap.milestones.find(m => m.id === milestoneId);
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

    saveMilestone() {
        const milestoneId = document.getElementById('milestoneId').value;
        const title = document.getElementById('milestoneTitle').value;
        const date = document.getElementById('milestoneDate').value;
        const description = document.getElementById('milestoneDescription').value;

        if (milestoneId) {
            const index = this.roadmap.milestones.findIndex(m => m.id === milestoneId);
            if (index !== -1) {
                this.roadmap.milestones[index] = {
                    ...this.roadmap.milestones[index],
                    title,
                    date,
                    description
                };
            }
        } else {
            const newMilestone = {
                id: 'ms_' + Date.now(),
                title,
                date,
                description,
                x: 50,
                y: 50 + (this.roadmap.milestones.length * 150)
            };
            this.roadmap.milestones.push(newMilestone);
        }

        this.saveRoadmap();
        this.closeModal();
        this.renderMilestones();
    },

    deleteMilestone() {
        if (!confirm('delete this milestone?')) return;

        const milestoneId = document.getElementById('milestoneId').value;
        this.roadmap.milestones = this.roadmap.milestones.filter(m => m.id !== milestoneId);
        this.saveRoadmap();
        this.closeModal();
        this.renderMilestones();
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
        const containerRect = document.getElementById('roadmapCanvas').getBoundingClientRect();

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

    endDrag() {
        if (!this.draggedElement) return;

        const milestoneId = this.draggedElement.dataset.id;
        const milestone = this.roadmap.milestones.find(m => m.id === milestoneId);

        if (milestone) {
            milestone.x = parseInt(this.draggedElement.style.left);
            milestone.y = parseInt(this.draggedElement.style.top);
            this.saveRoadmap();
        }

        this.draggedElement.style.cursor = 'move';
        this.draggedElement = null;
    },

    saveRoadmap() {
        const roadmaps = JSON.parse(localStorage.getItem('roadmapper_roadmaps') || '[]');
        const index = roadmaps.findIndex(rm => rm.id === this.roadmapId);

        if (index !== -1) {
            this.roadmap.updatedAt = new Date().toISOString();
            roadmaps[index] = this.roadmap;
            localStorage.setItem('roadmapper_roadmaps', JSON.stringify(roadmaps));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EDITOR.init();
});
