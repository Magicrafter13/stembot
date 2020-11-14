module.exports = {
	name: 'echo',
	description: 'Replies to you with your message.',
	guildOnly: false,
	cooldown: 5,
	argsMin: 1,
	argsMax: -1,
	usage: '',
	execute(message, args) {
		message.channel.send(args.join(' '));
	},
};
