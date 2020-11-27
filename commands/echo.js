module.exports = {
	name: 'echo',
	description: 'Replies to you with your message.',
	guildOnly: false,
	cooldown: 5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args) {
		message.channel.send(args.join(' '));
	},
	help(prefix) {
		return `${prefix}echo text\n\tbot will respond with the text after echo`;
	},
};
