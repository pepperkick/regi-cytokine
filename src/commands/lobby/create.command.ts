import { ButtonInteraction, CommandInteraction, Message } from 'discord.js';
import {
  ButtonComponent,
  Discord,
  Slash,
  SlashChoice,
  SlashGroup,
  SlashOption,
} from 'discordx';
import * as config from '../../../config.json';
import { LobbyOptions } from 'src/modules/lobby/lobby-options.interface';
import { LobbyService } from 'src/modules/lobby/lobby.service';
import { Game } from 'src/objects/game.enum';
import { LobbyFormat } from 'src/objects/lobby-format.interface';
import { Player } from 'src/objects/match-player.interface';
import { LobbyCommand } from '../lobby.command';
import { Logger } from '@nestjs/common';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';

@Discord()
@SlashGroup('lobby')
export class CreateSubCommand {
  private readonly logger: Logger = new Logger(CreateSubCommand.name);

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
      const name = await LobbyCommand.service.getNewLobbyName();

      // Get the parameters for this map type and format
      const { expires, config: cfg } = LobbyCommand.service.getMapTypeConfig(
        map,
        formatConfig,
      );

      // Declare the LobbyOptions object to send over the request.
      const options: LobbyOptions = {
        distribution: formatConfig.distribution,
        callbackUrl: `${config.localhost}/lobbies/callback`,
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
            gameConfig: cfg,
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
        name,
        expires,
        lobby.status,
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

  /**
   * Queue button handler
   */
  @ButtonComponent(InteractionType.QUEUE)
  async handleQueue(interaction: ButtonInteraction) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Get the Lobby ID from the internal Lobby document
    const { lobbyId } = await LobbyCommand.service.getInternalLobbyByMessageId(
      interaction.message.id,
    );

    // Get the Lobby object, player object and lobbyId
    let lobby = await LobbyCommand.getLobbyFromInteraction(
      interaction,
      lobbyId,
    );

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
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Get the Lobby ID from the internal Lobby document
    const { lobbyId } = await LobbyCommand.service.getInternalLobbyByMessageId(
        interaction.message.id,
      ),
      discordId = interaction.user.id;

    // Get the Lobby object, player object and lobbyId
    let lobby = await LobbyCommand.getLobbyFromInteraction(
      interaction,
      lobbyId,
    );

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
}
