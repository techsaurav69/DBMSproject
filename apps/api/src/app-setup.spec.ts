import { Body, Controller, Module, Post, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsString } from 'class-validator';
import { configureCrisisGridApplication } from './app-setup';
import { LoginDto } from './auth/dto/login.dto';

class ImageProbeDto { @IsString() image!: string; }
@Controller()
class ParserProbeController {
  @Post('auth/login') login(@Body() dto: LoginDto) { return { email: dto.email }; }
  @Post('community/image-probe') image(@Body() dto: ImageProbeDto) { return { length: dto.image.length }; }
}
@Module({ controllers: [ParserProbeController] })
class ParserProbeModule {}

describe('Scoped community image body parsing', () => {
  let app: INestApplication;
  let base: string;
  beforeAll(async () => { app = await NestFactory.create(ParserProbeModule, { logger: false }); configureCrisisGridApplication(app); await app.listen(0, '127.0.0.1'); base = await app.getUrl(); });
  afterAll(async () => { await app?.close(); });
  it('keeps the standard sign-in JSON parser working', async () => {
    const result = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'person@example.test', password: 'LongEnoughPassword' }) });
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({ email: 'person@example.test' });
  });
  it('allows image payloads over the default 100 KB only on community routes', async () => {
    const result = await fetch(`${base}/api/v1/community/image-probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: 'a'.repeat(200000) }) });
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({ length: 200000 });
  });
});
