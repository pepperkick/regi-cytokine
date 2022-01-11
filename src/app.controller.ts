import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async notify(@Query('status') status: string) {
    console.log(status);
    return 'ok';
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
