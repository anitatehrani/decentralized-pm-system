'use strict';

const shim = require('fabric-shim');

// Projects and tasks are stored under separate key prefixes so a project and
// a task can never collide on the ledger even if given the same ID string
// (e.g. project "1" and task "1" used to overwrite the same ledger entry).
function projectKey(projectId) { return `project:${projectId}`; }
function taskKey(taskId) { return `task:${taskId}`; }

const PMChaincode = class {

    async Init(stub) {
        console.log('PM Chaincode initialized');
        return shim.success();
    }

    async Invoke(stub) {
        const { fcn, params } = stub.getFunctionAndParameters();

        // Project functions
        if (fcn === 'createProject')     return this.createProject(stub, params);
        if (fcn === 'getProject')        return this.getProject(stub, params);
        if (fcn === 'addProjectMember')  return this.addProjectMember(stub, params);
        if (fcn === 'archiveProject')    return this.archiveProject(stub, params);
        if (fcn === 'getProjectHistory') return this.getProjectHistory(stub, params);

        // Task functions
        if (fcn === 'createTask')        return this.createTask(stub, params);
        if (fcn === 'getTask')           return this.getTask(stub, params);
        if (fcn === 'assignTask')        return this.assignTask(stub, params);
        if (fcn === 'updateTaskStatus')  return this.updateTaskStatus(stub, params);
        if (fcn === 'updateTaskMeta')    return this.updateTaskMeta(stub, params);
        if (fcn === 'getTaskHistory')    return this.getTaskHistory(stub, params);

        // File functions
        if (fcn === 'attachFile')        return this.attachFile(stub, params);

        return shim.error(`Unknown function: ${fcn}`);
    }

    // ─────────────────────────────────────────────
    // PROJECT FUNCTIONS
    // ─────────────────────────────────────────────

    async createProject(stub, params) {
        if (params.length !== 4) return shim.error('Expected: projectId, name, description, ownerId');
        const [projectId, name, description, ownerId] = params;

        const existing = await stub.getState(projectKey(projectId));
        if (existing && existing.length > 0) return shim.error(`Project ${projectId} already exists`);

        const project = {
            docType: 'project',
            projectId, name, description, ownerId,
            members: [ownerId],
            status: 'active'
        };

        await stub.putState(projectKey(projectId), Buffer.from(JSON.stringify(project)));
        return shim.success(Buffer.from(JSON.stringify(project)));
    }

    async getProject(stub, params) {
        if (params.length !== 1) return shim.error('Expected: projectId');
        const data = await stub.getState(projectKey(params[0]));
        if (!data || data.length === 0) return shim.error(`Project ${params[0]} does not exist`);
        return shim.success(data);
    }

    async addProjectMember(stub, params) {
        if (params.length !== 2) return shim.error('Expected: projectId, memberId');
        const [projectId, memberId] = params;

        const data = await stub.getState(projectKey(projectId));
        if (!data || data.length === 0) return shim.error(`Project ${projectId} does not exist`);

        const project = JSON.parse(data.toString());
        if (project.members.includes(memberId)) return shim.error(`Member ${memberId} already in project`);

        project.members.push(memberId);
        await stub.putState(projectKey(projectId), Buffer.from(JSON.stringify(project)));
        return shim.success(Buffer.from(JSON.stringify(project)));
    }

    async archiveProject(stub, params) {
        if (params.length !== 1) return shim.error('Expected: projectId');
        const data = await stub.getState(projectKey(params[0]));
        if (!data || data.length === 0) return shim.error(`Project ${params[0]} does not exist`);

        const project = JSON.parse(data.toString());
        if (project.status === 'archived') return shim.error(`Project ${params[0]} is already archived`);

        project.status = 'archived';
        await stub.putState(projectKey(params[0]), Buffer.from(JSON.stringify(project)));
        return shim.success(Buffer.from(JSON.stringify(project)));
    }

    async getProjectHistory(stub, params) {
        if (params.length !== 1) return shim.error('Expected: projectId');
        const iterator = await stub.getHistoryForKey(projectKey(params[0]));
        const history = [];

        while (true) {
            const result = await iterator.next();
            if (result.done) break;
            history.push({
                txId: result.value.tx_id,
                value: JSON.parse(result.value.value.toString())
            });
        }

        await iterator.close();
        return shim.success(Buffer.from(JSON.stringify(history)));
    }

    // ─────────────────────────────────────────────
    // TASK FUNCTIONS
    // ─────────────────────────────────────────────

    async createTask(stub, params) {
        if (params.length !== 5) return shim.error('Expected: taskId, projectId, title, description, priority');
        const [taskId, projectId, title, description, priority] = params;

        // Verify project exists
        const projectData = await stub.getState(projectKey(projectId));
        if (!projectData || projectData.length === 0) return shim.error(`Project ${projectId} does not exist`);

        // Verify project is active
        const project = JSON.parse(projectData.toString());
        if (project.status === 'archived') return shim.error(`Cannot add tasks to archived project ${projectId}`);

        // Verify task does not already exist
        const existing = await stub.getState(taskKey(taskId));
        if (existing && existing.length > 0) return shim.error(`Task ${taskId} already exists`);

        // Validate priority
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) return shim.error(`Priority must be one of: low, medium, high`);

        const task = {
            docType: 'task',
            taskId, projectId, title, description,
            priority,
            status: 'todo',
            assigneeId: null,
            attachments: []
        };

        await stub.putState(taskKey(taskId), Buffer.from(JSON.stringify(task)));
        return shim.success(Buffer.from(JSON.stringify(task)));
    }

    async getTask(stub, params) {
        if (params.length !== 1) return shim.error('Expected: taskId');
        const data = await stub.getState(taskKey(params[0]));
        if (!data || data.length === 0) return shim.error(`Task ${params[0]} does not exist`);
        return shim.success(data);
    }

    async assignTask(stub, params) {
        if (params.length !== 2) return shim.error('Expected: taskId, assigneeId');
        const [taskId, assigneeId] = params;

        const data = await stub.getState(taskKey(taskId));
        if (!data || data.length === 0) return shim.error(`Task ${taskId} does not exist`);

        const task = JSON.parse(data.toString());
        if (task.status === 'done') return shim.error(`Cannot reassign a completed task`);

        // Verify assignee is a member of the project
        const projectData = await stub.getState(projectKey(task.projectId));
        const project = JSON.parse(projectData.toString());
        if (!project.members.includes(assigneeId)) {
            return shim.error(`User ${assigneeId} is not a member of project ${task.projectId}`);
        }

        task.assigneeId = assigneeId;
        await stub.putState(taskKey(taskId), Buffer.from(JSON.stringify(task)));
        return shim.success(Buffer.from(JSON.stringify(task)));
    }

    async updateTaskStatus(stub, params) {
        if (params.length !== 2) return shim.error('Expected: taskId, newStatus');
        const [taskId, newStatus] = params;

        const validStatuses = ['todo', 'in-progress', 'done'];
        if (!validStatuses.includes(newStatus)) {
            return shim.error(`Status must be one of: todo, in-progress, done`);
        }

        const data = await stub.getState(taskKey(taskId));
        if (!data || data.length === 0) return shim.error(`Task ${taskId} does not exist`);

        const task = JSON.parse(data.toString());

        // Enforce valid status transitions.
        // 'done' can be reopened back to 'in-progress' or 'todo' if more work
        // turns out to be needed — the change itself still lands on the
        // immutable audit trail, so reopenings are fully visible in history.
        const transitions = {
            'todo':        ['in-progress'],
            'in-progress': ['todo', 'done'],
            'done':        ['in-progress', 'todo']
        };

        if (!transitions[task.status].includes(newStatus)) {
            return shim.error(`Invalid transition: ${task.status} → ${newStatus}`);
        }

        task.status = newStatus;
        await stub.putState(taskKey(taskId), Buffer.from(JSON.stringify(task)));
        return shim.success(Buffer.from(JSON.stringify(task)));
    }

    async updateTaskMeta(stub, params) {
        if (params.length !== 3) return shim.error('Expected: taskId, field, value');
        const [taskId, field, value] = params;

        const editableFields = ['title', 'description', 'priority'];
        if (!editableFields.includes(field)) {
            return shim.error(`Field must be one of: title, description, priority`);
        }

        if (field === 'priority') {
            const validPriorities = ['low', 'medium', 'high'];
            if (!validPriorities.includes(value)) {
                return shim.error(`Priority must be one of: low, medium, high`);
            }
        }

        const data = await stub.getState(taskKey(taskId));
        if (!data || data.length === 0) return shim.error(`Task ${taskId} does not exist`);

        const task = JSON.parse(data.toString());
        if (task.status === 'done') return shim.error(`Cannot edit a completed task`);

        task[field] = value;
        await stub.putState(taskKey(taskId), Buffer.from(JSON.stringify(task)));
        return shim.success(Buffer.from(JSON.stringify(task)));
    }

    async getTaskHistory(stub, params) {
        if (params.length !== 1) return shim.error('Expected: taskId');
        const iterator = await stub.getHistoryForKey(taskKey(params[0]));
        const history = [];

        while (true) {
            const result = await iterator.next();
            if (result.done) break;
            history.push({
                txId: result.value.tx_id,
                value: JSON.parse(result.value.value.toString())
            });
        }

        await iterator.close();
        return shim.success(Buffer.from(JSON.stringify(history)));
    }

    // ─────────────────────────────────────────────
    // FILE FUNCTIONS
    // ─────────────────────────────────────────────

    async attachFile(stub, params) {
        if (params.length !== 3) return shim.error('Expected: taskId, fileName, ipfsCid');
        const [taskId, fileName, ipfsCid] = params;

        const data = await stub.getState(taskKey(taskId));
        if (!data || data.length === 0) return shim.error(`Task ${taskId} does not exist`);

        const task = JSON.parse(data.toString());
        if (task.status === 'done') return shim.error(`Cannot attach files to a completed task`);

        // Check for duplicate CID
        if (task.attachments.find(a => a.cid === ipfsCid)) {
            return shim.error(`File with CID ${ipfsCid} already attached to task ${taskId}`);
        }

        task.attachments.push({ fileName, cid: ipfsCid });
        await stub.putState(taskKey(taskId), Buffer.from(JSON.stringify(task)));
        return shim.success(Buffer.from(JSON.stringify(task)));
    }
};

shim.start(new PMChaincode());