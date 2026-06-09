# FreshScan GPT — AI-Powered Freshness Analysis

This repository contains the FreshScan GPT application, which integrates a fine-tuned ResNet-50 CV model for fruit and vegetable freshness detection and a fine-tuned Phi-2 NLP model for conversational storage recommendations.

## Prerequisites

Ensure you have Anaconda or Miniconda installed on your system.

## Setup and Launch Instructions

### 1. Start the Backend Server

The backend runs on Python. Since all dependencies are pre-installed in the `NLP` conda environment on the machine, you can run the unified server directly using:

```bash
# Run the Flask backend server
/opt/anaconda3/envs/NLP/bin/python server.py
```

This starts the API endpoints:
- Freshness Analysis: `POST http://localhost:5000/api/freshness`
- Storage Q&A Chat: `POST http://localhost:5000/api/chat`

### 2. Access the Web Frontend

Double-click `index.html` to open the sign-in page, sign in (or register a local account), and access `app.html` to run queries and upload images. The frontend will dynamically communicate with the local backend server.