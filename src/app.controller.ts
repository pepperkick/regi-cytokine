import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async notify(
    @Query('status') status: string,
    @Query('matchId') matchId: string,
    @Query('lobbyId') lobbyId: string,
  ) {
    console.log(`Match: ${matchId} | Lobby: ${lobbyId}`);
    console.log(`Status: ${status}`);
    // If lobbyId is sent, matchId is undefined. Same way around.
    if (matchId === undefined) {
      // We have Lobby information
      // Currently for DISTRIBUTING and DISTRIBUTED
      switch (status) {
        case 'DISTRIBUTING': {
          this.appService.lobbyNotifyDistributing(lobbyId);
          break;
        }
        case 'DISTRIBUTED': {
          this.appService.lobbyNotifyDistributed(lobbyId);
          break;
        }
      }
    }
    return 'ok';
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
