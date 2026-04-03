# KDP Automation Backend Service

This directory contains the Node.js backend service that powers the KDP Automation Bot. It uses Express, WebSockets, and Playwright to perform real, headless browser automation for publishing books to Amazon KDP.

## Scope in Current Architecture

- This backend is an **optional runtime mode**.
- The frontend `KdpAutomationBot` component currently uses Electron IPC as the primary transport in desktop mode.
- Use this backend when you want a standalone automation service (for example remote deployment with Cloud Run).

## Prerequisites

1.  **Node.js:** (v18 or higher recommended)
2.  **Docker:** Required for building the container image for deployment.
3.  **Google Cloud SDK (`gcloud`):** Required for deploying to Google Cloud Run. [Installation Guide](https://cloud.google.com/sdk/docs/install)

## Local Setup & Testing

Running the backend locally is essential for testing and development before deploying.

### 1. Install Dependencies

Navigate to the `server/` directory and install the required npm packages.

```bash
cd /home/runner/work/KDP-E-Book-Generator/KDP-E-Book-Generator
npm install
```

### 2. Install Playwright Browsers

Playwright requires browser binaries to be downloaded. The `playwright` npm package does not include them by default.

```bash
npx playwright install
```

### 3. Set Environment Variables

The automation worker needs your Amazon KDP credentials to log in. **Do not hardcode these in the source code.** Set them as environment variables.

For Linux/macOS:
```bash
export KDP_EMAIL="your-kdp-email@example.com"
export KDP_PASSWORD="your-super-secret-password"
```

For Windows (Command Prompt):
```bash
set KDP_EMAIL="your-kdp-email@example.com"
set KDP_PASSWORD="your-super-secret-password"
```

### 4. Run the Server

Start the backend server. It will listen on `http://localhost:8080`.

```bash
cd /home/runner/work/KDP-E-Book-Generator/KDP-E-Book-Generator
npx tsx server/server.ts
```

You should see the output `Server is listening on port 8080`. The frontend application (when running) can now connect to `ws://localhost:8080`.

### 5. Validate TypeScript (recommended)

```bash
cd /home/runner/work/KDP-E-Book-Generator/KDP-E-Book-Generator
npx tsc -p server/tsconfig.json --noEmit
```

## Deployment to Google Cloud Run

Google Cloud Run is a scalable, serverless platform perfect for this service. This guide assumes you have a Google Cloud project set up.

### Step 1: Build the Docker Container

First, we need to build the Docker image and tag it for upload to Google Container Registry (GCR). Replace `[PROJECT_ID]` with your actual Google Cloud Project ID.

```bash
# Make sure you are in the root directory of the project, NOT the server/ directory
gcloud builds submit --tag gcr.io/[PROJECT_ID]/kdp-automation-backend
```
This command uploads your code to Google Cloud Build, builds the Docker image using the `server/Dockerfile`, and pushes it to your project's Container Registry.

### Step 2: Deploy to Cloud Run

Now, deploy the container image to Cloud Run.

```bash
gcloud run deploy kdp-automation-backend \
  --image gcr.io/[PROJECT_ID]/kdp-automation-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
-   `--region`: Choose a region that works best for you.
-   `--allow-unauthenticated`: This makes the service publicly accessible. For a production app, you would want to implement authentication.

### Step 3: Set Secret Environment Variables

Your KDP credentials should not be part of the container. Use Cloud Run's support for Secret Manager to securely provide them to your service.

1.  **Create secrets in Secret Manager:**
    ```bash
    echo "your-kdp-email@example.com" | gcloud secrets create KDP_EMAIL --data-file=-
    echo "your-super-secret-password" | gcloud secrets create KDP_PASSWORD --data-file=-
    ```

2.  **Update your Cloud Run service to use these secrets:**
    ```bash
    gcloud run services update kdp-automation-backend \
      --update-secrets=KDP_EMAIL=KDP_EMAIL:latest,KDP_PASSWORD=KDP_PASSWORD:latest \
      --region us-central1
    ```
This securely mounts your secrets as environment variables inside the running container.

### Step 4: Wire Frontend to Backend Transport

After deployment, Cloud Run will give you a service URL (e.g., `https://kdp-automation-backend-xxxxxxxx-uc.a.run.app`).

If you are using a WebSocket-driven frontend mode, point your bot client to this address using `wss://`.
If you are using Electron desktop mode, automation is currently IPC-driven and does not use a frontend `WEBSOCKET_URL` constant.
