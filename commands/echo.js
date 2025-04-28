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
};
