module.exports = {
	name: 'echo',
	description: 'Copies you!',
	guildOnly: false,
	cooldown: 5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args) {
		message.channel.send(args.join(' '));
	},
	help(prefix) {
		return `
${prefix}echo <the_message>

Bot replies with the_message.
`;
	},
};
