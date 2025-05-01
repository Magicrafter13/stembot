import { SlashCommandBuilder } from '@discordjs/builders';

export default {
	data: new SlashCommandBuilder()
		.setName('echo')
		.setDescription('Copies you!')
		.addStringOption(option => option
			.setName("text")
			.setDescription("Enter what you want me to say!")
			.setRequired(true)),
	guildOnly: false,
	cooldown: 5,
	execute(interaction) {
		return interaction.reply(interaction.options.get("text", true).value);
	},
};
