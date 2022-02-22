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
import { StatusColors as color } from '../../objects/status-colors.enum';

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
      if (!error.response.data?.error) this.logger.error(error.response.data);

      return error.response.data;
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
      this.logger.error(error.response.data);
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
      this.logger.error(error.response.data);
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
    } catch (e) {
      this.logger.error(e.response.data);
    }
  }

  /**
   * Adds a player to a lobby's queue.
   * @param player The player to add.
   * @param lobby The lobby to add the player to.
   */
  async addPlayer(player: Player, lobby) {
    try {
      const { data } = await axios.post(
        `${config.cytokine.host}/api/v1/lobbies/${lobby}/join`,
        player,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      if (!error.response.data?.error) this.logger.error(error.response.data);

      return error.response.data;
    }
  }

  /**
   * Removes a player from a lobby's queue.
   * @param player The player Discord ID to remove from the queue.
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
        `Player '${playerId}' request for removal from lobby '${lobby}' failed: ${error.response.data.error}`,
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
      this.logger.error(error.response.data);
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
      this.logger.error(error.response.data);
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
      this.logger.error(error.response.data);
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
    } catch (e) {
      if (!e.response.data?.error) this.logger.error(e.response.data);

      return e.response.data;
    }
  }

  /**
   * Sends a request to Cytokine to close an active Lobby
   */
  async closeLobby(lobbyId: string) {
    try {
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}/false`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to close Lobby '${lobbyId}': ${error.response.data.error}`,
      );
      return error.response.data;
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
    if (!cfg.expires) cfg.expires = config.lobbies.defaultExpiry;

    // Return the config
    return cfg;
  }

  /**
   * Creates a Discord Text & Voice channel for a lobby.
   */
  async createChannels(name: string, voiceRegion?: string) {
    return await this.discord.createLobbyChannels(
      name,
      { enabled: false },
      voiceRegion,
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
    channels?: LobbyChannels,
  ) {
    // Calculate the Expiry Date of this Lobby
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expires);

    // Create new Lobby document
    const info = await new this.repo({
      lobbyId,
      status,
      creatorId,
      messageId,
      region,
      name,
      channels,
    });

    // Return the saved document
    return await info.save();
  }

  /**
   * Updates a Lobby document in the database saving the new channels.
   * @param lobbyId The Lobby ID linked to the document.
   * @param channels The team channels to save.
   * @returns The new internal Lobby document.
   */
  async updateLobbyChannels(lobbyId, teamChannels: { A; B }) {
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
    return await this.repo.findOne({ lobbyId });
  }

  /**
   * Gets the Lobby document for a lobby by its Discord Message ID.
   */
  async getInternalLobbyByMessageId(messageId: string) {
    return await this.repo.findOne({ messageId });
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
      if (
        !Object.values(DistributionType).includes(
          <DistributionType>format.distribution,
        )
      )
        // throw new Error(`${format.type} is not a supported Lobby type.`);
        continue;

      // Parse requirements
      for (const req of format.requirements) {
        // req.name must belong to RequirementName
        if (!Object.values(RequirementName).includes(<RequirementName>req.name))
          throw new Error(`${req.name} is not a valid requirement name!`);
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
   * Monitors active lobbies.
   * @noparams
   * @noreturn
   */
  /* async monitor(): Promise<void> {
    // Find all active lobbies
    const lobbies: Lobby[] = await this.repo.find({
      status: 'WAITING_FOR_REQUIRED_PLAYERS',
    });

    this.logger.debug(
      `Found ${lobbies.length} unfilled lobbies (no requirements met).`,
    );

    // Loop through obtained lobbies to monitor for their expiry date (if reached, handle them)
    for (const lobby of lobbies) {
      setTimeout(async () => {
        if (lobby.expiryDate < new Date()) await this.handleLobbyExpiry(lobby);
      }, 100);
    }
  }*/

  /**
   * Handles an expired Lobby and closes it.
   */
  /*async handleLobbyExpiry(lobby: Lobby) {
    try {
      // Get the Message object for this LobbyID
      const message = await LobbyService.discord.getMessage(lobby.messageId);

      // Update embed color
      const embed = message.embeds[0];
      embed.color = color.EXPIRED;

      // Delete the channels that were created
      const e = await LobbyService.discord.deleteChannels(lobby);

      // Was there an error?
      await message.edit({
        content: `${
          e
            ? `:warning: The lobby couldn't be closed completely: \`\`Channels could not be deleted: ${e}\`\`\n\n`
            : ''
        }:hourglass: This lobby has expired... \`\`Lobby was waiting for players for too long.\`\``,
        embeds: [embed],
        components: [],
      });

      // Do the request to close the lobby on the server due to it being expired.
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobby.lobbyId}/true`,
        {
          headers: {
            Authorization: `Bearer ${config.cytokine.secret}`,
          },
        },
      );

      this.logger.debug(
        `Lobby ${lobby.lobbyId} was closed due to reaching its expiry date.`,
      );

      // If axios was successful, update the Internal Lobby to its new status.
      lobby.status = data.status;
      lobby.markModified('status');
      await lobby.save();
    } catch (e) {
      this.logger.error(
        `Failed to handle expired lobby ${lobby.lobbyId}: ${e.response.data}`,
      );
    }
  }*/
}
