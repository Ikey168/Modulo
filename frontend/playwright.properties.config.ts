import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'property-accessibility.spec.ts',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5188',browserName:'chromium',channel:'chromium'},webServer:{command:'npx vite --host 127.0.0.1 --port 5188 --strictPort',url:'http://127.0.0.1:5188',reuseExistingServer:false}});
