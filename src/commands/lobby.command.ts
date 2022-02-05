import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageSelectMenu,
  SelectMenuInteraction,
} from 'discord.js';
import {
  Discord,
  SlashGroup,
  Slash,
  SlashOption,
  SlashChoice,
  ButtonComponent,
  SelectMenuComponent,
} from 'discordx';
import { Logger } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { LobbyOptions } from '../modules/lobby/lobby-options.interface';
import * as config from '../../config.json';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { Player } from '../objects/match-player.interface';
import { Game } from 'src/objects/game.enum';
import { MessagingService } from 'src/messaging.service';
import { InteractionType } from '../objects/interactions/interaction-types.enum';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  static service: LobbyService;
  static messaging: MessagingService;

  constructor(
    private readonly service: LobbyService,
    private readonly messaging: MessagingService,
  ) {
    LobbyCommand.service = service;
    LobbyCommand.messaging = messaging;
  }

  // create
  // Creates a new lobby with the given options.
  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashChoice(LobbyService.regions.names)
    @SlashOption('region', {
      description: 'The region the lobby will be in.',
      required: true,
    })
    region: string,
    // Supported parsed formats as an option
    @SlashChoice(LobbyService.formats.names)
    @SlashOption('format', {
      description: 'The format of the lobby.',
      required: true,
    })
    format: string,
    @SlashOption('valve-sdr', {
      description:
        '[OPTIONAL] Whether or not Valve SDR will be enabled on the server.',
      required: false,
    })
    valveSdr: boolean,
    interaction: CommandInteraction,
  ) {
    // Check for the interaction being of type CommandInteraction
    // This way we can reply to the user once the command has been executed, and get corresponding Discord data.
    if (interaction instanceof CommandInteraction) {
      // Check validity of format sent by user.
      const formatConfig = config.formats.filter(
        (item) => item.name === format,
      )[0] as LobbyFormat;

      // If the format is invalid, reply with an error message.
      if (!formatConfig) {
        return await interaction.reply({
          content: 'Unknown format',
          ephemeral: true,
        });
      }

      // Get player from the Discord initiator
      const player: Player = {
        name: interaction.user.username,
        discord: interaction.user.id,
        roles: ['creator', 'player'],
      };

      // Declare the LobbyOptions object to send over the request.
      const options: LobbyOptions = {
        distribution: formatConfig.distribution,
        callbackUrl: config.localhost,
        queuedPlayers: [player],
        requirements: formatConfig.requirements,
        format: formatConfig,
        matchOptions: {
          region: region,
          game: <Game>formatConfig.game,
          requiredPlayers: formatConfig.maxPlayers,
          players: [],
          preference: {
            createLighthouseServer: true,
            valveSdr:
              valveSdr === undefined
                ? LobbyCommand.service.getRegion(region).valveSdr
                : valveSdr,
          },
        },
      };
      this.logger.debug(options);

      // Reply to the interaction with a message stating that the lobby is being created.
      await LobbyCommand.messaging.replyToInteraction(
        interaction,
        '🕒 Creating a new lobby with your parameters...',
        { ephemeral: false },
      );

      // Send the request to the lobby service (redirects it to Cytokine's API)
      const lobby = await LobbyCommand.service.createLobby(options);

      // If lobby creation was unsuccessful, return an error message.
      if (!lobby)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `❌ Failed to create lobby.`,
        );

      // Log lobby creation
      this.logger.log(
        `User ${interaction.user.username}#${interaction.user.discriminator} created lobby ${lobby._id}`,
      );

      // Create the lobby channels.
      const { text, voice } = await LobbyCommand.service.createChannels(
          LobbyService.regions.voiceRegions[region],
        ),
        lobbyNumber = await LobbyCommand.service.getLobbyCount();

      // Send a message to the text channel explaining its purpose.
      await LobbyCommand.messaging.sendInitialMessage(text, lobbyNumber);

      this.logger.debug(lobby);

      // Create the new message to edit the interaction with the lobby's status.
      const messageId = await LobbyCommand.messaging.lobbyInitialReply(
        interaction,
        formatConfig,
        lobby,
        {
          content: ':white_check_mark: Successfully created lobby.',
          region,
          userId: interaction.user.id,
          lobbyNumber,
        },
      );

      // Save Lobby into MongoDB
      await LobbyCommand.service.saveLobby(
        lobby._id,
        interaction.user.id,
        messageId,
        region,
        {
          categoryId: text.parentId,
          general: {
            textChannelId: text.id,
            voiceChannelId: voice.id,
          },
        },
      );
    }
  }

  // close
  // Closes a lobby that isn't in a FINISHED, UNKNOWN state.
  @Slash('close', { description: 'Close a running lobby (Active).' })
  async close(interaction: CommandInteraction) {
    // Get the list of matches that have been created by this client AND are active.
    const { matches } = await LobbyCommand.service.getActiveMatches();

    // If there are no matches, return a message saying so.
    if (!matches.length)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        ':x: There are no active matches currently.',
        { ephemeral: true },
      );

    // If there are lobbies, send a message to the interaction with a list of lobbies in a select menu.
    const component = LobbyCommand.messaging.createLobbySelectMenu(matches);

    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${interaction.user.id}> Select a lobby you wish to close.`,
      { ephemeral: true, components: [component] },
    );
  }

  /**
   * Gets the Lobby object from the command reply.
   */
  async getLobbyFromInteraction(interaction: ButtonInteraction, lobbyId) {
    // Find the lobby with this ID.
    const lobby = await LobbyCommand.service.getLobbyById(lobbyId);

    // If the lobby wasn't found, change the message into an error one.
    if (!lobby) {
      interaction.update({
        content: '❌ Lobby not found: must have expired or been deleted.',
      });
      return;
    }

    return lobby;
  }

  /**
   * Queue button handler
   */
  @ButtonComponent(InteractionType.QUEUE)
  async handleQueue(interaction: ButtonInteraction) {
    // Get the Lobby ID from the internal Lobby document
    const { lobbyId } = await LobbyCommand.service.getInternalLobbyByMessageId(
      interaction.message.id,
    );

    // Get the Lobby object, player object and lobbyId
    let lobby = await this.getLobbyFromInteraction(interaction, lobbyId);

    // Declare player object to add/remove from the queue.
    const player = {
      name: interaction.user.username,
      discord: interaction.user.id,
      roles: ['player'],
    };

    // Check if the player is already in the queue to deny their entry.
    if (lobby.queuedPlayers.find((p) => p.discord == player.discord))
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${player.discord}> You cannot queue into this lobby: You're already queued.`,
        { ephemeral: true },
      );

    // Check if the queue is full.
    if (lobby.queuedPlayers.length >= lobby.maxPlayers)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${player.discord}> You cannot queue into this lobby: The lobby is full.`,
        { ephemeral: true },
      );

    // TODO: Verify the SteamID of the player trying to join (check if their Discord<->Steam are linked)

    // Add the player to the queue.
    lobby = await LobbyCommand.service.addPlayer(player, lobbyId);

    // Do the lobbyReply again, but this time with the updated lobby.
    await LobbyCommand.messaging.updateReply(
      lobby,
      <Message>interaction.message,
    );

    // Reply to the user with an ephemeral message saying they've been added to the queue.
    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${player.discord}> You have been added to the queue.`,
      { ephemeral: true },
    );
  }

  /**
   * Unqueue button handler
   */
  @ButtonComponent(InteractionType.UNQUEUE)
  async handleUnqueue(interaction: ButtonInteraction) {
    // Get the Lobby ID from the internal Lobby document
    const { lobbyId } = await LobbyCommand.service.getInternalLobbyByMessageId(
        interaction.message.id,
      ),
      discordId = interaction.user.id;

    // Get the Lobby object, player object and lobbyId
    let lobby = await this.getLobbyFromInteraction(interaction, lobbyId);

    // Check if the player is not in the queue first
    if (!lobby.queuedPlayers.find((p) => p.discord == discordId))
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${discordId}> You cannot unqueue from this lobby: You're not queued!`,
      );

    // Remove the player from the lobby's queue.
    lobby = await LobbyCommand.service.removePlayer(discordId, lobbyId);

    // Something went wrong... oops!
    if (!lobby)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${discordId}> You cannot unqueue from this lobby: Something went wrong.`,
      );

    this.logger.debug(lobby);

    // Do the lobbyReply again, but this time with the updated lobby.
    await LobbyCommand.messaging.updateReply(
      lobby,
      <Message>interaction.message,
    );

    // Reply to the user with an ephemeral message saying they've been added to the queue.
    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${discordId}> You have been removed from the queue.`,
    );
  }

  /**
   * Lobby Close Select Handler
   */
  @SelectMenuComponent(InteractionType.LOBBY_CLOSE)
  async handleLobbyCloseSelect(interaction: SelectMenuInteraction) {
    try {
      // Sugar syntax
      const matchId = interaction.values?.[0];

      // Send request to close the match to Cytokine.
      await LobbyCommand.service.closeMatch(matchId);

      // Edit the interaction and send it back to the user.
      return await interaction.update({
        content: `:white_check_mark: Lobby with match ID '**${matchId}**' closed.`,
        components: [],
      });
    } catch (e) {
      // Edit the interaction to show the error.
      return interaction
        ? await interaction.update({
            content: `:x: An error occurred while closing the lobby: \`\`${e}\`\``,
            components: [],
          })
        : this.logger.error(`Error closing lobby: ${e}`);
    }
  }
}
