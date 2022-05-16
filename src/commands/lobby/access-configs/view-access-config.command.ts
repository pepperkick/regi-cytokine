import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-configs', 'lobby')
export class ViewAccessConfigsCommand {
  @Slash('view', {
    description: 'View an access config',
  })
  async exec(
    @SlashOption('name', {
      description: `Type the config name`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'name': {
          return AccessConfigsCommand.getNameChoices(interaction);
        }
      }

      return interaction.respond([]);
    }

    const id = AccessConfigsCommand.getPrefId(interaction);

    const lobbyConfigs = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    if (!lobbyConfigs || !lobbyConfigs[name]) {
      return await interaction.reply({
        content: `Access config with the name '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    const config = lobbyConfigs[name];
    const fields = [];

    if (config?.accessLists) {
      let listText = '';
      for (const action of Object.keys(config.accessLists)) {
        const actionList = config.accessLists[action];

        if (actionList['whitelist']) {
          listText += `${action}: ${actionList['whitelist']} (whitelist)\n`;
        }

        if (actionList['blacklist']) {
          listText += `${action}: ${actionList['blacklist']} (blacklist)\n`;
        }
      }

      if (listText != '') {
        fields.push({
          name: 'Access Lists',
          value: listText,
        });
      }
    }

    return await interaction.reply({
      embeds: [
        {
          title: `Access config '${config.name}'`,
          fields: fields,
          color: 'BLUE',
        },
      ],
      ephemeral: true,
    });
  }
}
