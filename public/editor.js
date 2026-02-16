const API_URL = window.location.origin;

const EDITOR = {
    currentUser: null,
    token: null,
    roadmapId: null,
    roadmap: null,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    connectMode: false,
    connectFrom: null,
    currentTool: 'select',

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
            this.roadmap.notes = Array.isArray(this.roadmap.notes) ? this.roadmap.notes : [];
            this.roadmap.connections = Array.isArray(this.roadmap.connections) ? this.roadmap.connections : [];
            this.roadmap.risks = Array.isArray(this.roadmap.risks) ? this.roadmap.risks : [];

            this.setupUI();
            this.setupModal();
            this.setupCanvas();
            this.setupSidebar();
            this.renderCanvas();
            this.loadComments();
            this.loadActivity();
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
            this.currentTool = 'select';
            this.openAddMilestoneModal();
        });

        document.getElementById('addNoteBtn').addEventListener('click', () => {
            this.addNote();
        });

        document.getElementById('connectBtn').addEventListener('click', () => {
            this.toggleConnectMode();
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoom = Math.min(this.zoom * 1.2, 3);
            this.applyTransform();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoom = Math.max(this.zoom / 1.2, 0.3);
            this.applyTransform();
        });

        document.getElementById('centerView').addEventListener('click', () => {
            this.centerView();
        });

        document.getElementById('exportJson').addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('toggleComments').addEventListener('click', () => {
            this.togglePanel('comments');
        });

        document.getElementById('toggleActivity').addEventListener('click', () => {
            this.togglePanel('activity');
        });

        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.postComment();
        });
        
        this.hideLoading();
    },

    setupCanvas() {
        const canvas = document.getElementById('roadmapCanvas');
        const container = document.querySelector('.canvas-container');
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.target.closest('.milestone') || e.target.closest('.note')) {
                this.startDrag(e);
            } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                this.startPan(e);
            }
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.3, Math.min(3, this.zoom * delta));
            this.applyTransform();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedElement) {
                this.onDrag(e);
            } else if (this.isPanning) {
                this.onPan(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.draggedElement) {
                this.endDrag();
            } else if (this.isPanning) {
                this.endPan();
            }
        });
    },

    setupSidebar() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                if (this.currentTool !== 'connect') {
                    this.connectMode = false;
                    this.connectFrom = null;
                }
            });
        });
    },

    applyTransform() {
        const canvas = document.getElementById('roadmapCanvas');
        canvas.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
        canvas.style.transformOrigin = '0 0';
    },

    startPan(e) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        e.preventDefault();
    },

    onPan(e) {
        if (!this.isPanning) return;
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.applyTransform();
    },

    endPan() {
        this.isPanning = false;
    },

    centerView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
    },

    toggleConnectMode() {
        this.connectMode = !this.connectMode;
        const btn = document.getElementById('connectBtn');
        btn.classList.toggle('active', this.connectMode);
        if (!this.connectMode) {
            this.connectFrom = null;
        }
    },

    togglePanel(panel) {
        const commentsPanel = document.getElementById('commentsPanel');
        const activityPanel = document.getElementById('activityPanel');
        
        if (panel === 'comments') {
            commentsPanel.classList.toggle('active');
            activityPanel.classList.remove('active');
        } else {
            activityPanel.classList.toggle('active');
            commentsPanel.classList.remove('active');
        }
    },

    renderCanvas() {
        const canvas = document.getElementById('roadmapCanvas');
        canvas.innerHTML = '';

        this.renderConnections();

        this.roadmap.milestones.forEach(milestone => {
            const element = this.createMilestoneElement(milestone);
            canvas.appendChild(element);
        });

        this.roadmap.notes.forEach(note => {
            const element = this.createNoteElement(note);
            canvas.appendChild(element);
        });
    },

    renderConnections() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'connectionsLayer';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '0';

        this.roadmap.connections.forEach(conn => {
            const from = this.getElementById(conn.from_type, conn.from_id);
            const to = this.getElementById(conn.to_type, conn.to_id);
            if (from && to) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', from.x + 100);
                line.setAttribute('y1', from.y + 50);
                line.setAttribute('x2', to.x + 100);
                line.setAttribute('y2', to.y + 50);
                line.setAttribute('stroke', '#ffffff');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('stroke-dasharray', conn.style === 'dashed' ? '5,5' : '0');
                svg.appendChild(line);
            }
        });

        document.getElementById('roadmapCanvas').appendChild(svg);
    },

    getElementById(type, id) {
        if (type === 'milestone') {
            return this.roadmap.milestones.find(m => m.id == id);
        } else if (type === 'note') {
            return this.roadmap.notes.find(n => n.id == id);
        }
        return null;
    },

    createMilestoneElement(milestone) {
        const div = document.createElement('div');
        div.className = 'milestone';
        div.dataset.id = milestone.id;
        div.dataset.type = 'milestone';
        div.style.left = milestone.x + 'px';
        div.style.top = milestone.y + 'px';
        div.style.borderColor = this.getPriorityColor(milestone.priority);

        const formattedDate = new Date(milestone.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const risks = this.roadmap.risks.filter(r => r.milestone_id == milestone.id);

        div.innerHTML = `
            <div class="milestone-header">
                <div>
                    <div class="milestone-title">${milestone.title}</div>
                    <div class="milestone-date">${formattedDate}</div>
                </div>
                <div class="milestone-badges">
                    ${milestone.priority !== 'medium' ? `<span class="priority-badge ${milestone.priority}">${milestone.priority}</span>` : ''}
                    ${milestone.status !== 'not_started' ? `<span class="status-badge ${milestone.status}">${milestone.status.replace('_', ' ')}</span>` : ''}
                    ${risks.length > 0 ? `<span class="risk-badge">⚠ ${risks.length}</span>` : ''}
                </div>
            </div>
            ${milestone.description ? `<div class="milestone-description">${milestone.description}</div>` : ''}
        `;

        div.addEventListener('dblclick', () => {
            this.openEditMilestoneModal(milestone.id);
        });

        div.addEventListener('click', (e) => {
            if (this.connectMode && !this.connectFrom) {
                this.connectFrom = { type: 'milestone', id: milestone.id };
                div.classList.add('connecting');
            } else if (this.connectMode && this.connectFrom) {
                this.createConnection(this.connectFrom, { type: 'milestone', id: milestone.id });
                document.querySelector('.connecting')?.classList.remove('connecting');
                this.connectFrom = null;
                this.connectMode = false;
                document.getElementById('connectBtn').classList.remove('active');
            }
        });

        return div;
    },

    createNoteElement(note) {
        const div = document.createElement('div');
        div.className = 'note';
        div.dataset.id = note.id;
        div.dataset.type = 'note';
        div.style.left = note.x + 'px';
        div.style.top = note.y + 'px';
        div.style.width = note.width + 'px';
        div.style.height = note.height + 'px';
        div.style.backgroundColor = note.color === 'yellow' ? '#ffeb3b' : note.color;
        div.style.color = '#000';
        div.style.padding = '1rem';
        div.style.border = '1px solid rgba(0,0,0,0.2)';
        div.style.position = 'absolute';
        div.style.cursor = 'move';
        div.style.whiteSpace = 'pre-wrap';

        div.contentEditable = true;
        div.textContent = note.content;

        div.addEventListener('blur', () => {
            this.updateNote(note.id, div.textContent, note.x, note.y, note.width, note.height, note.color);
        });

        div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
        });

        return div;
    },

    startDrag(e) {
        const element = e.target.closest('.milestone') || e.target.closest('.note');
        if (!element || element.contentEditable === 'true') return;

        this.draggedElement = element;
        const rect = element.getBoundingClientRect();
        const containerRect = document.getElementById('roadmapCanvas').getBoundingClientRect();

        this.dragOffset.x = (e.clientX - rect.left) / this.zoom;
        this.dragOffset.y = (e.clientY - rect.top) / this.zoom;

        element.style.cursor = 'grabbing';
        e.preventDefault();
    },

    onDrag(e) {
        if (!this.draggedElement) return;

        const containerRect = document.getElementById('roadmapCanvas').getBoundingClientRect();
        const x = (e.clientX - containerRect.left) / this.zoom - this.dragOffset.x;
        const y = (e.clientY - containerRect.top) / this.zoom - this.dragOffset.y;

        this.draggedElement.style.left = Math.max(0, x) + 'px';
        this.draggedElement.style.top = Math.max(0, y) + 'px';
    },

    async endDrag() {
        if (!this.draggedElement) return;

        const id = this.draggedElement.dataset.id;
        const type = this.draggedElement.dataset.type;
        const x = parseInt(this.draggedElement.style.left);
        const y = parseInt(this.draggedElement.style.top);

        if (type === 'milestone') {
            const milestone = this.roadmap.milestones.find(m => m.id == id);
            if (milestone) {
                try {
                    await fetch(`${API_URL}/api/milestones/${id}`, {
                        method: 'PUT',
                        headers: this.getHeaders(),
                        body: JSON.stringify({
                            title: milestone.title,
                            date: milestone.date,
                            description: milestone.description,
                            priority: milestone.priority,
                            status: milestone.status,
                            x,
                            y
                        })
                    });
                } catch (error) {
                    console.error('failed to update position');
                }
            }
        } else if (type === 'note') {
            const note = this.roadmap.notes.find(n => n.id == id);
            if (note) {
                await this.updateNote(id, note.content, x, y, note.width, note.height, note.color);
            }
        }

        this.draggedElement.style.cursor = 'move';
        this.draggedElement = null;
        await this.loadRoadmap();
    },

    async addNote() {
        try {
            const response = await fetch(`${API_URL}/api/notes`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    roadmapId: this.roadmapId,
                    content: 'new note...',
                    x: 100 + this.roadmap.notes.length * 20,
                    y: 100 + this.roadmap.notes.length * 20,
                    width: 200,
                    height: 150,
                    color: 'yellow'
                })
            });

            if (response.ok) {
                await this.loadRoadmap();
            }
        } catch (error) {
            console.error(error);
        }
    },

    async updateNote(id, content, x, y, width, height, color) {
        try {
            await fetch(`${API_URL}/api/notes/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ content, x, y, width, height, color })
            });
        } catch (error) {
            console.error(error);
        }
    },

    async createConnection(from, to) {
        try {
            const response = await fetch(`${API_URL}/api/connections`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    roadmapId: this.roadmapId,
                    fromType: from.type,
                    fromId: from.id,
                    toType: to.type,
                    toId: to.id,
                    style: 'solid'
                })
            });

            if (response.ok) {
                await this.loadRoadmap();
            }
        } catch (error) {
            console.error(error);
        }
    },

    getPriorityColor(priority) {
        switch (priority) {
            case 'high': return '#ff6b6b';
            case 'medium': return '#ffffff';
            case 'low': return '#51cf66';
            default: return '#ffffff';
        }
    },

    async exportJSON() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${this.roadmapId}/export`, {
                headers: this.getHeaders()
            });

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `roadmap-${this.roadmapId}.json`;
            a.click();
        } catch (error) {
            console.error(error);
            alert('export failed');
        }
    },

    async loadComments() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${this.roadmapId}/comments`, {
                headers: this.getHeaders()
            });

            const comments = await response.json();
            const list = document.getElementById('commentsList');
            list.innerHTML = comments.map(c => `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-username">${c.username}</span>
                        <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <div class="comment-content">${c.content}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error(error);
        }
    },

    async postComment() {
        const input = document.getElementById('commentInput');
        const content = input.value.trim();

        if (!content) return;

        try {
            await fetch(`${API_URL}/api/comments`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    roadmapId: this.roadmapId,
                    content
                })
            });

            input.value = '';
            await this.loadComments();
        } catch (error) {
            console.error(error);
        }
    },

    async loadActivity() {
        try {
            const response = await fetch(`${API_URL}/api/roadmaps/${this.roadmapId}/activity`, {
                headers: this.getHeaders()
            });

            const activity = await response.json();
            const list = document.getElementById('activityList');
            list.innerHTML = activity.map(a => `
                <div class="activity-item">
                    <div class="activity-time">${new Date(a.created_at).toLocaleString()}</div>
                    <div class="activity-action"><strong>${a.username}</strong> ${a.action}</div>
                    ${a.details ? `<div class="activity-details">${a.details}</div>` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error(error);
        }
    },

    setupModal() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
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

    openAddMilestoneModal() {
        document.getElementById('milestoneModalTitle').textContent = 'add milestone';
        document.getElementById('milestoneForm').reset();
        document.getElementById('milestoneId').value = '';
        document.getElementById('milestonePriority').value = 'medium';
        document.getElementById('milestoneStatus').value = 'not_started';
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
        document.getElementById('milestonePriority').value = milestone.priority || 'medium';
        document.getElementById('milestoneStatus').value = milestone.status || 'not_started';
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
        const priority = document.getElementById('milestonePriority').value;
        const status = document.getElementById('milestoneStatus').value;

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
                        priority,
                        status,
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
                        priority,
                        status,
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EDITOR.init();
});
