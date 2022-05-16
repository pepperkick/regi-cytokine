import { Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { LobbyStatus } from './modules/lobby/lobby-status.enum';

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

    // Update internal lobby document's status
    await this.appService.updateInternalLobby(lobbyId, status);

    switch (status) {
      case LobbyStatus.WAITING_FOR_REQUIRED_PLAYERS: {
        await this.appService.lobbyNotifyWaitingForRequiredPlayers(data);
        break;
      }
      case LobbyStatus.WAITING_FOR_PICKS: {
        await this.appService.lobbyNotifyWaitingForPicks(data);
        break;
      }
      case LobbyStatus.WAITING_FOR_AFK_CHECK: {
        await this.appService.lobbyNotifyWaitingForAfk(lobbyId, data);
        break;
      }
      case LobbyStatus.DISTRIBUTING: {
        await this.appService.lobbyNotifyDistributing(lobbyId);
        break;
      }
      case LobbyStatus.DISTRIBUTED: {
        await this.appService.lobbyNotifyDistributed(data);
        break;
      }
      case LobbyStatus.CLOSED: {
        await this.appService.lobbyNotifyClosed(lobbyId);
        break;
      }
      case LobbyStatus.EXPIRED: {
        await this.appService.lobbyNotifyExpired(lobbyId);
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

    const lobby = await this.appService.getLobbyFromMatchId(matchId),
      lobbyId = lobby._id;

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
        await this.appService.lobbyNotifyFinished(lobby, data);
        break;
      }
      case 'FAILED': {
        await this.appService.lobbyNotifyFailed(lobbyId);
        break;
      }
    }

    return 'ok';
  }
}
