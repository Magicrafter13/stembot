const { SlashCommandBuilder } = require('@discordjs/builders');

const { version } = require('../package.json');
const version_short = version.replace(/\.\d+$/, '');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Additional help information.'),
	guildOnly: false,
	cooldown: 0,
	async execute(interaction) {
		await interaction.reply({
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
						text: `Clark Stembot - Version ${version_short}`
					},
					timestamp: (new Date(Date.now())).toISOString(),
					type: 'rich'
				}
			]
		});
	},
};
