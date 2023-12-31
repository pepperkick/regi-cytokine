import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  GuildMember,
  Message,
} from 'discord.js';
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
import { LobbyCommand, PreferenceKeys } from '../lobby.command';
import { Logger } from '@nestjs/common';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { DistributionType } from 'src/objects/distribution.enum';

@Discord()
@SlashGroup('lobby')
export class CreateSubCommand {
  private readonly logger: Logger = new Logger(CreateSubCommand.name);

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashOption('region', {
      description: 'The region the lobby will be in.',
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    region: string,
    @SlashOption('distribution', {
      description: 'The Distribution Type the Lobby will have.',
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    distribution: DistributionType,
    @SlashOption('format', {
      description: 'The Format for this Lobby.',
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    format: string,
    @SlashOption('map', {
      description: '[OPTIONAL] Manually set the map for this Lobby',
      required: false,
      autocomplete: true,
      type: 'STRING',
    })
    manualMap: string,
    @SlashOption('access-config', {
      description: '[OPTIONAL] Access config to set for this lobby.',
      required: false,
      autocomplete: true,
      type: 'STRING',
    })
    accessConfig: string,
    @SlashOption('afk-check', {
      description:
        '[OPTIONAL] Toggles the AFK check done after a Lobby has all required players. Default is true.',
      required: false,
    })
    afkCheck: boolean,
    @SlashOption('valve-sdr', {
      description:
        '[OPTIONAL] Whether or not Valve SDR will be enabled on the server.',
      required: false,
    })
    valveSdr: boolean,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    // Autocomplete? Time to give options!
    if (interaction instanceof AutocompleteInteraction) {
      // Get the focused option
      switch (interaction.options.getFocused(true).name) {
        case 'region': {
          // Get the regions
          const regions = Object.keys(config.regions).map((r) => {
            return {
              name: config.regions[r].name,
              value: r,
            };
          });

          return await interaction.respond(regions);
        }
        case 'distribution': {
          // Get available distribution types based on listed formats in the config.
          const available = [];
          config.formats.forEach((format) => {
            // If the Distribution method is not in the array, push it.
            (format as any).distribution.forEach((dist) => {
              if (!available.find((d) => d.value === dist.type))
                available.push({
                  name: LobbyCommand.getDistributionTypeName(dist.type),
                  value: dist.type,
                });
            });
          });

          // Return the available options
          return await interaction.respond(available);
        }
        case 'format': {
          // Get available formats based on the distribution type selected.
          const available = [];
          config.formats.forEach((format) => {
            // If it supports this distribution method, list it.
            if (
              format.distribution.some((dist) => dist.type == distribution) &&
              !format.hidden
            )
              available.push({
                name: format.name,
                value: format.name,
              });
          });

          // Return the available options
          return await interaction.respond(available);
        }
        case 'map': {
          // Get available maps based on the format selected.
          const available = config.formats
            .find((f) => f.name === format)
            .maps.map((map) => {
              return {
                name: map,
                value: map,
              };
            });

          // Return the available options
          return await interaction.respond(available);
        }
        case 'access-config': {
          // Get available access configs
          const userConfigs = await LobbyCommand.preferenceService.getData(
            interaction.user.id,
            PreferenceKeys.lobbyAccessConfigs,
          );
          const guildConfigs = await LobbyCommand.preferenceService.getData(
            'guild',
            PreferenceKeys.lobbyAccessConfigs,
          );
          const available = [];

          let names = [];
          if (userConfigs && guildConfigs) {
            names = Object.keys(userConfigs).concat(
              Object.keys(guildConfigs).filter(
                (item) => Object.keys(userConfigs).indexOf(item) < 0,
              ),
            );
          } else {
            if (userConfigs) {
              names = Object.keys(userConfigs);
            } else if (guildConfigs) {
              names = Object.keys(guildConfigs);
            }
          }

          for (const key of names) {
            available.push({
              name: key,
              value: key,
            });
          }

          // Return the available options
          return await interaction.respond(
            available
              .filter((choice) =>
                choice.name.includes(
                  <string>interaction.options.getFocused(true).value,
                ),
              )
              .slice(0, 24),
          );
        }
      }
    }
    // Check for the interaction being of type CommandInteraction
    // This way we can reply to the user once the command has been executed, and get corresponding Discord data.
    else if (interaction instanceof CommandInteraction) {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

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
          content: ':x: Failed to create Lobby: ``Unknown format``',
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
      const map =
        manualMap?.length > 0
          ? manualMap
          : LobbyCommand.service.getRandomMap(null, formatConfig.maps);

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
      if (kaiend?.error || !kaiend?.steam)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to create lobby: \`\`${
            kaiend.message ??
            'Your Discord account does not have a valid Steam account linked.'
          }\`\`\n\nPlease link your **Steam** and **Discord** accounts here to proceed: <https://api.qixalite.com/accounts/login/discord>`,
          { ephemeral: true },
        );

      // Get a random name from the name pool
      const name = await LobbyCommand.service.getNewLobbyName();

      // Get the parameters for this map type and format
      const { expires, config: cfg } = LobbyCommand.service.getMapTypeConfig(
        map,
        formatConfig,
      );
      this.logger.debug(
        `Creating lobby ${name} with expiry ${expires} and config ${cfg}`,
      );

      // If accessConfig is set then validate it
      if (accessConfig) {
        if (
          !(await LobbyCommand.service.validateAccessConfig(
            accessConfig,
            interaction,
          ))
        )
          return;
      }

      // Get the creator's tier based off of their current roles
      const tier = LobbyCommand.service.getPlayerTier(
        interaction.member as GuildMember,
      );

      // Validate if the selected region allows their tier (and isn't full)
      if (tier !== '<bypass>') {
        switch (await LobbyCommand.service.canCreateLobby(region, tier)) {
          // Region passed by parameter does not exist on the config.
          case -1:
            return await LobbyCommand.messaging.replyToInteraction(
              interaction,
              `:x: Failed to create lobby: \`\`The region '${region}' does not exist.\`\`.`,
              { ephemeral: true },
            );
          // Tier the user has does not allow that region to be hosted.
          case -2:
            return await LobbyCommand.messaging.replyToInteraction(
              interaction,
              `:x: Failed to create lobby: \`\`Your tier does not allow you to host this region.\`\`.`,
              { ephemeral: true },
            );
          // The tier & region server pool for that region are full.
          case false:
            return await LobbyCommand.messaging.replyToInteraction(
              interaction,
              `:x: Failed to create lobby: \`\`The region '${region}' is full/unavailable.\`\`.`,
              { ephemeral: true },
            );
        }
      }

      // Declare the LobbyOptions object to send over the request.
      const requirements = formatConfig.distribution.find(
        (dist) => dist.type === distribution,
      )?.requirements;

      if (!requirements)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to create lobby: \`\`Could not find requirements for the selected distribution.\`\`.`,
          { ephemeral: true },
        );

      const options: LobbyOptions = {
        distribution,
        callbackUrl: `${config.localhost}/lobbies/callback`,
        queuedPlayers: [],
        requirements,
        format: formatConfig,
        userId: interaction.user.id,
        data: {
          expiryTime: expires,
          captainTimeout: config.lobbies.captainTimeout ?? 0,
        },
        matchOptions: {
          region,
          game: <Game>formatConfig.game,
          requiredPlayers: formatConfig.maxPlayers,
          map,
          players: [],
          callbackUrl: `${config.localhost}/matches/callback`,
          preference: {
            createLighthouseServer: true,
            gameConfig: cfg,
            afkCheck: afkCheck === undefined || null ? true : afkCheck,
            valveSdr:
              valveSdr === undefined || null
                ? LobbyCommand.service.getRegion(region).valveSdr
                : valveSdr,
          },
        },
      };

      this.logger.debug(`Lobby options: ${JSON.stringify(options)}`);

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

      // Compile a list of players that can and can't join the lobby based on access config
      // Only the (player) action role is checked
      const permissions =
        await LobbyCommand.service.compileLobbyChannelPermissionsList(
          lobby,
          accessConfig,
          interaction.user.id,
          region,
          format,
        );

      // Create the lobby channels.
      const { text, voice } = await LobbyCommand.service.createChannels(
        name,
        LobbyService.parseRegions().voiceRegions[region],
        permissions,
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

      // Create the new message to edit the interaction with the lobby's status.
      const messageId = await LobbyCommand.messaging.lobbyInitialReply(
        interaction,
        formatConfig,
        lobby,
        {
          content: ':hourglass: Waiting for players to queue up...',
          region: config.regions[region]?.name ?? 'Unknown',
          userId: interaction.user.id,
          lobbyName: name,
          map,
        },
        text,
        LobbyCommand.getDistributionTypeName(distribution),
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
        format,
        tier,
        distribution,
        {
          categoryId: text.parentId,
          general: {
            textChannelId: text.id,
            voiceChannelId: voice.id,
          },
        },
        accessConfig,
      );
    }
  }

  /**
   * Unqueue button handler
   */
  @ButtonComponent(InteractionType.UNQUEUE)
  async handleUnqueue(interaction: ButtonInteraction) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Get the Lobby ID from the internal Lobby document
    const { lobbyId, format } =
        await LobbyCommand.service.getInternalLobbyByMessageId(
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
      config.formats.find((f) => f.name === format) as LobbyFormat,
    );

    // Reply to the user with an ephemeral message saying they've been added to the queue.
    return await LobbyCommand.messaging.replyToInteraction(
      interaction,
      `<@${discordId}> You have been removed from the queue.`,
      { ephemeral: true },
    );
  }
}
