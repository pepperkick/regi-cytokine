import {
  AutocompleteInteraction,
  CommandInteraction,
  MessageEmbed,
} from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import * as config from '../../../config.json';
import { LobbyCommand } from '../lobby.command';

@Discord()
@SlashGroup('lobby')
export class RegionStatusSubCommand {
  @Slash('region-status', {
    description:
      'Lists the regional availability for Lobby creation in a region.',
  })
  async regionStatus(
    @SlashOption('region', {
      description: '[OPTIONAL] A specific region to query the status for.',
      required: false,
      autocomplete: true,
      type: 'STRING',
    })
    region: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'region': {
          // Get the regions currently on the config
          const regions = Object.keys(config.regions);

          // Loop them
          const opt = [];
          for (const region of regions)
            opt.push({
              name: config.regions[region].name,
              value: region,
            });

          return await interaction.respond(opt);
        }
      }
    } else {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Create the reply
      const reply = new MessageEmbed({
        title: 'Lobby Region Status',
        fields: [],
        color: '#06D6A0',
        footer: {
          text: `[F]: Free [P]: Premium\nKindest Regards, Qixalite • ${new Date().toLocaleDateString(
            'en-US',
          )}`,
        },
        author: {
          name: 'Qixalite',
          iconURL:
            'https://media.discordapp.net/attachments/743005170996215839/743077007889268736/QixaliteLogoDiscord3.png',
        },
      });

      // If a region was specified, only show that one
      let r = Object.keys(config.regions);

      // If a region was specified, filter the list.
      if (region) {
        const regions = r;
        r = [];

        for (const item of regions) {
          const r1 = config.regions[item];
          if (r1.tags?.includes(region.toLowerCase())) r.push(item);
        }
      }

      // None found with this filter?
      if (r.length < 1) {
        reply.addField(
          'No regions found',
          'Please try again with a different filter.',
          true,
        );

        return await interaction.editReply({
          embeds: [reply],
        });
      }

      // Get active Lobbies
      const { lobbies: aLobbies } =
        await LobbyCommand.service.getActiveLobbies();

      // Now start to build the embed by querying the status
      for (const region of r.sort()) {
        // Get the region object
        const r = config.regions[region];

        // Get active Lobbies currently for this region
        const rLobbies = aLobbies.filter((r) => r.region === region);

        // Start constructing the embed string
        let status = `\`${region}\``;
        for (const alias of r.alias) status += ` \`${alias}\``;
        status += '\n';

        // List the tiers
        for (const tier of Object.keys(r.tiers).sort()) {
          // Get the tier object
          const t = r.tiers[tier];

          // If 0, means it's unlimited. Do not list.
          if (t.limit === 0) continue;

          // Filter Lobbies by tier now
          const tLobbies = rLobbies.filter((l) => l.tier === tier);

          // Build the sub-message
          status += `${tier.charAt(0).toUpperCase()}: ${tLobbies.length} / ${
            t.limit
          }\n`;
        }

        // Add the embed
        reply.addField(r.name, status, true);
      }

      // Reply to the interaction
      return await interaction.editReply({
        embeds: [reply],
      });
    }
  }
}
