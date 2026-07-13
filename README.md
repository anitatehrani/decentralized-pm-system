# Decentralized Project Management System

A decentralized project management prototype built with **Hyperledger Fabric**, **IPFS**, a Node/Express backend, and a React frontend — developed as part of a Master's thesis (DIBRIS, Università di Genova).

## Structure

- `pm-chaincode/` — Hyperledger Fabric chaincode (JavaScript, `fabric-shim`). Deployed on channel `mychannel` as `pmcc`. Implements project/task CRUD, membership, status transitions, and file attachment via IPFS CIDs, with a full on-chain audit trail (`getHistoryForKey`).
- `pm-backend/` — Express REST API bridging the frontend to the Fabric network via `@hyperledger/fabric-gateway`.
- `pm-frontend/` — React + Vite frontend: multi-page UI (Dashboard, Project, Board, Task), drag-and-drop Kanban board, member management, immutable audit trail viewer, dark/light theme.

## Running locally

This project expects a running Hyperledger Fabric test network (2 orgs, channel `mychannel`) and a local IPFS (Kubo) node. See the thesis handoff notes for full environment setup (WSL2 + Docker Desktop + Fabric test-network).

```bash
# Backend
cd pm-backend && node app.js

# Frontend
cd pm-frontend && npm run dev -- --host
```

## Chaincode

Deploy/redeploy from `fabric-samples/test-network`:

```bash
./network.sh deployCC -ccn pmcc -ccp ../dpm-project/pm-chaincode -ccl javascript -ccv <version> -ccs <sequence>
```
