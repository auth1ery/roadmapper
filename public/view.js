const API_URL = window.location.origin;

const VIEW = {
    roadmapId: null,
    roadmap: null,

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roadmapId = urlParams.get('id');

        if (!this.roadmapId) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.loadRoadmap();
        this.setupUI();
    },

    setupUI() {
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    },

    async loadRoadmap() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/public`);

            if (!response.ok) {
                throw new Error('failed to load roadmap');
            }

            const roadmaps = await response.json();
            this.roadmap = roadmaps.find(rm => rm.id == this.roadmapId);

            if (!this.roadmap) {
                alert('roadmap not found');
                window.location.href = 'dashboard.html';
                return;
            }

            this.roadmap.milestones = Array.isArray(this.roadmap.milestones) ? this.roadmap.milestones : [];

            this.displayRoadmap();
            this.renderMilestones();
        } catch (error) {
            console.error(error);
            alert('failed to load roadmap');
            window.location.href = 'dashboard.html';
        }
    },

    displayRoadmap() {
        document.getElementById('roadmapTitleDisplay').textContent = this.roadmap.title;
        document.getElementById('ownerDisplay').textContent = `by ${this.roadmap.owner_name}`;

        if (this.roadmap.description && this.roadmap.description.trim()) {
            const descSection = document.getElementById('roadmapDescription');
            descSection.style.display = 'block';
            descSection.querySelector('p').textContent = this.roadmap.description;
        }

        const collaborators = Array.isArray(this.roadmap.collaborators) ? this.roadmap.collaborators : [];
        if (collaborators.length > 0) {
            const collabSection = document.getElementById('collaboratorsSection');
            collabSection.style.display = 'block';
            
            const collabList = document.getElementById('collaboratorsList');
            collabList.innerHTML = collaborators.map(c => `
                <div class="collaborator-avatar" title="${c.username}">
                    ${c.username.charAt(0).toUpperCase()}
                </div>
            `).join('');
        }
    },

    renderMilestones() {
        const canvas = document.getElementById('roadmapCanvas');
        canvas.innerHTML = '';

        if (!this.roadmap.milestones || this.roadmap.milestones.length === 0) {
            canvas.innerHTML = `
                <div style="text-align: center; padding: 4rem; color: var(--gray-light);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;">◇</div>
                    <h3 style="font-size: 1.5rem; font-weight: 300; margin-bottom: 0.5rem;">no milestones yet</h3>
                    <p style="font-size: 1rem;">this roadmap is empty</p>
                </div>
            `;
            return;
        }

        this.roadmap.milestones.forEach(milestone => {
            const element = this.createMilestoneElement(milestone);
            canvas.appendChild(element);
        });
    },

    createMilestoneElement(milestone) {
        const div = document.createElement('div');
        div.className = 'milestone';
        div.style.left = milestone.x + 'px';
        div.style.top = milestone.y + 'px';
        div.style.cursor = 'default';

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

        return div;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    VIEW.init();
});
