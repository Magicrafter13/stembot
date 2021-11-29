module.exports = {
	name: 'echo',
	description: 'Copies you!',
	guildOnly: false,
	cooldown: 5,
	argsMin: 1,
	argsMax: -1,
};
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('echo')
		.setDescription('Copies you!')
		.addStringOption(option => option
			.setName("text")
			.setDescription("Enter what you want me to say!")
			.setRequired(true)),
	guildOnly: false,
	cooldown: 5,
	async execute(interaction) {
		await interaction.reply(interaction.options.get("text", true).value);
	},
	old_execute(message, args) {
		message.channel.send(args.join(' '));
	},
	help(prefix) {
		return `
${prefix}echo <the_message>

Bot replies with the_message.
`;
	},
};
