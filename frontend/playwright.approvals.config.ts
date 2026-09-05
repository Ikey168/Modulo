import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'approval-accessibility.spec.ts',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5187',browserName:'chromium',channel:'chromium'},webServer:{command:'npx vite --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false}});
