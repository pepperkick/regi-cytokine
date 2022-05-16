import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-configs', 'lobby')
export class ImportAccessConfigCommand {
  @Slash('import', {
    description: 'Import an access config',
  })
  async exec(
    @SlashOption('contents', {
      description: `Contents of the access config to import`,
      type: 'STRING',
    })
    contents: string,
    interaction: CommandInteraction,
  ) {
    const id = AccessConfigsCommand.getPrefId(interaction);

    let lobbyConfigs = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    if (!lobbyConfigs) {
      lobbyConfigs = {};
    }

    try {
      const list = JSON.parse(contents);
      const name = list.name;

      if (lobbyConfigs[name]) {
        return await interaction.reply({
          content: `Access config with the name '${name}' already exists.`,
          ephemeral: true,
        });
      }

      if (!list?.accessLists) {
        return await interaction.reply({
          content: `Access config must contain an access list.`,
          ephemeral: true,
        });
      }

      lobbyConfigs[name] = list;

      await LobbyCommand.preferenceService.storeData(
        id,
        PreferenceKeys.lobbyAccessConfigs,
        lobbyConfigs,
      );

      return await interaction.reply({
        content: `Your access config with name '${name}' has been imported successfully`,
        ephemeral: true,
      });
    } catch (error) {
      return await interaction.reply({
        content: 'Invalid JSON',
        ephemeral: true,
      });
    }
  }
}
