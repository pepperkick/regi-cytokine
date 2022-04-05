import { Injectable, Logger } from '@nestjs/common';
import {
  Message,
  OverwriteResolvable,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { DiscordService } from './discord.service';
import { MessagingService } from './messaging.service';
import { LobbyService } from './modules/lobby/lobby.service';

import { StatusColors as color } from './objects/status-colors.enum';

import * as config from '../config.json';
import { DistributionType } from './objects/distribution.enum';
import { RequirementName } from './objects/requirement-names.enum';
import { LobbyCommand } from './commands/lobby.command';
import { Lobby } from './modules/lobby/lobby.model';

@Injectable()
export class AppService {
  private readonly logger: Logger = new Logger(AppService.name);

  constructor(
    private readonly lobbyService: LobbyService,
    private readonly messagingService: MessagingService,
    private readonly discordService: DiscordService,
  ) {}

  /**
   * Gets the Message object from a Lobby ID
   * @param lobbyId The lobby ID to get the message from
   */
  private async getMessage(lobbyId: string): Promise<{
    message: Message;
    discord: any;
  }> {
    // Get Lobby from the Lobby ID
    const discord = await this.lobbyService.getInternalLobbyById(lobbyId);

    // Update the message.
    const message = await this.discordService.getMessage(
      discord.messageId,
      discord.channels.general.textChannelId,
    );

    return { message, discord };
  }

  /**
   * Updates the status of an internal Lobby document.
   * @param lobbyId The Lobby ID we're updating the status of.
   * @param status The status to set.
   * @noretun
   */
  async updateInternalLobby(lobbyId: string, status: string) {
    await this.lobbyService.updateLobbyStatus(lobbyId, status);
  }

  /**
   * Gets the Lobby object from a Match ID.
   * @param matchId The Match ID sent from Cytokine
   * @returns The lobby object that's linked with the provided matchId, if found.
   */
  async getLobbyFromMatchId(matchId: string) {
    return await this.lobbyService.getLobbyByMatchId(matchId);
  }

  async lobbyNotifyWaitingForRequiredPlayers(lobby: any) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobby._id);

    // If no message is found, do not do anything.
    if (!message) return;

    // Update the message embed color and content
    await message.edit({
      content: `:hourglass: Waiting for players to queue up...`,
    });

    return await this.messagingService.updateReply(lobby, message);
  }

  /**
   * Does a Lobby Notification for WAITING_FOR_AFK_CHECK
   * Temporarily locks down Queueing at this instance.
   * At this point:
   *  - All required players have queued up.
   *  - We require confirmation from them to start the game.
   */
  async lobbyNotifyWaitingForAfk(lobbyId: string, lobby: any) {
    // If we're waiting for an AFK to finish, we must create the information channel with the correct permissions.
    // This is an exclusive channel for Lobby information (excluding the main embed).
    //
    // Create the information channel.
    const { message, discord } = await this.getMessage(lobbyId);

    const info = await this.discordService.createInfoChannel(
      discord,
      lobby.queuedPlayers,
    );

    // Update embed color
    // And update the last field message, removing the queue up reminder.
    const embed = message.embeds[0];
    embed.color = color.WAITING_FOR_AFK;

    // Create the AFK check message, and set a timeout for it to expire.
    const afkMessage = await this.messagingService.sendAFKCheck(lobby, info);

    setTimeout(async () => {
      // Get the latest Lobby document for when the expiry moment is reached.
      const lobby = await this.lobbyService.getLobbyById(lobbyId);

      // Do not do anything if the Lobby is not in the WAITING_FOR_AFK_CHECK state.
      if (lobby.status != 'WAITING_FOR_AFK_CHECK') return;

      this.logger.debug(
        `Lobby ${lobbyId}'s AFK check expired. Checking if action is needed...`,
      );

      // If there are AFK players, list them and remove them.
      const afk = lobby.queuedPlayers.filter(
        (p) => !p.roles.includes('active'),
      );

      if (afk.length > 0) {
        // Delete the original AFK check message.
        if (!afkMessage.deleted) await afkMessage.delete();

        for (const player of afk) {
          this.logger.debug(
            `Removing AFK player ${player.discord} from lobby ${lobby._id}`,
          );
          await this.lobbyService.removePlayer(player.discord, lobby._id);
        }

        // Unmark active status from already active players
        for (const player of lobby.queuedPlayers) {
          if (player.roles.includes('active')) {
            this.logger.debug(
              `Unmarking player ${player.discord} (${player.name}) as active...`,
            );
            await this.lobbyService.removeRole(
              player.discord,
              lobbyId,
              RequirementName.ACTIVE,
            );
          }
        }

        // Create a user list with AFK players.
        const players = afk
          .map((p) => `:x: <@${p.discord}> (${p.name})`)
          .join('\n');

        // Send a message to the Lobby's general channel saying which players have been removed from the queue for being AFK.
        await info.send({
          content: `@here\nThe following players have failed to confirm their AFK status in time and have been removed from the Lobby:\n${players}`,
        });
      }
    }, config.lobbies.afkCheckTimeout * 1000);

    return await message.edit({
      content: `:hourglass: Waiting on players to confirm they're ready...`,
      embeds: [embed],
      components: [],
    });
  }

  /**
   * Does a Lobby Notification for DISTRIBUTING
   * Locks down queueing at this instance.
   */
  async lobbyNotifyDistributing(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    // And update the last field message, removing the queue up reminder.
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTING;

    return await message.edit({
      content: ':hourglass: Distributing players randomly...',
      embeds: [embed],
      components: [],
    });
  }

  /**
   * Does a Lobby Notification for DISTRIBUTED
   */
  async lobbyNotifyDistributed(lobby) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobby._id);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTED;

    // Get the user lists
    const players = this.messagingService.generateUserList(
        lobby,
        {
          distributed: true,
        },
        lobby.distribution as DistributionType,
      ),
      // Create the team specific channels.
      { teamA, teamB } = await this.discordService.createTeamChannels(
        lobby.name,
        discord.channels.categoryId,
        discord.region,
        lobby.queuedPlayers,
      );

    // Check for the team specific channels being successfully created
    if (!teamA || !teamB) {
      // Edit the message
      await message.edit({
        content: `:warning: Couldn't create team channels due to a permissions error.\n\n:x: Closing lobby...`,
      });

      // Close the lobby
      return await this.lobbyService.closeLobby(lobby._id);
    }

    // Update the Internal Lobby document
    await this.lobbyService.updateLobbyChannels(lobby._id, {
      A: teamA,
      B: teamB,
    });

    // Get the Discord GuildMembers
    const members = await this.discordService.getMembers(
      lobby.queuedPlayers.map((p) => p.discord),
    );
    if (!members) {
      this.logger.error(`Failed to fetch members for lobby ${lobby._id}`);
    } else {
      this.logger.debug(
        `Fetched ${members.size} members for lobby ${lobby._id}`,
      );
    }

    // Move player's (if connected to any Voice Channel) to their team's Voice Channel
    for (const player of lobby.queuedPlayers) {
      const member = members?.get(player.discord);

      // If no member was found with this Discord ID (strange?) skip.
      if (!member) {
        this.logger.debug(
          `Could not find Discord Member for ${player.discord}`,
        );
        continue;
      }

      this.logger.debug(JSON.stringify(member.voice));
      // If the user isn't connected to any Voice Channel, skip.
      if (!member.voice.channel) {
        this.logger.debug(
          `${player.discord} is not connected to any Voice Channel`,
        );
        continue;
      }

      // Declare team booleans
      // TODO: Deprecate this and only use TEAM_A and TEAM_B for team detection.
      const isTeamA =
          player.roles.includes('team_a') ||
          player.roles.filter((r) => r.includes('red')).length > 0,
        isTeamB =
          player.roles.includes('team_b') ||
          player.roles.filter((r) => r.includes('blu')).length > 0;

      // If this player has a 'team_a' role, move to teamA.voice
      setTimeout(async () => {
        const channel = isTeamA ? teamA.voice : isTeamB ? teamB.voice : null;
        await member.voice.setChannel(
          channel,
          'Moved automatically to respective Team Channel for Lobby.',
        );
        this.logger.debug(
          `Moved ${player.discord} to voice channel ${channel.id}`,
        );
      }, config.lobbies.moveDelay * 1000);
    }

    // Update the embed
    // The user list is the actual embed fields.
    embed.fields.splice(3, embed.fields.length - 3);

    embed.fields.push(
      ...players,
      {
        name: '\u200b',
        value: '\u200b',
        inline: false,
      },
      {
        name: `:red_circle: ${config.lobbies.teams.A.voice}`,
        value: `<#${teamA.text.id}>\n<#${teamA.voice.id}>`,
        inline: true,
      },
      {
        name: `:blue_circle: ${config.lobbies.teams.B.voice}`,
        value: `<#${teamB.text.id}>\n<#${teamB.voice.id}>`,
        inline: true,
      },
    );

    return await message.edit({
      content:
        ':white_check_mark: Players have been distributed!\n\n:hourglass: Preparing lobby...',
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for LOBBY_READY
   */
  async lobbyNotifyLobbyReady(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LOBBY_READY;

    return await message.edit({
      content:
        ':white_check_mark: Lobby is ready!\n\n:point_right: Join your respective team channels below.',
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby notification for CREATING_SERVER
   */
  async lobbyNotifyCreatingServer(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.CREATING_SERVER;

    return await message.edit({
      content: `${message.content}\n:hourglass: Waiting for server to start...`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for WAITING_FOR_PLAYERS
   * At this point:
   * - We have a live server in IDLE status.
   * - Everybody is queued and distributed accordingly.
   */
  async lobbyNotifyWaitingForPlayers(lobbyId: string, data) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobbyId);

    const info = await this.discordService.createInfoChannel(
      discord,
      data.players,
    );

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.WAITING_FOR_PLAYERS;

    // Get the Server info from the server ID
    const server = await this.lobbyService.getServerInfo(data._id);

    // Update the message and send connect data to the general channel.
    await this.discordService.sendServerDetails(info, server);

    return await message.edit({
      content: `:white_check_mark: Server is ready!\n\n:point_right: Details have been posted in <#${info.id}>\n:hourglass: Waiting for players to join...`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for LIVE
   */
  async lobbyNotifyLive(lobbyId: string, match: any) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LIVE;

    // Add the STV connection string to the embed
    // Get the Server info from the server ID
    const server = await this.lobbyService.getServerInfo(match._id);

    embed.fields.push({
      name: ':tv: STV Connection',
      value: `If you wish to spectate the match connect to the **STV** with: \`\`connect ${
        server.data.sdrEnable ? server.data.sdrIp : server.ip
      }:${
        server.data.sdrEnable ? server.data.sdrTvPort : server.data.tvPort
      }; ${
        server.data.tvPassword.length > 0
          ? `password ${server.data.tvPassword}`
          : ''
      }\`\``,
      inline: false,
    });

    return await message.edit({
      content:
        ":busts_in_silhouette: All players have joined the server!\n\n:crossed_swords: **It's game time! Good luck and happy competition!**",
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for FINISHED
   */
  async lobbyNotifyFinished(lobby: any, match: any) {
    // Get the Message object for this LobbyID
    const { discord } = await this.getMessage(lobby._id);

    // Get the lobby results channel to send into
    const channel = (await this.discordService
      .getClient()
      .channels.fetch(
        config.discord.channels.results.length > 0
          ? config.discord.channels.results
          : config.discord.channels.create,
      )) as TextChannel;

    // Connect to linked Hatch service for data
    const embed = {
      title: `Lobby ${discord.name} has finished!`,
      description: `:tada: Thanks to all participants for playing! Hope you enjoyed your game!\n\n:point_down: Results are listed below.`,
      fields: [
        {
          name: 'Lobby Information',
          value: `:video_game: **Game**: ${
            match.game
          }\n:arrows_counterclockwise: **Distribution**: ${LobbyCommand.getDistributionTypeName(
            lobby.distribution,
          )}\n:map: **Map**: ${match.map}`,
          inline: false,
        },
        {
          name: ':clipboard: Logs',
          value: `[Click to view the log](${match.data.logstfUrl})`,
          inline: true,
        },
        {
          name: ':trophy: Results',
          value: `:red_circle: **${match.data.teamScore.Red}** - **${match.data.teamScore.Blue}** :blue_circle:`,
          inline: true,
        },
        {
          name: ':film_frames: STV Demo',
          value: `[Click to view the demo](${match.data.demostfUrl})`,
          inline: true,
        },
      ],
    };

    // Move all players back to a waiting channel before deletion.
    // First decide which waiting channel we're using, depends on amount of players in said channel.
    const pAmount = lobby.queuedPlayers.length;

    let waiting: VoiceChannel = null;
    for (const channel of config.discord.channels.waiting) {
      const ch = await this.discordService.getChannel(channel);

      if (ch instanceof VoiceChannel) {
        // Ignore this channel if it has too many players on it.
        if (ch.full || ch.members.size > Math.floor(pAmount / 2)) continue;

        // If we've found a channel that has enough space, use it.
        waiting = ch;

        break;
      }
    }

    // If nothing was found free, use a random waiting channel to move everyone.
    if (!waiting) {
      const channel = await this.discordService.getChannel(
        config.discord.channels.waiting[
          Math.floor(Math.random() * config.discord.channels.waiting.length)
        ],
      );

      if (channel.isVoice()) {
        waiting = channel as VoiceChannel;
      } else {
        this.logger.error(
          `Waiting channel ${channel.id} is not a voice channel!`,
          `${LobbyService.name}::lobbyNotifyFinished`,
        );
      }
    }

    if (waiting) {
      this.logger.debug(
        `Moving ${lobby.queuedPlayers.length} players to ${waiting.id}`,
        `${LobbyService.name}::lobbyNotifyFinished`,
      );

      // Move all players back to the waiting channel.
      for (const player of lobby.queuedPlayers) {
        const user = await this.discordService.getMember(player.discord);
        // TODO: Check if user is in the lobby channel before moving otherwise it will move them to the waiting channel even if they are connected to some other channel.
        try {
          await user.voice.setChannel(waiting);
        } catch (error) {
          this.logger.error(
            `Tried to move ${user.id} but failed: ${error}`,
            `${LobbyService.name}::lobbyNotifyFinished`,
          );
        }
      }
    }

    // Delete the channels that were created
    await this.discordService.deleteChannels(discord);

    return await channel.send({
      content: `:lock: <@${discord.creatorId}> Your Lobby **${discord.name}** has been locked.`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for FAILED
   */
  async lobbyNotifyFailed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { discord: internalLobby } = await this.getMessage(lobbyId);

    // Delete the channels that were created
    await this.discordService.deleteChannels(internalLobby);

    // Get the lobbies creation channel to notify about the expiry.
    const channel = (await this.discordService
      .getClient()
      .channels.fetch(config.discord.channels.create)) as TextChannel;

    return await channel.send({
      content: `:x: The server failed to start! Contact the Qixalite administration team to troubleshoot this issue.\n\n:x: <@${internalLobby.creatorId}> Your Lobby **${internalLobby.name}** is now closed.`,
    });
  }

  /**
   * Does a Lobby Notification for EXPIRED
   */
  async lobbyNotifyExpired(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { discord: internalLobby } = await this.getMessage(lobbyId);

    // Delete the channels that were created
    await this.discordService.deleteChannels(internalLobby);

    // Get the lobbies creation channel to notify about the expiry.
    const channel = (await this.discordService
      .getClient()
      .channels.fetch(config.discord.channels.create)) as TextChannel;

    return await channel.send({
      content: `:hourglass: <@${internalLobby.creatorId}> Your Lobby **${internalLobby.name}** was closed automatically due to it expiring.`,
    });
  }

  /**
   * Does a Lobby Notification for CLOSED
   */
  async lobbyNotifyClosed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { discord: internalLobby } = await this.getMessage(lobbyId);

    // Delete the channels that were created
    await this.discordService.deleteChannels(internalLobby);

    // Get the lobbies creation channel to notify about the expiry.
    const channel = (await this.discordService
      .getClient()
      .channels.fetch(config.discord.channels.create)) as TextChannel;

    // Was there an error?
    return await channel.send({
      content: `:x: <@${internalLobby.creatorId}> Your Lobby **${internalLobby.name}** has been closed!`,
    });
  }
}
