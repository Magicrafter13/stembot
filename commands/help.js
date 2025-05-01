import packageData from "../package.json" with { type: "json" };
import { SlashCommandBuilder } from '@discordjs/builders';

const { version } = packageData;
const versionShort = version.replace(/\.\d+$/u, '');

export default {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Additional help information.'),
	guildOnly: false,
	cooldown: 0,
	execute(interaction) {
		return interaction.reply({
			//content: `Pong! This message had a latency of ${Date.now() - interaction.createdTimestamp}`,
			embeds: [
				{
					hexColor: '#800028',
					author: {
						name: 'Clark Stembot',
						iconURL:  'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png',
						url:  'https://gitlab.com/Magicrafter13/stembot'
					},
					fields: [
						{
							name: 'Need More Info?',
							value: 'Check out the documentation on the [Wiki](https://gitlab.com/Magicrafter13/stembot/-/wikis/home)!'
						},
						{
							name: 'Found a Bug? Have a New Feature Idea?',
							value: 'Submit reports/ideas on [the issues page](https://gitlab.com/Magicrafter13/stembot/-/issues).'
						}
					],
					footer: {
						text: `Clark Stembot - Version ${versionShort}`
					},
					timestamp: (new Date(Date.now())).toISOString(),
					type: 'rich'
				}
			]
		});
	},
};
