module.exports = {
	name: 'ping',
	description: 'Gives pseudo-accurate latency info.',
	guildOnly: false,
	cooldown: 5,
	argsMin: 0,
	argsMax: -1,
	usage: '',
	execute(message, args) {
		message.channel.send(`Pong! This message had a latency of ${Date.now() - message.createdTimestamp}ms.`);
	},
	help(prefix) {
		return `${prefix}ping`;
	},
};
