'use strict';

const express = require('express');
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors());

// ─── Fabric connection config ───────────────────────────────────────────────
const CHANNEL   = 'mychannel';
const CHAINCODE = 'pmcc';
const MSP_ID    = 'Org1MSP';
const PEER_ADDR = 'localhost:7051';
const PEER_HOST = 'peer0.org1.example.com';

const CRYPTO_PATH = path.resolve(
    process.env.HOME,
    'fabric-samples/test-network/organizations/peerOrganizations/org1.example.com'
);

const TLS_CERT   = path.join(CRYPTO_PATH, 'peers/peer0.org1.example.com/tls/ca.crt');
const KEY_DIR    = path.join(CRYPTO_PATH, 'users/Admin@org1.example.com/msp/keystore');
const CERT_PATH  = path.join(CRYPTO_PATH, 'users/Admin@org1.example.com/msp/signcerts/cert.pem');

// ─── Connect to Fabric ──────────────────────────────────────────────────────
async function connectFabric() {
    const tlsCredential = grpc.credentials.createSsl(fs.readFileSync(TLS_CERT));
    const client = new grpc.Client(PEER_ADDR, tlsCredential, {
        'grpc.ssl_target_name_override': PEER_HOST
    });

    const privateKeyFile = fs.readdirSync(KEY_DIR)[0];
    const privateKeyPem  = fs.readFileSync(path.join(KEY_DIR, privateKeyFile));
    const privateKey     = crypto.createPrivateKey(privateKeyPem);

    const gateway = connect({
        client,
        identity: {
            mspId:       MSP_ID,
            credentials: fs.readFileSync(CERT_PATH)
        },
        signer:   signers.newPrivateKeySigner(privateKey),
        hash:     hash.sha256
    });

    const network  = gateway.getNetwork(CHANNEL);
    const contract = network.getContract(CHAINCODE);
    return { gateway, contract };
}

// ─── Helper ─────────────────────────────────────────────────────────────────
function parseResult(result) {
    return JSON.parse(Buffer.from(result).toString());
}

// Extracts the real endorsement/chaincode error out of a fabric-gateway error.
// fabric-gateway wraps everything in a generic "10 ABORTED: failed to endorse
// transaction..." message, with the actual chaincode-level reason (the string
// passed to shim.error(...) in index.js) buried in err.details/err.cause as
// something like "chaincode response 500, Project 1 already exists".
// We pull just that human-readable part out for the UI, and log the full
// raw error to the backend console for debugging.
function formatError(err) {
    console.error(err);

    const raw = err.message || String(err);
    const extras = [];
    if (Array.isArray(err.details)) extras.push(...err.details.map(d => d.message || JSON.stringify(d)));
    if (err.cause) extras.push(err.cause.message || JSON.stringify(err.cause));
    const combined = [raw, ...extras].join(' | ');

    // Look for "chaincode response <code>, <message>" and surface just <message>
    const match = combined.match(/chaincode response \d+,\s*(.+?)(?:"|$)/);
    if (match) return match[1].trim();

    // Otherwise fall back to the clearest single line we have
    return extras.find(Boolean) || raw;
}

// ─── PROJECT ROUTES ─────────────────────────────────────────────────────────

// POST /projects — create a project
app.post('/projects', async (req, res) => {
    const { projectId, name, description, ownerId } = req.body;
    if (!projectId || !name || !description || !ownerId) {
        return res.status(400).json({ error: 'Missing: projectId, name, description, ownerId' });
    }
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('createProject', projectId, name, description, ownerId);
        gateway.close();
        res.status(201).json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// GET /projects/:id — get a project
app.get('/projects/:id', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.evaluateTransaction('getProject', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(404).json({ error: formatError(err) });
    }
});

// POST /projects/:id/members — add a member
app.post('/projects/:id/members', async (req, res) => {
    const { memberId, role } = req.body;
    if (!memberId || !role) return res.status(400).json({ error: 'Missing: memberId, role' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('addProjectMember', req.params.id, memberId, role);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// GET /projects/:id/history — get project history
app.get('/projects/:id/history', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.evaluateTransaction('getProjectHistory', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// DELETE /projects/:id — archive a project
app.delete('/projects/:id', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('archiveProject', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// ─── TASK ROUTES ─────────────────────────────────────────────────────────────

// POST /tasks — create a task
app.post('/tasks', async (req, res) => {
    const { taskId, projectId, title, description, priority, dueDate } = req.body;
    if (!taskId || !projectId || !title || !description || !priority) {
        return res.status(400).json({ error: 'Missing: taskId, projectId, title, description, priority' });
    }
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('createTask', taskId, projectId, title, description, priority, dueDate || '');
        gateway.close();
        res.status(201).json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// GET /tasks/:id — get a task
app.get('/tasks/:id', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.evaluateTransaction('getTask', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(404).json({ error: formatError(err) });
    }
});

// PUT /tasks/:id/assign — assign a task
app.put('/tasks/:id/assign', async (req, res) => {
    const { assigneeId } = req.body;
    if (!assigneeId) return res.status(400).json({ error: 'Missing: assigneeId' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('assignTask', req.params.id, assigneeId);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// PUT /tasks/:id/status — update task status
app.put('/tasks/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing: status' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('updateTaskStatus', req.params.id, status);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// PUT /tasks/:id/meta — edit title/description/priority
app.put('/tasks/:id/meta', async (req, res) => {
    const { field, value } = req.body;
    if (!field || value === undefined) return res.status(400).json({ error: 'Missing: field, value' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('updateTaskMeta', req.params.id, field, value);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// DELETE /tasks/:id — archive (soft-delete) a task
app.delete('/tasks/:id', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('archiveTask', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// POST /tasks/:id/comments — add a comment
app.post('/tasks/:id/comments', async (req, res) => {
    const { authorId, text } = req.body;
    if (!authorId || !text) return res.status(400).json({ error: 'Missing: authorId, text' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('addComment', req.params.id, authorId, text);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// GET /tasks/:id/history — get task audit trail
app.get('/tasks/:id/history', async (req, res) => {
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.evaluateTransaction('getTaskHistory', req.params.id);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// POST /tasks/:id/files — attach a file CID
app.post('/tasks/:id/files', async (req, res) => {
    const { fileName, ipfsCid } = req.body;
    if (!fileName || !ipfsCid) return res.status(400).json({ error: 'Missing: fileName, ipfsCid' });
    try {
        const { gateway, contract } = await connectFabric();
        const result = await contract.submitTransaction('attachFile', req.params.id, fileName, ipfsCid);
        gateway.close();
        res.json(parseResult(result));
    } catch (err) {
        res.status(500).json({ error: formatError(err) });
    }
});

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`PM Backend API running on http://localhost:${PORT}`);
});