import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../apps/api/dist/app.module');
const { configureCrisisGridApplication } = require('../apps/api/dist/app-setup');

let serverPromise;

async function createServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { logger: ['error', 'warn'] });
  configureCrisisGridApplication(app);
  await app.init();
  return server;
}

function restoreApiPath(request) {
  const requestUrl = new URL(request.url, 'http://localhost');
  const path = requestUrl.searchParams.get('path');
  if (!path) return;

  requestUrl.searchParams.delete('path');
  const remainingQuery = requestUrl.searchParams.toString();
  request.url = `/api/${path}${remainingQuery ? `?${remainingQuery}` : ''}`;
}

export default async function handler(request, response) {
  restoreApiPath(request);
  serverPromise ??= createServer();
  const server = await serverPromise;
  return server(request, response);
}
