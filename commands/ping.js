import { SlashCommandBuilder } from '@discordjs/builders';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong! and the latency.'),
	guildOnly: false,
	cooldown: 5,
	execute(interaction) {
		return interaction.reply(`Pong! This message had a latency of ${Date.now() - interaction.createdTimestamp} ms.`);
	},
};
