import {
  ButtonInteraction,
  CommandInteraction,
  Message,
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
    })
    region: string,
    // Supported parsed formats as an option
    @SlashChoice(LobbyService.formats.names)
    @SlashOption('format', {
      description: 'The format of the lobby.',
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
      // Check if the creation channel was set on the config
      if (!config.discord.channels.create.length)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Can't create Lobbies: \`\`The Lobby creation channel is not set in the config.\`\``,
          { ephemeral: true },
        );

      // Check we're on the right channel for lobby creation
      if (interaction.channel.id !== config.discord.channels.create)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: You can only create lobbies in <#${config.discord.channels.create}>`,
          { ephemeral: true },
        );

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

      // Reply to the interaction with a message stating that the lobby is being created.
      await LobbyCommand.messaging.replyToInteraction(
        interaction,
        '🕒 Creating a new lobby with your parameters...',
        { ephemeral: false },
      );

      // Select a random map from the format's pool of maps to be used in this lobby.
      const map = LobbyCommand.service.getRandomMap(null, formatConfig.maps);

      // If no map was found, just return an error message.
      if (!map)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to create lobby: \`\`No map found for the format specified\`\`.`,
          { ephemeral: true },
        );

      // Get Kaiend data for this Discord user
      const kaiend = await LobbyCommand.service.getKaiendAccount(
        interaction.user.id,
      );

      // If not found, tell the user to link them.
      if (kaiend?.error)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to create lobby: \`\`${kaiend.message}\`\`\n\nPlease link your **Steam** and **Discord** accounts here to proceed: <https://api.qixalite.com/accounts/login/discord>`,
          { ephemeral: true },
        );

      // Get player from the Discord initiator
      const player: Player = {
        name: interaction.user.username,
        discord: interaction.user.id,
        steam: kaiend.steam,
        roles: ['creator', 'player'],
      };

      // Get a random name from the name pool
      // let name = LobbyCommand.service.getRandomName(config.lobbies.nameWords);
      const name = await LobbyCommand.service.getNewLobbyName();

      // Check there isn't a name conflict with other active lobbies
      // If there is, re-roll another name
      // const active = await LobbyCommand.service.getActiveLobbies();
      // while (active.lobbies.find((lobby) => lobby.name === name)) {
      //   name = LobbyCommand.service.getRandomName(config.lobbies.nameWords);
      // }

      // Declare the LobbyOptions object to send over the request.
      const options: LobbyOptions = {
        distribution: formatConfig.distribution,
        callbackUrl: `${config.localhost}/lobbies/callback`,
        name,
        queuedPlayers: [player],
        requirements: formatConfig.requirements,
        format: formatConfig,
        userId: interaction.user.id,
        matchOptions: {
          region: region,
          game: <Game>formatConfig.game,
          requiredPlayers: formatConfig.maxPlayers,
          map,
          players: [],
          callbackUrl: `${config.localhost}/matches/callback`,
          preference: {
            createLighthouseServer: true,
            gameConfig: formatConfig.config,
            valveSdr:
              valveSdr === undefined || null
                ? LobbyCommand.service.getRegion(region).valveSdr
                : valveSdr,
          },
        },
      };

      // Send the request to the lobby service (redirects it to Cytokine's API)
      const lobby = await LobbyCommand.service.createLobby(options);

      // If lobby creation was unsuccessful, return an error message.
      if (lobby?.error)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `❌ Failed to create lobby: \`\`Request to the main service failed: ${lobby?.message}\`\`.`,
          { ephemeral: true },
        );

      // Log lobby creation
      this.logger.log(
        `User ${interaction.user.username}#${interaction.user.discriminator} created lobby ${lobby._id}`,
      );

      // Create the lobby channels.
      const { text, voice } = await LobbyCommand.service.createChannels(
        name,
        LobbyService.regions.voiceRegions[region],
      );

      // Check the channels have been created correctly
      if (!text || !voice) {
        // Close the lobby
        await LobbyCommand.service.closeLobby(lobby._id);

        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to create lobby: \`\`Couldn't create channels: Missing permissions / Discord API error\`\`.`,
          { ephemeral: true },
        );
      }

      // Send a message to the text channel explaining its purpose.
      await LobbyCommand.messaging.sendInitialMessage(text, name);

      // Create the new message to edit the interaction with the lobby's status.
      const messageId = await LobbyCommand.messaging.lobbyInitialReply(
        interaction,
        formatConfig,
        lobby,
        {
          content: ':white_check_mark: Successfully created lobby.',
          region,
          userId: interaction.user.id,
          lobbyName: name,
          map,
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
  // Closes a lobby whose match isn't in a LIVE, FINISHED, UNKNOWN state.
  @Slash('close', { description: 'Close a running lobby (Active).' })
  async close(interaction: CommandInteraction) {
    // Get the list of lobbies that have been created by this client AND are active.
    let { lobbies } = await LobbyCommand.service.getActiveLobbies();

    // Is this user not an admin?
    const adminMode = config.discord.channels.admin === interaction.channel.id;
    if (!adminMode) {
      // Filter lobbies out from the list that this user hasn't created.
      lobbies = lobbies.filter(
        (lobby) => lobby.createdBy === interaction.user.id,
      );
    }

    // If there are no lobbies, return a message saying so.
    if (!lobbies.length)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        ":x: There are no active Lobbies currently, or you don't own one.",
        { ephemeral: true },
      );

    // If there are lobbies, send a message to the interaction with a list of lobbies in a select menu.
    // TODO: If not in Admin mode, do not create the select menu and just close the only Lobby created by this user (if any)
    const component = LobbyCommand.messaging.createLobbySelectMenu(lobbies);

    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${interaction.user.id}> Select a lobby you wish to close. ${
        adminMode ? '**[Admin Mode]**' : ''
      }`,
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

    // Get Kaiend data for this Discord user
    const kaiend = await LobbyCommand.service.getKaiendAccount(
      interaction.user.id,
    );

    // If not found, tell the user to link them.
    if (kaiend?.error)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${interaction.user.id}> You cannot queue into this lobby: You haven't linked your Steam and Discord accounts.\n\nPlease do so by visiting <https://api.qixalite.com/accounts/login/discord>`,
        { ephemeral: true },
      );

    // Declare player object to add/remove from the queue.
    const player = {
      name: interaction.user.username,
      discord: interaction.user.id,
      steam: kaiend.steam,
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

    // Add the player to the queue.
    lobby = await LobbyCommand.service.addPlayer(player, lobbyId);

    // Error handling
    if (lobby?.error)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `❌ Failed to add you to this lobby: \`\`${lobby?.message}\`\`.`,
        { ephemeral: true },
      );

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
        { ephemeral: true },
      );

    // Remove the player from the lobby's queue.
    lobby = await LobbyCommand.service.removePlayer(discordId, lobbyId);

    // Something went wrong... oops!
    if (!lobby)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${discordId}> You cannot unqueue from this lobby: Something went wrong.`,
        { ephemeral: true },
      );

    // Do the lobbyReply again, but this time with the updated lobby.
    await LobbyCommand.messaging.updateReply(
      lobby,
      <Message>interaction.message,
    );

    // Reply to the user with an ephemeral message saying they've been added to the queue.
    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${discordId}> You have been removed from the queue.`,
      { ephemeral: true },
    );
  }

  /**
   * Lobby Close Select Handler
   */
  @SelectMenuComponent(InteractionType.LOBBY_CLOSE)
  async handleLobbyCloseSelect(interaction: SelectMenuInteraction) {
    try {
      // Sugar syntax
      const lobbyId = interaction.values?.[0];

      // Send request to close the match to Cytokine.
      await LobbyCommand.service.closeLobby(lobbyId);

      // Log the closing action
      this.logger.log(
        `User ${interaction.user.username}#${interaction.user.discriminator} closed Lobby '${lobbyId}'`,
      );

      // Edit the interaction and send it back to the user.
      return await interaction.update({
        content: `:white_check_mark: Lobby '**${lobbyId}**' closed successfully.`,
        components: [],
      });
    } catch (e) {
      this.logger.error(`Error closing lobby: ${e}`);
    }
  }
}
