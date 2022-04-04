import { Logger } from '@nestjs/common';
import { LobbyFormat } from '../../objects/lobby-format.interface';
import * as config from '../../../config.json';
import { RequirementName } from '../../objects/requirement-names.enum';
import axios from 'axios';
import { LobbyOptions } from './lobby-options.interface';
import { DistributionType } from '../../objects/distribution.enum';
import { Player } from 'src/objects/match-player.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lobby } from 'src/modules/lobby/lobby.model';
import { DiscordService } from 'src/discord.service';
import { PreferenceService } from '../preferences/preference.service';
import {
  CommandInteraction,
  GuildMember,
  OverwriteResolvable,
} from 'discord.js';
import { MessagingService } from '../../messaging.service';

// TODO: Not sure why the actual keys does not work, importing it makes building fail
class PreferenceKeys {
  static readonly lobbyAccessConfigs = 'lobby_access_configs';
  static readonly lobbyAccessLists = 'lobby_access_lists';
}

interface LobbyChannels {
  categoryId: string;
  general: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
  teamA?: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
  teamB?: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
}

export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  static formats = LobbyService.parseLobbyFormats();
  static regions = LobbyService.parseRegions();

  constructor(
    @InjectModel('Lobby') private readonly repo: Model<Lobby>,
    private readonly discord: DiscordService,
    private readonly preference: PreferenceService,
    // TODO: Not a good idea to reply to messages from the service, need to find a better way
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Sends a request to Cytokine to create a new lobby with asked requirements.
   */
  async createLobby(options: LobbyOptions) {
    try {
      // Do a request to Cytokine to create a new lobby.
      // The format the data is sent in doesn't match the one from Cytokine's API.
      // This could be solved by discussing it this Friday (or before).
      //
      // data will be a Mongoose document with the Lobby's info.
      const { data } = await axios.post(
        `${config.cytokine.host}/api/v1/lobbies`,
        options,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::createLobby`,
      );
      return error.response?.data;
    }
  }

  /**
   * Does a GET request to Cytokine to get a current lobby by its ID.
   * @param lobbyId The ID of the lobby to get.
   * @returns The API response with the lobby object, if found.
   */
  async getLobbyById(lobbyId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getLobbyById`,
      );
    }
  }

  /**
   * Does a GET request to Cytokine to get a current lobby by its linked Match ID.
   * @param matchId The ID of the Match the Lobby will be linked to.
   * @returns The API response with the lobby object, if found.
   */
  async getLobbyByMatchId(matchId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/lobbies/match/${matchId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getLobbyByMatchId`,
      );
    }
  }

  /**
   * Does a GET request to Cytokine to obtain the Match object that belongs to a Lobby.
   * @param matchId The Match ID we're looking for.
   * @returns The Match document from Cytokine if found.
   */
  async getMatchById(matchId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/matches/${matchId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getMatchById`,
      );
    }
  }

  /**
   * Adds a player to a lobby's queue.
   * @param player The player to add.
   * @param lobbyId The lobby to add the player to.
   */
  async addPlayer(player: Player, lobbyId) {
    try {
      const { data } = await axios.post(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}/join`,
        player,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::addPlayer`,
      );
    }
  }

  /**
   * Adds a role to a player in a Lobby
   * @param lobbyId The Cytokine Lobby ID.
   * @param discordId The Discord ID of the player we're adding a role to.
   * @param role The role we're adding.
   * @returns The updated Lobby document or error if role does not exist.
   */
  async addRole(lobbyId: string, discordId: string, role: string) {
    try {
      const { data } = await axios.post(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}/players/discord/${discordId}/roles/${role}`,
        {},
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::addRole`,
      );
    }
  }

  /**
   * Removes a player from a lobby's queue.
   * @param playerId The player Discord ID to remove from the queue.
   * @param lobby The lobby to remove the player from.
   */
  async removePlayer(playerId: string, lobby) {
    try {
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobby}/players/discord/${playerId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Player '${playerId}' request for removal from lobby '${lobby}' failed: ${error}`,
      );
    }
  }

  /**
   * Substitutes a player.
   * @param lobbyId The Lobby's ID we're doing the substitution in.
   * @param player1 The player we're substituting.
   * @param player2 The player we're adding in the place of player1.
   * @returns The updated Lobby document.
   */
  async substitutePlayer(lobbyId: string, player1: Player, player2: Player) {
    try {
      const { data } = await axios.post(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}/sub/${player1.discord}/discord`,
        player2,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::substitutePlayer`,
      );
    }
  }

  /**
   * Removes a role from a player inside a Lobby
   * @param playerId The player Discord ID
   * @param lobbyId The Lobby ID to remove the role from
   * @param role The role to remove from the player
   * @returns The updated lobby Document
   */
  async removeRole(playerId: string, lobbyId: string, role: RequirementName) {
    try {
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}/players/discord/${playerId}/roles/${role}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Player '${playerId}' request for removal of role ${role} from Lobby '${lobbyId}' failed: ${error}`,
      );
    }
  }

  /**
   * Gets the server info for a Match.
   * @param matchId The ID of the Match to get the server info for.
   * @returns The server information from Lighthouse.
   */
  async getServerInfo(matchId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/matches/${matchId}/server`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getServerInfo`,
      );
    }
  }

  /**
   * Gets info from Hatch
   * @param ip The IP of the server to get info from.
   * @param port The Hatch port
   * @param password Hatch password
   * @returns The Hatch document
   * @deprecated No longer utilized by Regi-Cytokine.
   */
  async getHatchInfo(ip: string, port: number, password: string) {
    try {
      const { data } = await axios.get(
        `http://${ip}${port}/status?password=${password}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getHatchInfo`,
      );
    }
  }

  /**
   * Gets all lobbies in a running state (AKA not ended/closed)
   */
  async getActiveLobbies() {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/lobbies`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getActiveLobbies`,
      );
    }
  }

  /**
   * Gets the Kaiend document for a user.
   * @param discordId The Discord ID of the user.
   * @returns The Kaiend document corresponding to this user.
   */
  async getKaiendAccount(discordId: string): Promise<any> {
    try {
      const { data } = await axios.get(
        `${config.kaiend.host}/accounts/discord/${discordId}`,
        {
          headers: { Authorization: `Bearer ${config.kaiend.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::getKaiendAccount`,
      );

      return error.response?.data;
    }
  }

  /**
   * Sends a request to Cytokine to close an active Lobby
   */
  async closeLobby(lobbyId: string) {
    try {
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        JSON.stringify(error, null, 2),
        `${LobbyService.name}::closeLobby`,
      );
      return error.response?.data;
    }
  }

  /**
   * Gets the amount of Lobby documents present in the collection.
   * @deprecated Not needed anymore for its original purpose, left in if required for other uses.
   */
  async getLobbyCount(): Promise<number> {
    return <number>await this.repo.count();
  }

  /**
   * Selects a random map from the available maps of a format.
   * @returns The randomly selected map name.
   */
  public getRandomMap(format: string, maps?: string[]): string | null {
    // If maps are passed on, just return a random pick.
    if (maps) return maps[Math.floor(Math.random() * maps.length)];

    // Find the format with this name.
    const f: LobbyFormat = LobbyService.formats.formats.find(
      (f: LobbyFormat) => f.name === format,
    );

    // If found, return a random map name.
    return f ? f.maps[Math.floor(Math.random() * f.maps.length)] : null;
  }

  /**
   * Generates an available name for a Lobby from the pool of names.
   * @returns An available, randomly generated Lobby name.
   */
  async getNewLobbyName(): Promise<string> {
    // Get active lobbies
    console.log(await this.getActiveLobbies());
    const { lobbies } = await this.getActiveLobbies();

    // Compare against the pool of names in the config to get one that isn't being used.
    const available = config.lobbies.names.filter((name) =>
      lobbies.every((lobby) => lobby.name !== name),
    );

    // If there are no available names, do a combination
    if (available.length === 0) {
      // Define combination amount and the desired name if the pool is empty
      let combinations = 2,
        name = '';

      // Will break once there are no lobbies with that name
      while (true) {
        // Get a random name with the amount of combinations needed
        name = this.getRandomName(combinations);

        // If a lobby has this name already, increase the amount of combinations and continue the loop
        if (lobbies.some((lobby) => lobby.name == name)) {
          combinations++;
          continue;
        }

        // The above condition did not pass, so the name is available.
        // Return the available name we got.
        return name;
      }
    }

    // Return a random name from the available pool.
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Gets a random name from the list of names available for a lobby.
   * @param n The amount of words to use for the name.
   * @returns The randomly selected name.
   */
  public getRandomName(n: number): string {
    // If there is a higher amount of combinations than there are elements, allow repetition
    if (n > config.lobbies.names.length) {
      // Declare an array of names
      const name: string[] = [];

      // Loop through the amount of combinations
      for (let i = 0; i < n; i++)
        // Add a random name from the pool to the array
        name.push(
          config.lobbies.names[
            Math.floor(Math.random() * config.lobbies.names.length)
          ],
        );

      // Return the joined array of names
      return name.join('');
    }

    // If not, just return a normal random name from a subset of the pool.
    return config.lobbies.names
      .sort(() => 0.5 - Math.random())
      .slice(0, n)
      .join('');
  }

  /**
   * Gets the config set on this Format for this specific type of map.
   * @param map The Map name.
   * @param format The LobbyFormat object.
   * @returns An object containing the configuration for this format & map type.
   */
  public getMapTypeConfig(map: string, format) {
    // Find the map type.
    const mType = map.match(/([^_]+)+?/)[0];

    // Find the config for this map type
    const cfg = format.mapTypes.find((m) => m.name === mType);

    // Set the default expiry time if not set
    if (!cfg?.expires) cfg.expires = config.lobbies.defaultExpiry;

    // Return the config
    return cfg;
  }

  /**
   * Creates a Discord Text & Voice channel for a lobby.
   */
  async createChannels(
    name: string,
    voiceRegion?: string,
    permissions?: OverwriteResolvable[],
  ) {
    return await this.discord.createLobbyChannels(
      name,
      { enabled: false },
      voiceRegion,
      permissions,
    );
  }

  /**
   * Saves a new Lobby document to the database.
   */
  async saveLobby(
    lobbyId: string,
    creatorId: string,
    messageId: string,
    region: string,
    name: string,
    expires: number,
    status: string,
    format?: string,
    tier?: string,
    channels?: LobbyChannels,
    accessConfig?: string,
  ) {
    // Calculate the Expiry Date of this Lobby
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expires);

    // Create new Lobby document
    const info = await new this.repo({
      createdAt: new Date(),
      lobbyId,
      status,
      creatorId,
      messageId,
      region,
      name,
      channels,
      accessConfig,
      format,
      tier,
    });

    // Return the saved document
    return await info.save();
  }

  /**
   * Updates a Lobby document in the database saving the new channels.
   * @param lobbyId The Lobby ID linked to the document.
   * @param teamChannels The team channels to save.
   * @param extra If passed, sets the info channel for the Lobby (where the AFK check is sent)
   * @returns The new internal Lobby document.
   */
  async updateLobbyChannels(lobbyId, teamChannels, extra?: any) {
    try {
      // Get the internal Lobby document with this ID linked to it.
      const lobby = await this.getInternalLobbyById(lobbyId);

      // Update the new channel information.
      lobby.channels = {
        ...lobby.channels,
        teamA: {
          textChannelId: teamChannels.A.text.id,
          voiceChannelId: teamChannels.A.voice.id,
        },
        teamB: {
          textChannelId: teamChannels.B.text.id,
          voiceChannelId: teamChannels.B.voice.id,
        },
      };

      if (extra) lobby.channels.general.infoChannelId = extra;

      // Mark as modified and save it
      lobby.markModified('channels');
      await lobby.save();

      // Return the new internal Lobby document
      return lobby;
    } catch (e) {
      // Probably not found or some other error.
      this.logger.error(
        `Lobby '${lobbyId}' was requested for internal update but failed: ${e}.`,
      );
    }
  }

  /**
   * Updates an Internal Lobby's status
   * @param lobbyId The Lobby we're updating.
   * @param status The status to set.
   * @returns The newly updated Lobby document.
   */
  async updateLobbyStatus(lobbyId: string, status: string): Promise<Lobby> {
    // Get the Lobby
    const lobby = await this.repo.findOne({ lobbyId });

    // If the lobby doesn't exist, return null
    if (!lobby) return null;

    // Update the status
    lobby.status = status;

    // Mark as modified and save it
    lobby.markModified('status');
    return await lobby.save();
  }

  /**
   * Gets the Lobby document for a lobby by its ID.
   */
  async getInternalLobbyById(lobbyId: string): Promise<Lobby> {
    return this.repo.findOne({ lobbyId });
  }

  /**
   * Gets the Lobby document for a lobby by any of its channels IDs.
   * @param channelId The channel ID to search for.
   * @returns The Lobby document that has a matching Channel ID.
   */
  async getInternalLobbyByChannel(channelId: string): Promise<Lobby> {
    return this.repo.findOne({
      $or: [
        { 'channels.categoryId': channelId },
        { 'channels.general.textChannelId': channelId },
        { 'channels.general.infoChannelId': channelId },
        { 'channels.general.voiceChannelId': channelId },
        { 'channels.teamA.textChannelId': channelId },
        { 'channels.teamA.voiceChannelId': channelId },
        { 'channels.teamB.textChannelId': channelId },
        { 'channels.teamB.voiceChannelId': channelId },
      ],
    });
  }

  /**
   * Gets the Lobby document for a lobby by its Discord Message ID.
   */
  async getInternalLobbyByMessageId(messageId: string) {
    return this.repo.findOne({ messageId });
  }

  /**
   * Parses the config's LobbyFormats and returns an array containing the LobbyFormat types.
   * @returns An object containing the SlashChoice LobbyFormat entries and a LobbyFormat array.
   */
  static parseLobbyFormats() {
    const formatNames = {};
    const formats: LobbyFormat[] = [];

    for (const format of config.formats) {
      // Parse the formats in the config file.
      // TODO: Add new games, for now it's only TF2.
      if (format.game !== 'tf2')
        // throw new Error(`${format.game} is not a supported game.`);
        continue;

      // Format distribution type must belong to enum
      const distMethods = format.distribution.map((d) => d.type);
      const supported = distMethods.filter(
        (m) => m in Object.keys(DistributionType),
      );
      if (supported.length !== distMethods.length)
        // throw new Error(`One of the listed Distribution Types on format ${format.name} does not exist.`);
        continue;

      // Parse requirements
      for (const dist of format.distribution) {
        // req.name must belong to RequirementName
        for (const req of dist.requirements) {
          if (
            !Object.values(RequirementName).includes(<RequirementName>req.name)
          )
            throw new Error(`${req.name} is not a valid requirement name!`);
        }
      }

      // Add to respective arrays.
      formatNames[format.name] = format.name;
      formats.push(<LobbyFormat>format);
    }

    // Return both, names and formats.
    return { names: formatNames, formats };
  }

  /**
   * Parses the config's listed regions into a list of options for LobbyCommand to offer.
   * @returns An object containing the SlashChoice region entries.
   */
  static parseRegions() {
    const regions = {},
      voiceRegions = {};

    // TODO: Validate regions

    // Iterate through regions available in config, and create the enumerable object.
    for (const region of Object.keys(config.regions)) {
      regions[config.regions[region].name] = region;
      voiceRegions[region] = config.regions[region].discordVoiceRegion;
    }

    return { names: regions, voiceRegions };
  }

  /**
   * Returns a region object passed its internal name.
   * @param region The region name
   * @returns The region object.
   */
  getRegion(region: string) {
    return config.regions[region];
  }

  /**
   * Returns a Format object being passed its name.
   * @param name The Format's name.
   * @returns The format object or null if not found.
   */
  getFormat(name: string) {
    return config.formats.find((f) => f.name === name);
  }

  /*
   * Get access config.
   */
  async getAccessConfig(name: string, id: string) {
    // Check if the access config is valid
    const userAccessConfigs = await this.preference.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );
    const guildAccessConfigs = await this.preference.getData(
      'guild',
      PreferenceKeys.lobbyAccessConfigs,
    );

    return !userAccessConfigs && !guildAccessConfigs
      ? null
      : userAccessConfigs && userAccessConfigs[name]
      ? userAccessConfigs[name]
      : guildAccessConfigs && guildAccessConfigs[name]
      ? guildAccessConfigs[name]
      : null;
  }

  /*
   * Get access list.
   */
  async getAccessList(name: string, id: string) {
    const userAccessLists = await this.preference.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );
    const guildAccessLists = await this.preference.getData(
      'guild',
      PreferenceKeys.lobbyAccessLists,
    );

    return !userAccessLists && !guildAccessLists
      ? null
      : userAccessLists && userAccessLists[name]
      ? userAccessLists[name]
      : guildAccessLists && guildAccessLists[name]
      ? guildAccessLists[name]
      : null;
  }

  /*
   * Check if the access config is valid.
   */
  async validateAccessConfig(
    accessConfig: string,
    interaction: CommandInteraction,
  ) {
    this.logger.debug(`Validating access config '${accessConfig}'...`);

    // Check if the access config is present
    const config = await this.getAccessConfig(
      accessConfig,
      interaction.user.id,
    );

    if (!config) {
      await this.messaging.replyToInteraction(
        interaction,
        `:x: Failed to create lobby: \`\`Access config with the name '${accessConfig}' does not exist\`\`.`,
        { ephemeral: true },
      );
      return false;
    }

    // Check if access lists are valid
    if (config.accessLists) {
      for (const action of Object.keys(config.accessLists)) {
        const whitelistName = config.accessLists[action]['whitelist'];
        const blacklistName = config.accessLists[action]['blacklist'];
        const whitelist = whitelistName
          ? await this.getAccessList(whitelistName, interaction.user.id)
          : null;
        const blacklist = blacklistName
          ? await this.getAccessList(blacklistName, interaction.user.id)
          : null;

        if (whitelistName && !whitelist) {
          await this.messaging.replyToInteraction(
            interaction,
            `:x: Failed to create lobby: \`\`Access list with the name '${whitelistName}' does not exist\`\`.`,
            { ephemeral: true },
          );
          return false;
        }

        if (blacklistName && !blacklist) {
          await this.messaging.replyToInteraction(
            interaction,
            `:x: Failed to create lobby: \`\`Access list with the name '${blacklistName}' does not exist\`\`.`,
            { ephemeral: true },
          );
          return false;
        }
      }
    } else {
      await this.messaging.replyToInteraction(
        interaction,
        `:x: Failed to create lobby: \`\`Access config '${accessConfig}' does not have any access lists\`\`.`,
        { ephemeral: true },
      );
      return false;
    }

    return true;
  }

  /**
   * Generate a permissions list for lobby channels.
   * This will contain who can and cannot see the channels.
   * @param lobby The Cytokine Lobby document
   * @param name The name of the AccessList the Lobby is using (if any)
   * @param creator The Discord ID of the Lobby creator
   * @returns An array of OverwriteResolvable permissions for the Lobby's category.
   */
  async compileLobbyChannelPermissionsList(
    lobby: any,
    name: string,
    creator: string,
    region?: string,
    format?: string,
  ): Promise<OverwriteResolvable[]> {
    this.logger.debug(
      `Generating channel permissions list accessConfig '${name}', creator '${creator}'...`,
    );

    // Declare our permissions array and get the AccessConfig instance.
    const permissions: OverwriteResolvable[] = [];
    const accessConfig = await this.getAccessConfig(name, creator);

    // If no AccessConfig is being used, set-up permissions for region & format set on this Lobby.
    if (!accessConfig) {
      this.logger.warn(
        `Could not find accessConfig with name '${name}'. Configuring permissions per region/format.`,
      );

      // Find the specific role for this region & format.
      const r = this.getRegion(region);
      const role = r.roles.find((r) => r.name === format);

      if (!role || !r)
        this.logger.error(
          `Could not find role for region '${region}' and format '${format}'.`,
        );
      else
        permissions.push(
          {
            id: await this.discord.getRole(role.role),
            allow: ['VIEW_CHANNEL', 'CONNECT'],
          },
          {
            id: await this.discord.getEveryoneRole(),
            deny: ['VIEW_CHANNEL', 'CONNECT'],
          },
        );

      return permissions;
    }

    const { accessLists } = accessConfig;
    if (!accessLists || !accessLists['player']) return permissions;

    const { whitelist, blacklist } = accessLists['player'];
    const whiteAccessList = whitelist
      ? await this.getAccessList(whitelist, creator)
      : null;
    const blackAccessList = blacklist
      ? await this.getAccessList(blacklist, creator)
      : null;

    if (whitelist && whiteAccessList) {
      const { users, roles } = whiteAccessList;
      let everyone = true;

      if (users) {
        for (const item of users) {
          permissions.push({
            id: await this.discord.getMember(item),
            allow: ['VIEW_CHANNEL'],
          });
          everyone = false;
        }
      }

      if (roles) {
        for (const item of roles) {
          permissions.push({
            id: await this.discord.getRole(item),
            allow: ['VIEW_CHANNEL'],
          });
          everyone = false;
        }
      }

      if (!everyone) {
        permissions.push({
          id: await this.discord.getEveryoneRole(),
          deny: ['VIEW_CHANNEL'],
        });
      }
    }

    if (blacklist && blackAccessList) {
      const { users, roles } = blackAccessList;

      if (users) {
        for (const item of users) {
          permissions.push({
            id: await this.discord.getMember(item),
            deny: ['VIEW_CHANNEL'],
          });
        }
      }

      if (roles) {
        for (const item of roles) {
          permissions.push({
            id: await this.discord.getRole(item),
            deny: ['VIEW_CHANNEL'],
          });
        }
      }
    }

    return permissions;
  }

  /*
   * Check if a player can join the specific role.
   */
  async canPlayerJoinRole(
    lobby: Lobby,
    player: Player,
    role: RequirementName,
  ): Promise<boolean> {
    if (!lobby.accessConfig || lobby.accessConfig === '') return true;
    this.logger.debug(
      `Checking if player ${player.discord} can join role ${role} of lobby ${lobby._id}`,
    );

    const config = await this.getAccessConfig(
      lobby.accessConfig,
      lobby.creatorId,
    );

    if (!config) {
      this.logger.warn(
        `No access config found with name ${lobby.accessConfig} for lobby ${lobby.name}`,
      );
      return true;
    }

    const { accessLists } = config;
    if (!accessLists || !accessLists[role]) return true;

    const { whitelist, blacklist } = accessLists[role];
    const whiteAccessList = whitelist
      ? await this.getAccessList(whitelist, lobby.creatorId)
      : null;
    const blackAccessList = blacklist
      ? await this.getAccessList(blacklist, lobby.creatorId)
      : null;

    if (whitelist && !whiteAccessList) {
      this.logger.warn(
        `No access list found with name ${whitelist} for action ${role} at lobby ${lobby.name}`,
      );
      return true;
    }

    if (blacklist && !blackAccessList) {
      this.logger.warn(
        `No access list found with name ${whitelist} for action ${role} at lobby ${lobby.name}`,
      );
      return true;
    }

    const { discord } = player;
    if (blackAccessList) {
      const { users, roles } = blackAccessList;

      if (users && users.includes(discord)) return false;

      const member = await this.discord.getMember(discord);
      return !(roles && roles.some((r) => member.roles.cache.has(r)));
    }
    if (whiteAccessList) {
      const { users, roles } = whiteAccessList;

      if (users && users.includes(discord)) return true;

      const member = await this.discord.getMember(discord);
      return !!roles && roles.some((r) => member.roles.cache.has(r));
    }

    return true;
  }

  /**
   * Gets the tier of a player in Discord.
   * @param member The GuildMember instance to scan their tier.
   * @returns The tier of the player, free if not found.
   */
  getPlayerTier(member: GuildMember): string {
    // Get the roles of the member.
    const roles = member.roles;

    // Loop the config set tiers to search for this role.
    //
    // Known Scenario: User has more than 1 of the tier roles
    // So we'll just return the highest one found (descending order) and use that to determine access.
    for (const id of Object.keys(config.discord.roles).reverse())
      if (roles.cache.has(config.discord.roles[id])) return id;
    return 'free';
  }

  /**
   * Returns the amount of servers available on a region based on the requesting tier.
   * @param region The Region name.
   * @param tier The Tier name.
   * @returns Numeric amount of servers left for this region & tier.
   */
  async getAvailableServers(region: string, tier: string): Promise<number> {
    // Get the tier info
    const t = config.regions[region]?.tiers[tier];

    // Get currently active Lobbies.
    const { lobbies: activeLobbies } = await this.getActiveLobbies();

    // Filter them by region and tier.
    const filtered = activeLobbies.filter(
      (l) => l.tier === tier && l.region === region,
    );

    // Return the difference.
    return t.limit - filtered.length;
  }

  /**
   * Checks if a user can create a Lobby on a Region with a certain tier, while also checking for availability.
   * @param region The Region name.
   * @param tier The tier name.
   * @returns True if they are allowed to, false if not.
   */
  async canCreateLobby(
    region: string,
    tier: string,
  ): Promise<boolean | number> {
    // Get the regions' tier list.
    const r = config.regions[region];

    // Invalid region? Just say no.
    if (!r) return -1;

    const tiers = r.tiers;

    // Is this tier listed?
    if (!tiers[tier]) return -2;

    // Check availability for this tier and region.
    const available = await this.getAvailableServers(region, tier);

    return available > 0;
  }
}
