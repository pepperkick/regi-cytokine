import { Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Post('/lobbies/callback')
  async lobbyNotify(@Query('status') status: string, @Body() data: any) {
    const lobbyId = data._id;
    this.logger.log(
      `Received POST request with status '${status}' for lobby ${lobbyId}`,
    );

    switch (status) {
      case 'DISTRIBUTING': {
        await this.appService.lobbyNotifyDistributing(lobbyId);
        break;
      }
      case 'DISTRIBUTED': {
        await this.appService.lobbyNotifyDistributed(data);
        break;
      }
      case 'CLOSED': {
        await this.appService.lobbyNotifyClosed(lobbyId);
        break;
      }
    }

    return 'ok';
  }

  @Post('/matches/callback')
  async notifyMatch(@Query('status') status: string, @Body() data: any) {
    const matchId = data._id;
    this.logger.log(
      `Received POST request with status '${status}' for match ${matchId}`,
    );

    const { _id: lobbyId } = await this.appService.getLobbyFromMatchId(matchId);

    switch (status) {
      case 'LOBBY_READY': {
        await this.appService.lobbyNotifyLobbyReady(lobbyId);
        break;
      }
      case 'CREATING_SERVER': {
        await this.appService.lobbyNotifyCreatingServer(lobbyId);
        break;
      }
      case 'WAITING_FOR_PLAYERS': {
        // Lighthouse should send Cytokine the server information in data, to then be redirected here.
        await this.appService.lobbyNotifyWaitingForPlayers(lobbyId, data);
        break;
      }
      case 'LIVE': {
        await this.appService.lobbyNotifyLive(lobbyId, data);
        break;
      }
      case 'FINISHED': {
        await this.appService.lobbyNotifyFinished(lobbyId, data);
        break;
      }
      case 'FAILED': {
        await this.appService.lobbyNotifyFailed(matchId);
        break;
      }
    }

    return 'ok';
  }
}
