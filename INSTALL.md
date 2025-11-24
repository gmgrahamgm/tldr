# TOS Helper Extension - Installation Guide

## Installation Steps

### 1. Download the Extension

Download the `tos-helper-extension.zip` file and extract it to a location on your computer.

### 2. Open Chrome Extensions Page

- Open Google Chrome
- Navigate to `chrome://extensions/`
- Or click the menu (⋮) → **More Tools** → **Extensions**

### 3. Enable Developer Mode

- In the top right corner, toggle **Developer mode** ON
- This enables loading unpacked extensions

### 4. Load the Extension

- Click the **Load unpacked** button (appears after enabling Developer mode)
- Navigate to the extracted `extension` folder
- Click **Select Folder**

### 5. Verify Installation

You should see the TOS Helper extension card appear with:
- **Name:** TOS Helper
- **Version:** 1.0.0
- **Status:** Enabled (toggle should be ON)

### 6. Check Service Worker

- Click **service worker** link on the extension card
- You should see console logs indicating successful initialization:
  ```
  TOS Helper: Background service worker initialized
  TOS Helper: Using production backend: https://tldr-xv48.onrender.com
  TOS Helper: Backend URL configured
  TOS Helper: Starting keep-alive pings for production backend
  ```