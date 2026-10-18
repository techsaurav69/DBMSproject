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

module.exports = async (request, response) => {
  serverPromise ??= createServer();
  const server = await serverPromise;
  return server(request, response);
};
