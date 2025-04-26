const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong! and the latency.'),
	guildOnly: false,
	cooldown: 5,
	async execute(interaction) {
		await interaction.reply(`Pong! This message had a latency of ${Date.now() - interaction.createdTimestamp}`);
	},
	/*argsMin: 0,
	argsMax: -1,
	old_execute(message, args) {
		message.channel.send(`Pong! This message had a latency of ${Date.now() - message.createdTimestamp}ms.`);
	},
	help(prefix) {
		return `
${prefix}ping
`
	},*/
};
